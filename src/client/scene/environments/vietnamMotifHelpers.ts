import * as THREE from 'three';
import {
  SignageAtlasLike,
  VietnamBuilderContext,
  createSculptedRockGeometry,
  mulberry32
} from './vietnamGeometryHelpers';

/**
 * Shared high-detail Vietnamese architectural motifs, sculpted figures, signage plaques,
 * ceremonial bronzes, traditional watercraft, historical vehicles, and regional flora.
 * Every geometry builder returns BufferGeometry parts ready for `mergeNormalized` to keep draw calls low.
 */

export interface SignagePlaqueOptions {
  text: string;
  subText?: string;
  bgColor?: string;
  borderColor?: string;
  textColor?: string;
  width?: number;
  height?: number;
  depth?: number;
  style?:
  | 'royal'
  | 'market'
  | 'stone'
  | 'bronze'
  | 'lacquer_mural'
  | 'ceramic_relief'
  | 'nhat_thi_nhat_hoa'
  | 'han_nom_stele'
  | 'stone_relief'
  | 'cu_chi_welcome'
  | 'blue_plaque';
  motifSeed?: number;
}

/**
 * Generates a crisp Canvas-based Vietnamese signage / calligraphy / mural texture (Node/Vitest safe).
 */
function drawSignageToCanvas(
  ctx2d: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  opts: SignagePlaqueOptions
): void {
  const style = opts.style ?? 'royal';
  const bg =
    opts.bgColor ??
    (style === 'market'
      ? '#1a5e3c'
      : style === 'stone' || style === 'han_nom_stele' || style === 'stone_relief'
        ? '#6f6c64'
        : style === 'bronze'
          ? '#4b3b24'
          : style === 'lacquer_mural'
            ? '#3c1210'
            : style === 'ceramic_relief'
              ? '#184e4a'
              : style === 'nhat_thi_nhat_hoa'
                ? '#7e1a16'
                : style === 'cu_chi_welcome'
                  ? '#5c2c16'
                  : style === 'blue_plaque'
                    ? '#16457a'
                    : '#7d1614');
  const border =
    opts.borderColor ??
    (style === 'stone' || style === 'han_nom_stele' || style === 'stone_relief'
      ? '#b8b2a4'
      : style === 'blue_plaque'
        ? '#e8eef5'
        : style === 'ceramic_relief'
          ? '#e8c254'
          : '#e6b83e');
  const fg =
    opts.textColor ??
    (style === 'stone' || style === 'han_nom_stele' || style === 'stone_relief'
      ? '#e2ddd0'
      : style === 'blue_plaque'
        ? '#ffffff'
        : style === 'cu_chi_welcome'
          ? '#f8e6b4'
          : style === 'market'
            ? '#f8e391'
            : '#f7d15c');

  ctx2d.save();
  ctx2d.translate(originX, originY);
  ctx2d.beginPath();
  ctx2d.rect(0, 0, 512, 256);
  ctx2d.clip();

  ctx2d.fillStyle = bg;
  ctx2d.fillRect(0, 0, 512, 256);

  // Subtle heritage texture grain
  const rand = mulberry32(opts.motifSeed ?? 101);
  ctx2d.fillStyle = 'rgba(255,255,255,0.035)';
  for (let i = 0; i < 180; i++) {
    ctx2d.fillRect(rand() * 512, rand() * 256, 3 + rand() * 14, 1 + rand() * 2);
  }

  if (style === 'lacquer_mural') {
    // Traditional Vietnamese lacquer landscape (golden hills, pagoda, river, pine)
    const grad = ctx2d.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#5a1612');
    grad.addColorStop(0.55, '#8c2b16');
    grad.addColorStop(1, '#26100e');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, 512, 256);

    // Sun & clouds
    ctx2d.fillStyle = '#f2c14e';
    ctx2d.beginPath();
    ctx2d.arc(380, 74, 34, 0, Math.PI * 2);
    ctx2d.fill();

    // Golden karst mountains
    ctx2d.fillStyle = '#c88e2b';
    ctx2d.beginPath();
    ctx2d.moveTo(0, 185);
    ctx2d.quadraticCurveTo(85, 95, 165, 168);
    ctx2d.quadraticCurveTo(255, 72, 340, 162);
    ctx2d.quadraticCurveTo(435, 108, 512, 175);
    ctx2d.lineTo(512, 256);
    ctx2d.lineTo(0, 256);
    ctx2d.closePath();
    ctx2d.fill();

    // River reflection ribbons
    ctx2d.strokeStyle = '#f5d26b';
    ctx2d.lineWidth = 3;
    for (let r = 0; r < 6; r++) {
      ctx2d.beginPath();
      ctx2d.moveTo(40 + r * 32, 198 + r * 8);
      ctx2d.quadraticCurveTo(250, 188 + r * 8, 460 - r * 24, 202 + r * 8);
      ctx2d.stroke();
    }
  } else if (style === 'ceramic_relief') {
    // 4 distinct Biên Hòa glazed ceramic reliefs (Bến Thành South: Ox & Duck, East: Coffee & Rice, West: Lotus & Fish, North: Banana & Stingray)
    const grad = ctx2d.createRadialGradient(256, 128, 12, 256, 128, 230);
    grad.addColorStop(0, '#286c5e');
    grad.addColorStop(1, '#10343a');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, 512, 256);
    const variant = Math.abs(Math.floor(opts.motifSeed ?? 0)) % 4;
    ctx2d.strokeStyle = '#e5bd53';
    ctx2d.lineWidth = 5;
    ctx2d.strokeRect(26, 26, 460, 204);
    if (variant === 0) {
      // Cửa Nam: Sculpted Ox Head & Swimming Duck
      ctx2d.fillStyle = '#d9a44a';
      ctx2d.beginPath();
      ctx2d.ellipse(185, 118, 56, 46, 0, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.strokeStyle = '#f2deb0';
      ctx2d.lineWidth = 10;
      ctx2d.beginPath();
      ctx2d.arc(185, 86, 56, Math.PI * 1.12, Math.PI * 1.88);
      ctx2d.stroke();
      ctx2d.fillStyle = '#e8cf78';
      ctx2d.beginPath();
      ctx2d.ellipse(342, 138, 46, 26, -0.1, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.beginPath();
      ctx2d.arc(384, 108, 16, 0, Math.PI * 2);
      ctx2d.fill();
    } else if (variant === 1) {
      // Cửa Đông: Golden Rice Sheaves & Coffee Branch
      ctx2d.strokeStyle = '#f2c85b';
      ctx2d.lineWidth = 6;
      for (let i = -3; i <= 3; i++) {
        ctx2d.beginPath();
        ctx2d.moveTo(160, 204);
        ctx2d.quadraticCurveTo(160 + i * 16, 120, 160 + i * 32, 66 + Math.abs(i) * 8);
        ctx2d.stroke();
      }
      ctx2d.fillStyle = '#d64531';
      for (let b = 0; b < 8; b++) {
        ctx2d.beginPath();
        ctx2d.arc(312 + (b % 4) * 28, 92 + Math.floor(b / 4) * 34, 11, 0, Math.PI * 2);
        ctx2d.fill();
      }
    } else if (variant === 2) {
      // Cửa Tây: Blooming Lotus & Carp Fish
      ctx2d.fillStyle = '#f08aa8';
      for (let i = -3; i <= 3; i++) {
        ctx2d.beginPath();
        ctx2d.ellipse(168 + i * 24, 128 + Math.abs(i) * 6, 16, 44 - Math.abs(i) * 4, i * 0.24, 0, Math.PI * 2);
        ctx2d.fill();
      }
      ctx2d.fillStyle = '#e6b94c';
      ctx2d.beginPath();
      ctx2d.ellipse(355, 132, 62, 28, -0.15, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.beginPath();
      ctx2d.moveTo(410, 126);
      ctx2d.lineTo(446, 98);
      ctx2d.lineTo(446, 158);
      ctx2d.closePath();
      ctx2d.fill();
    } else {
      // Cửa Bắc: Banana Bunch & Stingray
      ctx2d.fillStyle = '#e8c43d';
      for (let b = -2; b <= 2; b++) {
        ctx2d.beginPath();
        ctx2d.ellipse(158 + b * 22, 126 + Math.abs(b) * 8, 12, 46, b * 0.22, 0, Math.PI * 2);
        ctx2d.fill();
      }
      ctx2d.fillStyle = '#7bb8c4';
      ctx2d.beginPath();
      ctx2d.moveTo(350, 74);
      ctx2d.quadraticCurveTo(426, 122, 350, 168);
      ctx2d.quadraticCurveTo(278, 122, 350, 74);
      ctx2d.fill();
      ctx2d.strokeStyle = '#7bb8c4';
      ctx2d.lineWidth = 5;
      ctx2d.beginPath();
      ctx2d.moveTo(350, 168);
      ctx2d.lineTo(385, 212);
      ctx2d.stroke();
    }
  } else if (style === 'nhat_thi_nhat_hoa') {
    // Huế Imperial Enamel Frieze (*Cổ diêm Nhất Thi Nhất Họa* — alternating poetry & botanical/dragon panels)
    ctx2d.fillStyle = '#7a1914';
    ctx2d.fillRect(0, 0, 512, 256);
    const cols = 6;
    const cellW = 480 / cols;
    for (let c = 0; c < cols; c++) {
      const px = 16 + c * cellW;
      const isPoem = c % 2 === 0;
      ctx2d.fillStyle = isPoem ? '#efe6cf' : '#1b5f66';
      ctx2d.fillRect(px + 4, 24, cellW - 8, 208);
      ctx2d.strokeStyle = '#e8be4a';
      ctx2d.lineWidth = 4;
      ctx2d.strokeRect(px + 4, 24, cellW - 8, 208);
      if (isPoem) {
        ctx2d.fillStyle = '#2c2420';
        for (let line = 0; line < 3; line++) {
          for (let ch = 0; ch < 6; ch++) {
            ctx2d.fillRect(px + 14 + line * 20, 44 + ch * 26, 11, 14);
          }
        }
      } else {
        // Stylized floral/cloud enamel medallion
        ctx2d.fillStyle = '#e8969e';
        ctx2d.beginPath();
        ctx2d.arc(px + cellW * 0.5, 118, 22, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.fillStyle = '#f2c94c';
        ctx2d.beginPath();
        ctx2d.arc(px + cellW * 0.5, 118, 9, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.strokeStyle = '#72c9a6';
        ctx2d.lineWidth = 4;
        ctx2d.beginPath();
        ctx2d.moveTo(px + 18, 194);
        ctx2d.quadraticCurveTo(px + cellW * 0.5, 152, px + cellW - 18, 186);
        ctx2d.stroke();
      }
    }
  } else if (style === 'han_nom_stele') {
    // Incised stone stele calligraphy columns + arched dragon-cloud forehead
    ctx2d.fillStyle = '#5f615d';
    ctx2d.fillRect(0, 0, 512, 256);
    ctx2d.strokeStyle = '#9aa097';
    ctx2d.lineWidth = 6;
    ctx2d.strokeRect(20, 18, 472, 220);
    ctx2d.fillStyle = '#c8c4b8';
    for (let col = 0; col < 14; col++) {
      for (let row = 0; row < 7; row++) {
        if (rand() > 0.14) {
          ctx2d.fillRect(42 + col * 31, 38 + row * 26, 14, 15);
        }
      }
    }
  } else if (style === 'stone_relief') {
    // Lũng Cú green-stone historical bas-relief panel
    ctx2d.fillStyle = '#606b66';
    ctx2d.fillRect(0, 0, 512, 256);
    ctx2d.fillStyle = '#8b968e';
    for (let k = 0; k < 5; k++) {
      ctx2d.beginPath();
      ctx2d.arc(92 + k * 82, 112 + (k % 2) * 14, 24, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.fillRect(72 + k * 82, 138, 40, 74);
    }
  } else if (style === 'cu_chi_welcome') {
    // Iconic varnished red-brown wood Củ Chi welcome board
    const g = ctx2d.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#6c341a');
    g.addColorStop(1, '#471f0e');
    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, 0, 512, 256);
    ctx2d.strokeStyle = '#f2ca52';
    ctx2d.lineWidth = 8;
    ctx2d.strokeRect(14, 14, 484, 228);
  }

  // Ornamental double border + corner cloud scrolls
  if (style !== 'nhat_thi_nhat_hoa' && style !== 'han_nom_stele' && style !== 'stone_relief') {
    ctx2d.strokeStyle = border;
    ctx2d.lineWidth = 10;
    ctx2d.strokeRect(10, 10, 492, 236);
    ctx2d.lineWidth = 3;
    ctx2d.strokeRect(22, 22, 468, 212);

    for (const [cx, cy] of [
      [32, 32],
      [480, 32],
      [32, 224],
      [480, 224]
    ]) {
      ctx2d.fillStyle = border;
      ctx2d.fillRect(cx - 8, cy - 8, 16, 16);
    }
  }

  if (opts.text || opts.subText) {
    ctx2d.fillStyle = fg;
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    if (opts.text) {
      const fontSize = opts.text.length > 22 ? 32 : opts.text.length > 16 ? 38 : opts.text.length > 11 ? 48 : 60;
      ctx2d.font = `bold ${fontSize}px Georgia, "Times New Roman", serif`;
      ctx2d.fillText(opts.text, 256, opts.subText ? 104 : 130, 444);
    }
    if (opts.subText) {
      ctx2d.font = 'bold 25px Georgia, "Times New Roman", serif';
      ctx2d.fillText(opts.subText, 256, opts.text ? 168 : 206, 434);
    }
  }

  ctx2d.restore();
}

/**
 * Generates a crisp Canvas-based Vietnamese signage / calligraphy / mural texture (Node/Vitest safe).
 */
export function createVietnamSignageTexture(
  opts: SignagePlaqueOptions,
  extraTextures?: THREE.Texture[]
): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return null;

  drawSignageToCanvas(ctx2d, 0, 0, opts);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  if (extraTextures) extraTextures.push(tex);
  return tex;
}

interface AtlasSheet {
  canvas: HTMLCanvasElement;
  ctx2d: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  nextSlot: number;
}

interface AtlasSlotRect {
  sheetIndex: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * Packs up to 32 Vietnamese signage plaques per 2048×2048 CanvasTexture sheet (4×8 cells of 512×256)
 * so dozens of plaques share a handful of textures and materials instead of creating 1 texture + 1 material each.
 */
export class SignageAtlas implements SignageAtlasLike {
  private static readonly COLS = 4;
  private static readonly ROWS = 8;
  private static readonly CELL_W = 512;
  private static readonly CELL_H = 256;
  private static readonly CAPACITY = 32;

  private readonly sheets: AtlasSheet[] = [];
  private readonly slotCache = new Map<string, AtlasSlotRect>();
  private readonly matCache = new Map<string, THREE.MeshStandardMaterial>();
  private reusedMaterials = 0;

  private allocateSlot(opts: SignagePlaqueOptions): AtlasSlotRect | null {
    if (typeof document === 'undefined') return null;
    const style = opts.style ?? 'royal';
    const key = [
      style,
      opts.text ?? '',
      opts.subText ?? '',
      opts.bgColor ?? '',
      opts.borderColor ?? '',
      opts.textColor ?? '',
      opts.motifSeed ?? 101
    ].join('|');

    const cached = this.slotCache.get(key);
    if (cached) return cached;

    let sheetIdx = this.sheets.length - 1;
    let sheet = sheetIdx >= 0 ? this.sheets[sheetIdx] : undefined;
    if (!sheet || sheet.nextSlot >= SignageAtlas.CAPACITY) {
      const canvas = document.createElement('canvas');
      canvas.width = SignageAtlas.COLS * SignageAtlas.CELL_W;
      canvas.height = SignageAtlas.ROWS * SignageAtlas.CELL_H;
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return null;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      sheet = { canvas, ctx2d, texture, nextSlot: 0 };
      this.sheets.push(sheet);
      sheetIdx = this.sheets.length - 1;
    }

    const slot = sheet.nextSlot++;
    const col = slot % SignageAtlas.COLS;
    const row = Math.floor(slot / SignageAtlas.COLS);
    drawSignageToCanvas(sheet.ctx2d, col * SignageAtlas.CELL_W, row * SignageAtlas.CELL_H, opts);
    sheet.texture.needsUpdate = true;

    const padU = 2 / sheet.canvas.width;
    const padV = 2 / sheet.canvas.height;
    const u0 = col / SignageAtlas.COLS + padU;
    const u1 = (col + 1) / SignageAtlas.COLS - padU;
    const v1 = 1.0 - row / SignageAtlas.ROWS - padV;
    const v0 = 1.0 - (row + 1) / SignageAtlas.ROWS + padV;

    const rect: AtlasSlotRect = { sheetIndex: sheetIdx, u0, v0, u1, v1 };
    this.slotCache.set(key, rect);
    return rect;
  }

  public getStats(): {
    sheets: number;
    cachedPlaques: number;
    materials: number;
    reusedMaterials: number;
  } {
    return {
      sheets: this.sheets.length,
      cachedPlaques: this.slotCache.size,
      materials: this.matCache.size,
      reusedMaterials: this.reusedMaterials
    };
  }

  public createPlaqueMesh(opts: SignagePlaqueOptions): THREE.Mesh {
    const w = opts.width ?? 3.2;
    const h = opts.height ?? 1.0;
    const d = opts.depth ?? 0.14;
    const style = opts.style ?? 'royal';
    const roughness = style === 'bronze' ? 0.38 : style === 'stone' ? 0.78 : 0.42;
    const metalness = style === 'bronze' || style === 'royal' ? 0.32 : 0.08;

    const geo = new THREE.BoxGeometry(w, h, d);
    const rect = this.allocateSlot(opts);
    let mat: THREE.MeshStandardMaterial;

    if (rect) {
      const uv = geo.attributes.uv;
      const du = rect.u1 - rect.u0;
      const dv = rect.v1 - rect.v0;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, rect.u0 + uv.getX(i) * du, rect.v0 + uv.getY(i) * dv);
      }
      uv.needsUpdate = true;

      const matKey = `atlas|${rect.sheetIndex}|${roughness.toFixed(2)}|${metalness.toFixed(2)}`;
      const existing = this.matCache.get(matKey);
      if (existing) {
        mat = existing;
        this.reusedMaterials++;
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          map: this.sheets[rect.sheetIndex].texture,
          roughness,
          metalness
        });
        mat.userData.sharedProtected = true;
        this.matCache.set(matKey, mat);
      }
    } else {
      const fallbackBg = opts.bgColor ?? '#8b1a16';
      const matKey = `fallback|${fallbackBg}|${roughness.toFixed(2)}|${metalness.toFixed(2)}`;
      const existing = this.matCache.get(matKey);
      if (existing) {
        mat = existing;
        this.reusedMaterials++;
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: fallbackBg,
          map: null,
          roughness,
          metalness
        });
        mat.userData.sharedProtected = true;
        this.matCache.set(matKey, mat);
      }
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  public dispose(): void {
    for (const mat of this.matCache.values()) {
      mat.dispose();
    }
    this.matCache.clear();
    for (const sheet of this.sheets) {
      sheet.texture.dispose();
    }
    this.sheets.length = 0;
    this.slotCache.clear();
    this.reusedMaterials = 0;
  }
}

/**
 * Creates a framed 3D plaque / signboard mesh with crisp Canvas calligraphy texture,
 * packed into `ctx.signageAtlas` when provided or tracked cleanly for deterministic GPU disposal.
 */
export function createSignagePlaqueMesh(
  opts: SignagePlaqueOptions,
  ctx?: Pick<VietnamBuilderContext, 'extraTextures' | 'extraMaterials' | 'signageAtlas'>
): THREE.Mesh {
  if (ctx?.signageAtlas) {
    return ctx.signageAtlas.createPlaqueMesh(opts);
  }
  const w = opts.width ?? 3.2;
  const h = opts.height ?? 1.0;
  const d = opts.depth ?? 0.14;
  const tex = createVietnamSignageTexture(opts, ctx?.extraTextures);
  const mat = new THREE.MeshStandardMaterial({
    color: tex ? '#ffffff' : opts.bgColor ?? '#8b1a16',
    map: tex,
    roughness: opts.style === 'bronze' ? 0.38 : opts.style === 'stone' ? 0.78 : 0.42,
    metalness: opts.style === 'bronze' || opts.style === 'royal' ? 0.32 : 0.08
  });
  if (ctx?.extraMaterials) ctx.extraMaterials.push(mat);
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Helper to transform a list of geometries by rotation Y and translation.
 */
function transformParts(
  parts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  rotY = 0
): THREE.BufferGeometry[] {
  for (const g of parts) {
    if (rotY !== 0) g.rotateY(rotY);
    g.translate(x, y, z);
  }
  return parts;
}

/**
 * Builds a connected, historically styled Vietnamese balustrade between p0 and p1 at base elevation y.
 * Fixes missing spindles / disconnected posts across Khuê Văn Các, Chùa Một Cột, Lũng Cú, Mũi Cà Mau, Huế.
 */
export function createPiercedBalustradeParts(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  height = 0.92,
  style:
    | 'con_tien'
    | 'chu_van'
    | 'lotus_stone'
    | 'bamboo_x'
    | 'gold_pipe'
    | 'hoa_chanh_ceramic' = 'con_tien'
): THREE.BufferGeometry[] {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.25) return [];

  const rotY = Math.atan2(dx, dz);
  const parts: THREE.BufferGeometry[] = [];

  const railW = style === 'gold_pipe' ? 0.06 : style === 'bamboo_x' ? 0.08 : style === 'hoa_chanh_ceramic' ? 0.18 : 0.14;
  const topRail = new THREE.BoxGeometry(railW * 1.15, railW * 0.85, len);
  topRail.translate(0, height - railW * 0.42, len * 0.5);
  parts.push(topRail);

  const botRail = new THREE.BoxGeometry(railW * 1.25, railW * 0.95, len);
  botRail.translate(0, railW * 0.5, len * 0.5);
  parts.push(botRail);

  const spacing =
    style === 'con_tien'
      ? 0.42
      : style === 'gold_pipe'
        ? 0.95
        : style === 'bamboo_x'
          ? 0.9
          : style === 'hoa_chanh_ceramic'
            ? 1.15
            : 0.85;
  const count = Math.max(2, Math.floor(len / spacing));
  const step = len / count;

  // Shared vase-shaped turned Vietnamese baluster profile (*con tiện bầu thắt eo*)
  const spH = Math.max(0.25, height - railW * 1.3);
  const vaseProf =
    style === 'con_tien'
      ? [
        new THREE.Vector2(0.036, 0),
        new THREE.Vector2(0.048, spH * 0.44),
        new THREE.Vector2(0.022, spH * 0.78),
        new THREE.Vector2(0.034, spH)
      ]
      : null;

  for (let i = 0; i <= count; i++) {
    const pz = i * step;
    if (style === 'con_tien' && vaseProf) {
      const sp = new THREE.LatheGeometry(vaseProf, 5);
      sp.translate(0, railW * 0.65, pz);
      parts.push(sp);
      if (i % 4 === 0 || i === count) {
        const post = new THREE.BoxGeometry(0.14, height + 0.10, 0.14);
        post.translate(0, (height + 0.10) * 0.5, pz);
        parts.push(post);
      }
    } else if (style === 'chu_van') {
      // Complete 4-arm interlocked Huế *chữ Vạn 卍* fretwork panel
      const post = new THREE.BoxGeometry(0.15, height + 0.06, 0.15);
      post.translate(0, (height + 0.06) * 0.5, pz);
      parts.push(post);
      if (i < count) {
        const midZ = pz + step * 0.5;
        const innerH = height - railW * 2.0;
        const armSpan = step * 0.72;
        const vBar = new THREE.BoxGeometry(0.07, innerH, 0.07);
        vBar.translate(0, height * 0.5, midZ);
        const hBar = new THREE.BoxGeometry(0.07, 0.07, armSpan);
        hBar.translate(0, height * 0.5, midZ);
        // All 4 swastika hooks (top-right, bottom-left, left-up, right-down)
        const hTop = new THREE.BoxGeometry(0.07, 0.07, armSpan * 0.45);
        hTop.translate(0, height * 0.5 + innerH * 0.46, midZ + armSpan * 0.22);
        const hBot = new THREE.BoxGeometry(0.07, 0.07, armSpan * 0.45);
        hBot.translate(0, height * 0.5 - innerH * 0.46, midZ - armSpan * 0.22);
        const vLeft = new THREE.BoxGeometry(0.07, innerH * 0.46, 0.07);
        vLeft.translate(0, height * 0.5 + innerH * 0.23, midZ - armSpan * 0.46);
        const vRight = new THREE.BoxGeometry(0.07, innerH * 0.46, 0.07);
        vRight.translate(0, height * 0.5 - innerH * 0.23, midZ + armSpan * 0.46);
        parts.push(vBar, hBar, hTop, hBot, vLeft, vRight);
      }
    } else if (style === 'hoa_chanh_ceramic') {
      // Stepped-cap masonry pillar + pierced 4-petal *gạch thông gió hoa chanh* panel (Văn Miếu, Chùa Một Cột, Ngọ Môn)
      const post = new THREE.BoxGeometry(0.24, height + 0.14, 0.24);
      post.translate(0, (height + 0.14) * 0.5, pz);
      const cap1 = new THREE.BoxGeometry(0.28, 0.06, 0.28);
      cap1.translate(0, height + 0.14, pz);
      const cap2 = new THREE.BoxGeometry(0.18, 0.06, 0.18);
      cap2.translate(0, height + 0.20, pz);
      parts.push(post, cap1, cap2);
      if (i < count) {
        const midZ = pz + step * 0.5;
        const innerH = height - railW * 2.0;
        // Pierced diamond + cross floral vent tile frame
        const ring = new THREE.TorusGeometry(Math.min(innerH, step * 0.72) * 0.34, 0.045, 5, 8);
        ring.rotateY(Math.PI * 0.5);
        ring.translate(0, height * 0.5, midZ);
        const diag1 = new THREE.BoxGeometry(0.08, innerH * 0.82, 0.06);
        diag1.rotateX(Math.PI * 0.25);
        diag1.translate(0, height * 0.5, midZ);
        const diag2 = new THREE.BoxGeometry(0.08, innerH * 0.82, 0.06);
        diag2.rotateX(-Math.PI * 0.25);
        diag2.translate(0, height * 0.5, midZ);
        parts.push(ring, diag1, diag2);
      }
    } else if (style === 'bamboo_x') {
      const post = new THREE.CylinderGeometry(0.045, 0.052, height + 0.08, 6);
      post.translate(0, (height + 0.08) * 0.5, pz);
      parts.push(post);
      if (i < count) {
        const diagLen = Math.hypot(step, height - 0.16);
        const tilt = Math.atan2(step, height - 0.16);
        const d1 = new THREE.CylinderGeometry(0.028, 0.028, diagLen, 5);
        d1.rotateX(tilt);
        d1.translate(0, height * 0.5, pz + step * 0.5);
        const d2 = new THREE.CylinderGeometry(0.028, 0.028, diagLen, 5);
        d2.rotateX(-tilt);
        d2.translate(0, height * 0.5, pz + step * 0.5);
        parts.push(d1, d2);
      }
    } else if (style === 'gold_pipe') {
      const post = new THREE.CylinderGeometry(0.032, 0.036, height, 6);
      post.translate(0, height * 0.5, pz);
      parts.push(post);
    } else {
      // lotus_stone: carved stone pillars + recessed octagonal-flower pierced relief panel
      const post = new THREE.BoxGeometry(0.20, height + 0.12, 0.20);
      post.translate(0, (height + 0.12) * 0.5, pz);
      parts.push(post);
      if (i < count) {
        const midZ = pz + step * 0.5;
        const innerH = height - railW * 2.0;
        const oct = new THREE.TorusGeometry(Math.min(innerH, step * 0.72) * 0.36, 0.05, 5, 8);
        oct.rotateY(Math.PI * 0.5);
        oct.translate(0, height * 0.5, midZ);
        const vRib = new THREE.BoxGeometry(0.07, innerH * 0.84, 0.06);
        vRib.translate(0, height * 0.5, midZ);
        const hRib = new THREE.BoxGeometry(0.07, 0.06, step * 0.74);
        hRib.translate(0, height * 0.5, midZ);
        parts.push(oct, vRib, hRib);
      }
    }
  }

  if (style === 'gold_pipe') {
    for (const frac of [0.30, 0.55, 0.78]) {
      const cable = new THREE.CylinderGeometry(0.018, 0.018, len, 6);
      cable.rotateX(Math.PI * 0.5);
      cable.translate(0, height * frac, len * 0.5);
      parts.push(cable);
    }
  }

  return transformParts(parts, x0, y, z0, rotY);
}

/**
 * Builds an ornate Vietnamese *Lưỡng Long Chầu Nguyệt* (twin dragons flanking flaming pearl)
 * + *Kìm Nóc* corner ridge finials resting atop a curved roof ridge.
 */
export function createRoofFinialSetParts(
  cx: number,
  ridgeY: number,
  cz: number,
  ridgeLen: number,
  rotY = 0,
  scale = 1.0,
  includePhoenixCorners = false
): { mainParts: THREE.BufferGeometry[]; goldParts: THREE.BufferGeometry[] } {
  const mainParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const s = scale;

  // Central flaming pearl (*Mặt Nguyệt / Hỏa Châu*) on lotus-cloud pedestal with openwork flame mandorla
  const ped = new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 0.20 * s, 8);
  ped.translate(0, 0.10 * s, 0);
  const pedCollar = new THREE.TorusGeometry(0.19 * s, 0.04 * s, 6, 12);
  pedCollar.rotateX(Math.PI * 0.5);
  pedCollar.translate(0, 0.18 * s, 0);
  goldParts.push(ped, pedCollar);

  const orb = new THREE.SphereGeometry(0.24 * s, 10, 8);
  orb.translate(0, 0.46 * s, 0);
  goldParts.push(orb);

  const halo = new THREE.TorusGeometry(0.35 * s, 0.045 * s, 7, 16);
  halo.translate(0, 0.46 * s, 0);
  const outerHalo = new THREE.TorusGeometry(0.45 * s, 0.028 * s, 6, 16, Math.PI * 1.35);
  outerHalo.rotateZ(-Math.PI * 0.175);
  outerHalo.translate(0, 0.46 * s, 0);
  goldParts.push(halo, outerHalo);

  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI * 1.35 - Math.PI * 0.175;
    const isApex = i === 4;
    const flame = new THREE.ConeGeometry((isApex ? 0.07 : 0.052) * s, (isApex ? 0.28 : 0.20) * s, 5);
    flame.rotateZ(a - Math.PI * 0.5);
    flame.translate(Math.cos(a) * 0.45 * s, 0.46 * s + Math.sin(a) * 0.45 * s, 0);
    goldParts.push(flame);
  }

  // Twin sculpted curving dragons (*Lưỡng Long Chầu Nguyệt*) with smooth continuous tapered bodies,
  // seamless lofted heads, cloud-scroll volutes, open jaws & animated Makara *Kìm Nóc* corner finials
  const halfReach = Math.min(ridgeLen * 0.44, 2.8 * s);
  for (const side of [-1, 1]) {
    const cloudScroll = new THREE.TorusGeometry(0.14 * s, 0.032 * s, 6, 10, Math.PI * 1.4);
    cloudScroll.translate(side * 0.28 * s, 0.20 * s, 0);
    // Twin symmetrical S-curved cloud-scroll volutes beneath the pearl cradle
    const innerScroll = new THREE.TorusGeometry(0.105 * s, 0.025 * s, 5, 10, Math.PI * 1.5);
    innerScroll.rotateZ(side * 0.65);
    innerScroll.translate(side * 0.16 * s, 0.16 * s, 0);
    goldParts.push(cloudScroll, innerScroll);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.50 * s, 0.50 * s, 0),
      new THREE.Vector3(side * (0.52 * s + halfReach * 0.24), 0.78 * s, 0),
      new THREE.Vector3(side * (0.52 * s + halfReach * 0.54), 0.28 * s, 0),
      new THREE.Vector3(side * (0.52 * s + halfReach * 0.80), 0.58 * s, 0),
      new THREE.Vector3(side * (0.52 * s + halfReach), 0.16 * s, 0)
    ]);
    const body = createSmoothTaperedTubeGeometry(
      curve,
      16,
      5,
      (t) => 0.108 * s * (0.78 + 0.32 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5)) * (1.0 - 0.82 * Math.pow(t, 1.55)),
      (t, theta) => {
        const upFactor = Math.max(0, Math.sin(theta));
        const crestWave = 0.5 + 0.5 * Math.sin(t * Math.PI * 10.0);
        return 1.0 + Math.pow(upFactor, 5.0) * (0.38 + 0.24 * crestWave) * (1.0 - t * 0.65);
      }
    );
    mainParts.push(body);

    // Smooth lofted dragon head + open curved jaws + tapered swept mane & curved antlers
    const headCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.58 * s, 0.52 * s, 0),
      new THREE.Vector3(side * 0.44 * s, 0.56 * s, 0),
      new THREE.Vector3(side * 0.28 * s, 0.55 * s, 0)
    ]);
    goldParts.push(
      createSmoothTaperedTubeGeometry(headCurve, 5, 5, (t) => (0.125 - t * 0.055) * s)
    );
    const jawCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.52 * s, 0.44 * s, 0),
      new THREE.Vector3(side * 0.34 * s, 0.40 * s, 0)
    ]);
    goldParts.push(
      createSmoothTaperedTubeGeometry(jawCurve, 3, 4, (t) => (0.068 - t * 0.032) * s)
    );
    const maneCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.54 * s, 0.58 * s, 0),
      new THREE.Vector3(side * 0.66 * s, 0.74 * s, 0),
      new THREE.Vector3(side * 0.78 * s, 0.70 * s, 0)
    ]);
    goldParts.push(
      createSmoothTaperedTubeGeometry(maneCurve, 4, 4, (t) => (0.072 * (1.0 - t * 0.78)) * s)
    );
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.50 * s, 0.60 * s, 0),
      new THREE.Vector3(side * 0.62 * s, 0.78 * s, 0),
      new THREE.Vector3(side * 0.74 * s, 0.86 * s, 0)
    ]);
    goldParts.push(
      createSmoothTaperedTubeGeometry(hornCurve, 4, 4, (t) => (0.036 * (1.0 - t * 0.80)) * s)
    );

    // Front and rear curved clawed legs gripping the ridge beam
    for (const legT of [0.22, 0.62]) {
      const lPt = curve.getPoint(legT);
      const legCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(lPt.x, lPt.y, 0),
        new THREE.Vector3(lPt.x - side * 0.06 * s, lPt.y * 0.48, 0.05 * s),
        new THREE.Vector3(lPt.x - side * 0.02 * s, 0.04 * s, 0)
      ]);
      goldParts.push(
        createSmoothTaperedTubeGeometry(legCurve, 3, 4, (t) => (0.052 - t * 0.016) * s)
      );
    }

    // *Kìm Nóc* (sculpted S-curved dragon-fish Makara biting the ridge beam with bifurcated twin-scroll fishtail)
    const endX = side * (ridgeLen * 0.48);
    const kimCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(endX - side * 0.08 * s, 0.06 * s, 0),
      new THREE.Vector3(endX + side * 0.04 * s, 0.34 * s, 0),
      new THREE.Vector3(endX + side * 0.16 * s, 0.56 * s, 0),
      new THREE.Vector3(endX + side * 0.06 * s, 0.72 * s, 0)
    ]);
    const kimBody = createSmoothTaperedTubeGeometry(kimCurve, 7, 5, (t) => (0.165 - t * 0.095) * s);
    const kimTailA = new THREE.ConeGeometry(0.085 * s, 0.30 * s, 5);
    kimTailA.rotateZ(-side * 0.72);
    kimTailA.translate(endX + side * 0.14 * s, 0.78 * s, 0);
    const kimTailB = new THREE.ConeGeometry(0.075 * s, 0.26 * s, 5);
    kimTailB.rotateZ(side * 0.38);
    kimTailB.translate(endX - side * 0.04 * s, 0.76 * s, 0);
    const kimScroll = new THREE.TorusGeometry(0.115 * s, 0.032 * s, 5, 10, Math.PI * 1.35);
    kimScroll.translate(endX - side * 0.08 * s, 0.36 * s, 0);
    goldParts.push(kimBody, kimTailA, kimTailB, kimScroll);

    if (includePhoenixCorners) {
      const phBody = new THREE.ConeGeometry(0.11 * s, 0.46 * s, 6);
      phBody.rotateZ(side * 0.55);
      phBody.translate(endX + side * 0.28 * s, 0.36 * s, 0);
      const phTail = new THREE.ConeGeometry(0.07 * s, 0.32 * s, 5);
      phTail.rotateZ(side * 0.82);
      phTail.translate(endX + side * 0.42 * s, 0.52 * s, 0);
      goldParts.push(phBody, phTail);
    }
  }

  transformParts(mainParts, cx, ridgeY, cz, rotY);
  transformParts(goldParts, cx, ridgeY, cz, rotY);
  return { mainParts, goldParts };
}

/**
 * Builds a high-detail Lê Dynasty / Imperial carved stone dragon balustrade (*Rồng đá Điện Kính Thiên / Đền Hùng / Huế*).
 */
export function createCarvedDragonBalustradeParts(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  scale = 1.0
): THREE.BufferGeometry[] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const horizLen = Math.max(0.5, Math.hypot(dx, dz));
  const rotY = Math.atan2(dx, dz);
  const s = scale;
  const parts: THREE.BufferGeometry[] = [];

  // Continuous monolithic sloped carved curb wall with raised cloud/lotus side relief panels
  const curbShape = new THREE.Shape();
  curbShape.moveTo(0, -0.22 * s);
  curbShape.lineTo(horizLen, dy - 0.22 * s);
  curbShape.lineTo(horizLen, dy + 0.56 * s);
  curbShape.lineTo(0, 0.56 * s);
  curbShape.closePath();
  const curbWall = new THREE.ExtrudeGeometry(curbShape, { depth: 0.44 * s, bevelEnabled: false });
  curbWall.rotateY(-Math.PI * 0.5);
  curbWall.translate(0.22 * s, 0, 0);
  parts.push(curbWall);

  // Raised carved S-scroll cloud-and-lotus relief medallions along both flanks of the sloped curb
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const my = dy * t + 0.20 * s;
    const mz = horizLen * t;
    for (const sx of [-1, 1]) {
      const ring = new THREE.TorusGeometry(0.115 * s, 0.028 * s, 4, 8, Math.PI * 1.45);
      ring.rotateY(Math.PI * 0.5);
      ring.rotateZ(sx * 0.4);
      ring.translate(sx * 0.22 * s, my, mz);
      const boss = new THREE.SphereGeometry(0.065 * s, 5, 4);
      boss.scale(0.45, 1.0, 1.0);
      boss.translate(sx * 0.23 * s, my, mz);
      parts.push(ring, boss);
    }
  }

  // Smooth continuous tapered undulating dragon spine with integrated dorsal ridge crest (ZERO kinked/segmented look!)
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const undulY = Math.sin(t * Math.PI * 5.0) * 0.16 * s * (1.0 - t * 0.35);
    const undulX = Math.sin(t * Math.PI * 2.5) * 0.065 * s * (1.0 - t * 0.35);
    pts.push(new THREE.Vector3(undulX, dy * t + 0.64 * s + undulY, horizLen * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const spine = createSmoothTaperedTubeGeometry(
    curve,
    20,
    6,
    (t) => 0.245 * s * (0.92 + 0.14 * Math.sin(Math.min(1, t * 2.4) * Math.PI)) * (1.0 - 0.78 * Math.pow(t, 1.5)),
    (t, theta) => {
      const upFactor = Math.max(0, Math.sin(theta));
      const finWave = 0.5 + 0.5 * Math.sin(t * Math.PI * 16.0);
      return 1.0 + Math.pow(upFactor, 5.0) * (0.36 + 0.22 * finWave) * (1.0 - t * 0.6);
    }
  );
  parts.push(spine);

  // Smooth lofted Lê-dynasty organic dragon head flowing directly from neck at base (z ≈ 0, facing -Z)
  const headY = 0.74 * s;
  const headLoftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, headY - 0.06 * s, 0.06 * s),
    new THREE.Vector3(0, headY + 0.04 * s, -0.22 * s),
    new THREE.Vector3(0, headY - 0.01 * s, -0.52 * s),
    new THREE.Vector3(0, headY + 0.08 * s, -0.74 * s)
  ]);
  parts.push(
    createSmoothTaperedTubeGeometry(headLoftCurve, 6, 6, (t) => {
      const bulge = Math.sin(t * Math.PI);
      return (0.25 + 0.11 * bulge - t * 0.11) * s;
    })
  );
  const lowerJawCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, headY - 0.16 * s, -0.14 * s),
    new THREE.Vector3(0, headY - 0.24 * s, -0.46 * s),
    new THREE.Vector3(0, headY - 0.20 * s, -0.68 * s)
  ]);
  parts.push(
    createSmoothTaperedTubeGeometry(lowerJawCurve, 4, 4, (t) => (0.165 - t * 0.075) * s)
  );
  const pearl = new THREE.SphereGeometry(0.11 * s, 6, 4);
  pearl.translate(0, headY - 0.10 * s, -0.76 * s);
  parts.push(pearl);

  // Swept tapered cloud-wave mane ribbons behind head + curved forked horns + spiraled whiskers
  for (const sx of [-1, 1]) {
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.16 * s, headY + 0.20 * s, -0.04 * s),
      new THREE.Vector3(sx * 0.24 * s, headY + 0.42 * s, 0.20 * s),
      new THREE.Vector3(sx * 0.20 * s, headY + 0.58 * s, 0.50 * s)
    ]);
    parts.push(createSmoothTaperedTubeGeometry(hornCurve, 5, 4, (t) => (0.056 * (1.0 - t * 0.72)) * s));

    // Thick swept tapered cloud-flame mane behind cheek
    const maneCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.26 * s, headY + 0.06 * s, -0.04 * s),
      new THREE.Vector3(sx * 0.34 * s, headY + 0.22 * s, 0.34 * s),
      new THREE.Vector3(sx * 0.24 * s, headY + 0.12 * s, 0.72 * s)
    ]);
    parts.push(createSmoothTaperedTubeGeometry(maneCurve, 5, 4, (t) => (0.095 * (1.0 - t * 0.76)) * s));

    // Continuous curved whisker
    const whiskCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.18 * s, headY - 0.05 * s, -0.58 * s),
      new THREE.Vector3(sx * 0.34 * s, headY - 0.08 * s, -0.70 * s),
      new THREE.Vector3(sx * 0.38 * s, headY - 0.16 * s, -0.44 * s),
      new THREE.Vector3(sx * 0.26 * s, headY - 0.10 * s, -0.26 * s)
    ]);
    parts.push(createSmoothTaperedTubeGeometry(whiskCurve, 5, 4, (t) => (0.028 * (1.0 - t * 0.62)) * s));

    const eye = new THREE.SphereGeometry(0.068 * s, 6, 5);
    eye.translate(sx * 0.24 * s, headY + 0.09 * s, -0.34 * s);

    // Front & rear muscular curved clawed dragon legs gripping the sloped stone balustrade
    const frontLegCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.16 * s, 0.58 * s, 0.24 * s),
      new THREE.Vector3(sx * 0.29 * s, 0.36 * s, 0.26 * s),
      new THREE.Vector3(sx * 0.24 * s, 0.12 * s, 0.16 * s)
    ]);
    parts.push(createSmoothTaperedTubeGeometry(frontLegCurve, 5, 4, (t) => (0.092 - t * 0.024) * s));
    for (let c = -1; c <= 1; c++) {
      const talon = new THREE.ConeGeometry(0.026 * s, 0.13 * s, 4);
      talon.rotateX(-Math.PI * 0.48);
      talon.rotateY(c * 0.38);
      talon.translate(sx * (0.24 + c * 0.04) * s, 0.10 * s, 0.08 * s);
      parts.push(talon);
    }

    const rearT = 0.68;
    const rearY = dy * rearT + 0.36 * s;
    const rearZ = horizLen * rearT;
    const rearLegCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.15 * s, rearY + 0.26 * s, rearZ),
      new THREE.Vector3(sx * 0.28 * s, rearY, rearZ + 0.04 * s),
      new THREE.Vector3(sx * 0.23 * s, rearY - 0.22 * s, rearZ - 0.06 * s)
    ]);
    parts.push(createSmoothTaperedTubeGeometry(rearLegCurve, 5, 4, (t) => (0.084 - t * 0.022) * s));
    for (let c = -1; c <= 1; c++) {
      const talonR = new THREE.ConeGeometry(0.024 * s, 0.12 * s, 4);
      talonR.rotateX(-Math.PI * 0.48);
      talonR.rotateY(c * 0.36);
      talonR.translate(sx * (0.23 + c * 0.035) * s, rearY - 0.23 * s, rearZ - 0.14 * s);
      parts.push(talonR);
    }
    parts.push(eye);
  }

  // Spiraled cloud-flame tail crest & stepped lotus-petal tail collar at the upper landing (z = horizLen)
  const tailCurl = new THREE.TorusGeometry(0.18 * s, 0.055 * s, 5, 10, Math.PI * 1.35);
  tailCurl.rotateY(Math.PI * 0.5);
  tailCurl.translate(0, dy + 0.78 * s, horizLen - 0.08 * s);
  const tailCollar = new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 0.14 * s, 6);
  tailCollar.translate(0, dy + 0.54 * s, horizLen - 0.08 * s);
  parts.push(tailCurl, tailCollar);

  return transformParts(parts, x0, y0, z0, rotY);
}

/**
 * Builds a carved stone tortoise bearing a Doctor's Stele (*Rùa đá & Bia Tiến sĩ Văn Miếu*)
 * with hexagonal carapace ribs, head, 4 legs, tail, and arched-forehead stele frame.
 */
export function createCarvedTurtleSteleParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  scale = 1.0
): THREE.BufferGeometry[] {
  const s = scale;
  const parts: THREE.BufferGeometry[] = [];

  // Low rectangular stone pad
  const pad = new THREE.BoxGeometry(1.18 * s, 0.14 * s, 1.48 * s);
  pad.translate(0, 0.07 * s, 0);
  parts.push(pad);

  // FIX KVC-06: Authentic flat monolithic Văn Miếu tortoise (scaleY = 0.46) with carved hexagonal scute ridges & rounded head (ref 47!)
  const shellDome = new THREE.SphereGeometry(0.62 * s, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.54);
  shellDome.scale(0.94, 0.46, 1.24);
  shellDome.translate(0, 0.16 * s, 0);
  const shellRim = new THREE.CylinderGeometry(0.56 * s, 0.62 * s, 0.12 * s, 6);
  shellRim.scale(0.94, 1.0, 1.24);
  shellRim.translate(0, 0.18 * s, 0);
  parts.push(shellDome, shellRim);

  // 4 broad splayed webbed feet gripping the stone pad
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.SphereGeometry(0.15 * s, 5, 4);
      leg.scale(1.15, 0.62, 1.42);
      leg.translate(sx * 0.46 * s, 0.18 * s, sz * 0.44 * s);
      parts.push(leg);
    }
  }
  // Rounded head nestled closely under front shell rim (authentic Văn Miếu silhouette)
  const head = new THREE.SphereGeometry(0.17 * s, 6, 5);
  head.scale(0.98, 0.84, 1.26);
  head.translate(0, 0.30 * s, 0.72 * s);
  const tail = new THREE.ConeGeometry(0.055 * s, 0.16 * s, 4);
  tail.rotateX(-Math.PI * 0.45);
  tail.translate(0, 0.19 * s, -0.72 * s);
  parts.push(head, tail);

  // Upright stele slab with arched dragon-cloud forehead (*trán bia lưỡng long chầu nguyệt*)
  const steleW = 0.74 * s;
  const steleH = 1.28 * s;
  const steleD = 0.18 * s;
  const slab = new THREE.BoxGeometry(steleW, steleH, steleD);
  slab.translate(0, 0.50 * s + steleH * 0.5, 0);
  const crown = new THREE.CylinderGeometry(steleW * 0.5, steleW * 0.5, steleD * 1.12, 8, 1, false, 0, Math.PI);
  crown.rotateZ(Math.PI * 0.5);
  crown.rotateY(Math.PI * 0.5);
  crown.translate(0, 0.50 * s + steleH, 0);
  // Sculpted forehead sun orb & twin relief borders
  const sunOrb = new THREE.SphereGeometry(0.095 * s, 5, 4);
  sunOrb.scale(1.0, 1.0, 0.45);
  sunOrb.translate(0, 0.50 * s + steleH + 0.12 * s, steleD * 0.56);
  parts.push(sunOrb);
  for (const sx of [-1, 1]) {
    const border = new THREE.BoxGeometry(0.075 * s, steleH * 0.94, steleD * 1.20);
    border.translate(sx * (steleW * 0.46), 0.50 * s + steleH * 0.5, 0);
    parts.push(border);
  }
  parts.push(slab, crown);

  return transformParts(parts, cx, y, cz, rotY);
}

/**
 * Builds sculpted Vietnamese guardian beasts & wooden shrine statues:
 * - 'nghe' / 'kylan': Seated mythical guardian beast on carved pedestal (Đền Hùng, Ngọ Môn, Đường Lâm)
 * - 'dog' / 'monkey': Sacred wooden guardians of Chùa Cầu Hội An
 * - 'dvarapala': Chăm Pa temple gate guardian holding club (Mỹ Sơn)
 */
export function createGuardianBeastParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  scale = 1.0,
  type: 'nghe' | 'kylan' | 'dog' | 'monkey' | 'dvarapala' = 'nghe'
): THREE.BufferGeometry[] {
  const s = scale;
  const parts: THREE.BufferGeometry[] = [];

  // Stepped carved plinth
  const base = new THREE.BoxGeometry(0.76 * s, 0.18 * s, 0.86 * s);
  base.translate(0, 0.09 * s, 0);
  parts.push(base);

  if (type === 'dvarapala') {
    const torso = new THREE.CylinderGeometry(0.24 * s, 0.28 * s, 0.62 * s, 8);
    torso.translate(0, 0.64 * s, 0);
    const legs = new THREE.BoxGeometry(0.46 * s, 0.24 * s, 0.36 * s);
    legs.translate(0, 0.28 * s, 0);
    const head = new THREE.SphereGeometry(0.18 * s, 8, 7);
    head.translate(0, 1.08 * s, 0);
    const crown = new THREE.ConeGeometry(0.16 * s, 0.32 * s, 6);
    crown.translate(0, 1.34 * s, 0);
    const club = new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.92 * s, 7);
    club.translate(0.28 * s, 0.64 * s, 0.14 * s);
    const lArm = new THREE.CylinderGeometry(0.065 * s, 0.075 * s, 0.42 * s, 6);
    lArm.rotateZ(0.45);
    lArm.translate(-0.26 * s, 0.72 * s, 0.08 * s);
    parts.push(torso, legs, head, crown, club, lArm);
  } else if (type === 'monkey') {
    // FIX CC-06: Distinct hunched seated Sacred Monkey (*Tượng Khỉ / Thân*) with round ears, peach in paws & curled tail (ref 56!)
    const haunch = new THREE.SphereGeometry(0.22 * s, 7, 5);
    haunch.scale(1.0, 0.95, 1.15);
    haunch.translate(0, 0.34 * s, -0.06 * s);
    const chest = new THREE.CylinderGeometry(0.16 * s, 0.20 * s, 0.40 * s, 7);
    chest.rotateX(0.42);
    chest.translate(0, 0.56 * s, 0.08 * s);
    const head = new THREE.SphereGeometry(0.155 * s, 8, 6);
    head.translate(0, 0.84 * s, 0.16 * s);
    const muzzle = new THREE.SphereGeometry(0.08 * s, 6, 5);
    muzzle.scale(1.0, 0.85, 1.15);
    muzzle.translate(0, 0.79 * s, 0.28 * s);
    // Peach fruit cradled between folded forepaws
    const peach = new THREE.SphereGeometry(0.085 * s, 6, 5);
    peach.translate(0, 0.56 * s, 0.28 * s);
    parts.push(haunch, chest, head, muzzle, peach);
    for (const sx of [-1, 1]) {
      // Round monkey ears tucked on sides of head (NO pointed dog cones!)
      const rEar = new THREE.SphereGeometry(0.048 * s, 5, 4);
      rEar.translate(sx * 0.155 * s, 0.86 * s, 0.15 * s);
      const arm = new THREE.CylinderGeometry(0.045 * s, 0.052 * s, 0.34 * s, 5);
      arm.rotateX(-0.65);
      arm.rotateZ(sx * 0.28);
      arm.translate(sx * 0.12 * s, 0.58 * s, 0.20 * s);
      parts.push(rEar, arm);
    }
    const mTail = new THREE.TorusGeometry(0.18 * s, 0.028 * s, 5, 8, Math.PI * 1.15);
    mTail.rotateY(Math.PI * 0.5);
    mTail.translate(0, 0.46 * s, -0.24 * s);
    parts.push(mTail);
  } else {
    // Haunches + upright chest (Dog, Nghê, Kỳ Lân)
    const haunch = new THREE.SphereGeometry(0.24 * s, 8, 6);
    haunch.scale(1.0, 0.92, 1.25);
    haunch.translate(0, 0.36 * s, -0.10 * s);
    const chest = new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 0.44 * s, 8);
    chest.rotateX(0.28);
    chest.translate(0, 0.58 * s, 0.08 * s);
    parts.push(haunch, chest);

    // Front legs
    for (const sx of [-1, 1]) {
      const fLeg = new THREE.CylinderGeometry(0.055 * s, 0.065 * s, 0.42 * s, 6);
      fLeg.translate(sx * 0.14 * s, 0.36 * s, 0.24 * s);
      parts.push(fLeg);
    }

    // Head, snout, ears & characteristic silhouette
    const head = new THREE.SphereGeometry(0.17 * s, 9, 7);
    head.translate(0, 0.88 * s, 0.18 * s);
    const snoutLen = type === 'dog' ? 0.22 * s : 0.16 * s;
    const snout = new THREE.BoxGeometry(0.16 * s, 0.12 * s, snoutLen);
    snout.translate(0, 0.84 * s, 0.28 * s + snoutLen * 0.35);
    parts.push(head, snout);

    for (const sx of [-1, 1]) {
      const ear = new THREE.ConeGeometry(0.055 * s, 0.14 * s, 5);
      ear.rotateZ(-sx * 0.35);
      ear.translate(sx * 0.14 * s, 1.02 * s, 0.14 * s);
      parts.push(ear);
    }

    if (type === 'nghe' || type === 'kylan') {
      // Sculpted curly mane collar & flame tail
      const mane = new THREE.TorusGeometry(0.17 * s, 0.055 * s, 6, 10);
      mane.rotateX(Math.PI * 0.42);
      mane.translate(0, 0.78 * s, 0.14 * s);
      const tail = new THREE.ConeGeometry(0.07 * s, 0.36 * s, 5);
      tail.rotateX(-0.55);
      tail.translate(0, 0.56 * s, -0.34 * s);
      parts.push(mane, tail);
    }
  }

  return transformParts(parts, cx, y, cz, rotY);
}

/**
 * Builds sculpted sacred statues (Amitabha Buddha, Quan Âm, Goddess Po Nagar, Virgin Mary)
 * with multi-whorl pointed lotus thrones, layered draped robes, mudra arms, and aureole halos.
 */
export function createSculptedDeityParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  scale = 1.0,
  type: 'amitabha' | 'quanam' | 'ponagar' | 'virgin_mary' = 'amitabha',
  options?: { skipHalo?: boolean; simpleQuanAm?: boolean }
): { bodyParts: THREE.BufferGeometry[]; accentParts: THREE.BufferGeometry[] } {
  const s = scale;
  const skipHalo = options?.skipHalo ?? (type === 'virgin_mary');
  const simpleQuanAm = options?.simpleQuanAm ?? false;
  const bodyParts: THREE.BufferGeometry[] = [];
  const accentParts: THREE.BufferGeometry[] = [];

  if (type === 'virgin_mary') {
    // Standing Our Lady of Peace (*Đức Mẹ Hòa Bình*) with draped robe & globe held in hands (no metal halo!)
    const robeProfile = [
      new THREE.Vector2(0.46 * s, 0.0),
      new THREE.Vector2(0.42 * s, 0.55 * s),
      new THREE.Vector2(0.36 * s, 1.15 * s),
      new THREE.Vector2(0.32 * s, 1.65 * s),
      new THREE.Vector2(0.38 * s, 2.05 * s),
      new THREE.Vector2(0.24 * s, 2.38 * s),
      new THREE.Vector2(0.12 * s, 2.48 * s)
    ];
    const robe = new THREE.LatheGeometry(robeProfile, 16);
    bodyParts.push(robe);

    // Draped mantle veil & arms holding globe (*Quả địa cầu*)
    const veil = new THREE.CylinderGeometry(0.18 * s, 0.36 * s, 1.15 * s, 10, 1, false, Math.PI * 0.25, Math.PI * 1.5);
    veil.translate(0, 2.24 * s, -0.04 * s);
    const head = new THREE.SphereGeometry(0.18 * s, 10, 8);
    head.translate(0, 2.66 * s, 0.02 * s);
    bodyParts.push(veil, head);

    for (const sx of [-1, 1]) {
      const arm = new THREE.CylinderGeometry(0.065 * s, 0.075 * s, 0.58 * s, 7);
      arm.rotateZ(-sx * 0.42);
      arm.rotateX(0.55);
      arm.translate(sx * 0.20 * s, 1.98 * s, 0.24 * s);
      bodyParts.push(arm);
    }

    const globe = new THREE.SphereGeometry(0.19 * s, 10, 8);
    globe.translate(0, 1.82 * s, 0.36 * s);
    bodyParts.push(globe);

    const miniCrossV = new THREE.BoxGeometry(0.03 * s, 0.18 * s, 0.03 * s);
    miniCrossV.translate(0, 2.08 * s, 0.36 * s);
    const miniCrossH = new THREE.BoxGeometry(0.12 * s, 0.03 * s, 0.03 * s);
    miniCrossH.translate(0, 2.12 * s, 0.36 * s);
    accentParts.push(miniCrossV, miniCrossH);
    if (!skipHalo) {
      const halo = new THREE.TorusGeometry(0.29 * s, 0.022 * s, 6, 20);
      halo.translate(0, 2.70 * s, -0.10 * s);
      accentParts.push(halo);
    }
  } else {
    // Seated Buddha / Quan Âm / Goddess Po Nagar atop a 3-layer plump rounded lotus throne
    const dais = new THREE.CylinderGeometry(0.96 * s, 1.12 * s, 0.36 * s, 16);
    dais.translate(0, 0.18 * s, 0);
    bodyParts.push(dais);

    // 3 whorls of sculpted plump rounded lotus petals around throne (authentic Trần/Nguyễn style)
    for (let ring = 0; ring < 3; ring++) {
      const nPetals = ring === 0 ? 12 : ring === 1 ? 10 : 8;
      const rad = (1.02 - ring * 0.11) * s;
      const py = (0.34 + ring * 0.11) * s;
      for (let i = 0; i < nPetals; i++) {
        const a = (i / nPetals) * Math.PI * 2 + ring * 0.20;
        const p = new THREE.SphereGeometry(0.18 * s, 5, 4);
        p.scale(0.95, 1.38, 0.42);
        p.rotateX(ring === 0 ? 0.42 : ring === 1 ? 0.24 : 0.12);
        p.rotateY(a);
        p.translate(Math.sin(a) * rad, py, Math.cos(a) * rad);
        (ring === 2 ? accentParts : bodyParts).push(p);
      }
    }

    const seatY = 0.58 * s;
    // Crossed lotus-position knees
    const knees = new THREE.CylinderGeometry(0.76 * s, 0.88 * s, 0.44 * s, 14);
    knees.scale(1.12, 1.0, 0.86);
    knees.translate(0, seatY + 0.22 * s, 0.04 * s);
    bodyParts.push(knees);

    // Sculpted draped torso (*Áo cà sa*) via LatheGeometry + diagonal sash fold
    const torsoProfile = [
      new THREE.Vector2(0.58 * s, 0.0),
      new THREE.Vector2(0.50 * s, 0.36 * s),
      new THREE.Vector2(0.54 * s, 0.82 * s),
      new THREE.Vector2(0.46 * s, 1.12 * s),
      new THREE.Vector2(0.20 * s, 1.26 * s)
    ];
    const torso = new THREE.LatheGeometry(torsoProfile, 14);
    torso.scale(1.08, 1.0, 0.82);
    torso.translate(0, seatY + 0.38 * s, 0);
    bodyParts.push(torso);

    // Draped shoulder sash fold
    const sash = new THREE.TorusGeometry(0.46 * s, 0.065 * s, 6, 14, Math.PI * 1.15);
    sash.rotateZ(0.58);
    sash.translate(0.02 * s, seatY + 1.02 * s, 0.16 * s);
    bodyParts.push(sash);

    // Shoulder robe folds + bent arms resting in meditation mudra
    for (const sx of [-1, 1]) {
      const upperArm = new THREE.CylinderGeometry(0.12 * s, 0.14 * s, 0.62 * s, 8);
      upperArm.rotateZ(sx * 0.22);
      upperArm.translate(sx * 0.52 * s, seatY + 0.96 * s, 0.06 * s);
      const foreArm = new THREE.CylinderGeometry(0.10 * s, 0.11 * s, 0.52 * s, 7);
      foreArm.rotateZ(Math.PI * 0.44 * sx);
      foreArm.translate(sx * 0.24 * s, seatY + 0.62 * s, 0.30 * s);
      bodyParts.push(upperArm, foreArm);
    }

    // Head, elongated earlobes, facial nose/brow relief, ushnisha / Mukuta crown
    const headY = seatY + 1.84 * s;
    const head = new THREE.SphereGeometry(0.28 * s, 12, 10);
    head.scale(0.94, 1.08, 0.96);
    head.translate(0, headY, 0.04 * s);
    const nose = new THREE.ConeGeometry(0.036 * s, 0.10 * s, 5);
    nose.rotateX(0.32);
    nose.translate(0, headY - 0.01 * s, 0.30 * s);
    bodyParts.push(head, nose);

    for (const sx of [-1, 1]) {
      const ear = new THREE.SphereGeometry(0.055 * s, 6, 5);
      ear.scale(0.55, 1.95, 0.72);
      ear.translate(sx * 0.26 * s, headY - 0.06 * s, 0.02 * s);
      bodyParts.push(ear);
    }

    if (type === 'ponagar') {
      // Multi-tiered Chăm Mukuta conical crown + 10 radiating arms
      const crown = new THREE.ConeGeometry(0.20 * s, 0.54 * s, 8);
      crown.translate(0, headY + 0.44 * s, 0.02 * s);
      accentParts.push(crown);
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const ang = -0.55 + k * 0.36;
          const arm = new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 0.62 * s, 6);
          arm.rotateZ(sx * (1.15 - k * 0.22));
          arm.translate(sx * (0.58 + k * 0.06) * s, seatY + 0.85 * s + ang * 0.55 * s, -0.05 * s);
          bodyParts.push(arm);
        }
      }
    } else {
      const ushnisha = new THREE.SphereGeometry(0.13 * s, 8, 6);
      ushnisha.translate(0, headY + 0.28 * s, 0.02 * s);
      bodyParts.push(ushnisha);
      if (type === 'quanam' && !simpleQuanAm) {
        for (let k = 0; k < 8; k++) {
          const a = -1.25 + (k / 7) * 2.5;
          const arm = new THREE.CylinderGeometry(0.042 * s, 0.05 * s, 0.68 * s, 6);
          arm.rotateZ(a);
          arm.translate(-Math.sin(a) * 0.58 * s, seatY + 1.10 * s + Math.cos(a) * 0.38 * s, -0.10 * s);
          accentParts.push(arm);
        }
      }
    }

    // Optional leaf-shaped aureole (*Lá đề hào quang*) — skipped for Fansipan Amitabha!
    if (!skipHalo) {
      const halo = new THREE.TorusGeometry(0.68 * s, 0.045 * s, 7, 22);
      halo.scale(0.88, 1.18, 1.0);
      halo.translate(0, headY - 0.04 * s, -0.26 * s);
      accentParts.push(halo);
    }
  }

  transformParts(bodyParts, cx, y, cz, rotY);
  transformParts(accentParts, cx, y, cz, rotY);
  return { bodyParts, accentParts };
}

/**
 * Builds sculpted timber lotus-bracket truss (*Hệ đấu củng / bệ sen* for Chùa Một Cột & historic halls).
 */
export function createTimberBracketSetParts(
  cx: number,
  y: number,
  cz: number,
  reach = 2.25,
  arms = 12
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    // 3 stepped corbelled *đấu củng* tiers + slanted main diagonal bracket
    for (let tier = 0; tier < 3; tier++) {
      const tLen = reach * (0.42 + tier * 0.26);
      const b = new THREE.BoxGeometry(0.16, 0.14, tLen);
      b.translate(0, 0.25 + tier * 0.24, tLen * 0.5);
      b.rotateY(a);
      parts.push(b);
    }
    const strut = new THREE.BoxGeometry(0.14, 0.18, reach * 1.12);
    strut.rotateX(-0.48);
    strut.translate(0, 0.45, reach * 0.52);
    strut.rotateY(a);
    parts.push(strut);
  }
  return transformParts(parts, cx, y, cz, 0);
}

/**
 * Builds octagonal Hội An Door Eyes (*Mắt cửa Hội An*) mounted in pairs above ancient wooden doorways.
 */
export function createHoiAnDoorEyesParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  spacing = 1.05,
  radius = 0.16
): { woodParts: THREE.BufferGeometry[]; goldParts: THREE.BufferGeometry[] } {
  // FIX HA-05: Carved 8-petal Bát Quái spiral door-eye boss + draped pleated swallowtail silk ribbons beneath each eye (ref 55!)
  const woodParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  for (const sx of [-0.5, 0.5]) {
    const ox = sx * spacing;
    const frame = new THREE.CylinderGeometry(radius, radius * 1.12, 0.08, 8);
    frame.rotateX(Math.PI * 0.5);
    frame.translate(ox, 0, 0.04);
    woodParts.push(frame);

    const boss = new THREE.SphereGeometry(radius * 0.44, 8, 5);
    boss.scale(1.0, 1.0, 0.52);
    boss.translate(ox, 0, 0.09);
    goldParts.push(boss);

    const ring = new THREE.TorusGeometry(radius * 0.78, radius * 0.11, 5, 8);
    ring.translate(ox, 0, 0.08);
    goldParts.push(ring);

    // 4 Radial yin-yang spiral spoke ribs radiating around center boss
    for (let r = 0; r < 4; r++) {
      const spoke = new THREE.BoxGeometry(radius * 1.35, radius * 0.11, 0.03);
      spoke.rotateZ((r / 4) * Math.PI);
      spoke.translate(ox, 0, 0.088);
      goldParts.push(spoke);
    }
    // Draped pleated swallowtail red-gold silk ribbon pair hanging under door eye
    for (const rs of [-1, 1]) {
      const ribbon = new THREE.BoxGeometry(radius * 0.34, radius * 1.65, 0.025);
      ribbon.rotateZ(rs * 0.22);
      ribbon.translate(ox + rs * radius * 0.36, -radius * 1.25, 0.065);
      goldParts.push(ribbon);
    }
  }
  transformParts(woodParts, cx, y, cz, rotY);
  transformParts(goldParts, cx, y, cz, rotY);
  return { woodParts, goldParts };
}

/**
 * Builds a traditional Huế bronze dynastic urn (*Cửu Đỉnh / Vạc Đồng*) with 3 curved legs,
 * relief-banded belly, twin upright loop handles, and stone plinth.
 */
export function createImperialUrnParts(
  cx: number,
  y: number,
  cz: number,
  scale = 1.0
): { stoneParts: THREE.BufferGeometry[]; bronzeParts: THREE.BufferGeometry[] } {
  const s = scale;
  const stoneParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];

  const plinth = new THREE.BoxGeometry(1.45 * s, 0.22 * s, 1.45 * s);
  plinth.translate(0, 0.11 * s, 0);
  stoneParts.push(plinth);

  // FIX CD-02: 3 slender graceful S-curved cabriole legs (*Chân quỳ Cửu Đỉnh*) rising 0.92*s
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.46 * s, 0.22 * s, sa * 0.46 * s),
      new THREE.Vector3(ca * 0.56 * s, 0.56 * s, sa * 0.56 * s),
      new THREE.Vector3(ca * 0.42 * s, 0.88 * s, sa * 0.42 * s),
      new THREE.Vector3(ca * 0.38 * s, 1.02 * s, sa * 0.38 * s)
    ]);
    bronzeParts.push(new THREE.TubeGeometry(legCurve, 10, 0.068 * s, 7, false));
  }

  // Deep wide cauldron body with hollow interior mouth & 3-tier embossed relief panels (17 dynastic relief plaques)
  const prof = [
    new THREE.Vector2(0.02 * s, 0.78 * s),
    new THREE.Vector2(0.46 * s, 0.84 * s),
    new THREE.Vector2(0.76 * s, 1.18 * s),
    new THREE.Vector2(0.78 * s, 1.48 * s),
    new THREE.Vector2(0.56 * s, 1.72 * s),
    new THREE.Vector2(0.70 * s, 1.84 * s),
    new THREE.Vector2(0.62 * s, 1.86 * s),
    new THREE.Vector2(0.52 * s, 1.72 * s),
    new THREE.Vector2(0.48 * s, 1.12 * s),
    new THREE.Vector2(0.02 * s, 1.02 * s)
  ];
  bronzeParts.push(new THREE.LatheGeometry(prof, 20));

  for (const [ry, rad, nPlaq] of [
    [1.08, 0.73, 6],
    [1.30, 0.78, 6],
    [1.52, 0.72, 5]
  ]) {
    const band = new THREE.TorusGeometry(rad * s, 0.026 * s, 6, 20);
    band.rotateX(Math.PI * 0.5);
    band.translate(0, ry * s, 0);
    bronzeParts.push(band);
    for (let k = 0; k < nPlaq; k++) {
      const a = (k / nPlaq) * Math.PI * 2;
      const plaque = new THREE.BoxGeometry(0.22 * s, 0.16 * s, 0.05 * s);
      plaque.rotateY(-a + Math.PI * 0.5);
      plaque.translate(Math.cos(a) * rad * s, ry * s, Math.sin(a) * rad * s);
      bronzeParts.push(plaque);
    }
  }

  // FIX CD-01: Twin upright arched handles (*quai đỉnh*) seated SOLIDLY atop the cauldron rim (ZERO floating!)
  // Parallel to X at z = ±0.48*s so all 4 handle feet land squarely inside the Ø0.56..0.70*s rim!
  for (const sz of [-1, 1]) {
    const h = new THREE.TorusGeometry(0.24 * s, 0.046 * s, 7, 12, Math.PI);
    h.translate(0, 1.83 * s, sz * 0.50 * s);
    bronzeParts.push(h);
  }

  transformParts(stoneParts, cx, y, cz, 0);
  transformParts(bronzeParts, cx, y, cz, 0);
  return { stoneParts, bronzeParts };
}

/**
 * Builds a ceremonial bronze crane standing atop a tortoise (*Hạc chầu quy*) for temples & altars.
 */
export function createBronzeCraneOnTortoiseParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  scale = 1.0
): THREE.BufferGeometry[] {
  const s = scale;
  const parts: THREE.BufferGeometry[] = [];

  const turtle = new THREE.SphereGeometry(0.24 * s, 8, 6);
  turtle.scale(1.0, 0.55, 1.35);
  turtle.translate(0, 0.13 * s, 0);
  parts.push(turtle);

  for (const sx of [-0.06, 0.06]) {
    const leg = new THREE.CylinderGeometry(0.018 * s, 0.022 * s, 0.64 * s, 6);
    leg.translate(sx * s, 0.54 * s, 0);
    parts.push(leg);
  }

  const body = new THREE.SphereGeometry(0.18 * s, 9, 7);
  body.scale(0.85, 0.95, 1.55);
  body.rotateX(-0.25);
  body.translate(0, 0.96 * s, -0.02 * s);
  parts.push(body);

  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.06 * s, 0.14 * s),
    new THREE.Vector3(0, 1.38 * s, 0.22 * s),
    new THREE.Vector3(0, 1.62 * s, 0.12 * s),
    new THREE.Vector3(0, 1.72 * s, 0.24 * s)
  ]);
  parts.push(new THREE.TubeGeometry(neckCurve, 10, 0.032 * s, 6, false));

  const beak = new THREE.ConeGeometry(0.026 * s, 0.22 * s, 5);
  beak.rotateX(Math.PI * 0.52);
  beak.translate(0, 1.71 * s, 0.36 * s);
  parts.push(beak);

  return transformParts(parts, cx, y, cz, rotY);
}

/**
 * Builds a traditional Vietnamese bronze temple bell (*Đại Hồng Chung*) with dragon loop & sound bosses.
 */
export function createBronzeBellParts(
  cx: number,
  y: number,
  cz: number,
  scale = 1.0
): THREE.BufferGeometry[] {
  const s = scale;
  const parts: THREE.BufferGeometry[] = [];
  const profile = [
    new THREE.Vector2(0.02 * s, 1.25 * s),
    new THREE.Vector2(0.32 * s, 1.18 * s),
    new THREE.Vector2(0.38 * s, 0.85 * s),
    new THREE.Vector2(0.44 * s, 0.35 * s),
    new THREE.Vector2(0.56 * s, 0.04 * s),
    new THREE.Vector2(0.50 * s, 0.0),
    new THREE.Vector2(0.44 * s, 0.08 * s)
  ];
  parts.push(new THREE.LatheGeometry(profile, 16));

  // Dragon suspension loop (*quai chuông*)
  const loop = new THREE.TorusGeometry(0.14 * s, 0.045 * s, 6, 12, Math.PI);
  loop.translate(0, 1.22 * s, 0);
  parts.push(loop);

  // 4 striking sound bosses (*núm chuông*)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const boss = new THREE.SphereGeometry(0.075 * s, 7, 5);
    boss.translate(Math.cos(a) * 0.44 * s, 0.36 * s, Math.sin(a) * 0.44 * s);
    parts.push(boss);
  }
  return transformParts(parts, cx, y, cz, 0);
}

/**
 * Builds a full 3D hourglass Đông Sơn Ngọc Lũ (Heger I) Bronze Drum with 4 paired double-braided strap handles
 * & cast relief waist ribs (HV01-4: `hasFrogs = false` by default per historical Ngọc Lũ I canon).
 */
export function createDongSonDrum3DParts(
  cx: number,
  y: number,
  cz: number,
  radius = 1.0,
  hasFrogs = false
): THREE.BufferGeometry[] {
  const r = radius;
  const h = radius * 1.56;
  const parts: THREE.BufferGeometry[] = [];
  const prof = [
    new THREE.Vector2(r * 0.96, 0),
    new THREE.Vector2(r * 0.90, h * 0.24),
    new THREE.Vector2(r * 0.76, h * 0.52),
    new THREE.Vector2(r * 1.04, h * 0.78),
    new THREE.Vector2(r * 0.98, h * 0.97),
    new THREE.Vector2(r * 0.98, h),
    new THREE.Vector2(0.02 * r, h)
  ];
  parts.push(new THREE.LatheGeometry(prof, 28));

  // 4 cast horizontal waist relief ribs
  for (const bandY of [0.22, 0.48, 0.76, 0.90]) {
    const rb = bandY > 0.65 ? r * 1.03 : r * 0.88;
    const rib = new THREE.TorusGeometry(rb, r * 0.022, 5, 24);
    rib.rotateX(Math.PI * 0.5);
    rib.translate(0, h * bandY, 0);
    parts.push(rib);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    if (hasFrogs) {
      const fx = Math.cos(a) * r * 0.84;
      const fz = Math.sin(a) * r * 0.84;
      const fParts: THREE.BufferGeometry[] = [];
      const fBody = new THREE.SphereGeometry(r * 0.088, 7, 5);
      fBody.scale(1.0, 0.72, 1.42);
      fBody.translate(0, r * 0.052, 0);
      const fHead = new THREE.SphereGeometry(r * 0.058, 6, 5);
      fHead.translate(0, r * 0.078, r * 0.11);
      fParts.push(fBody, fHead);
      for (const sx of [-1, 1]) {
        const fLeg = new THREE.CylinderGeometry(r * 0.022, r * 0.026, r * 0.10, 5);
        fLeg.rotateX(0.42);
        fLeg.translate(sx * r * 0.075, r * 0.036, -r * 0.04);
        const fEye = new THREE.SphereGeometry(r * 0.018, 5, 4);
        fEye.translate(sx * r * 0.035, r * 0.115, r * 0.13);
        fParts.push(fLeg, fEye);
      }
      transformParts(fParts, fx, h, fz, a + Math.PI * 0.5);
      parts.push(...fParts);
    }

    // 4 Authentic paired double-braided bronze loop handles (*quai kép tết thừng*) on the drum shoulder
    const ha = a + Math.PI * 0.25;
    for (const pairOff of [-0.07, 0.07]) {
      const pah = ha + pairOff;
      const handle = new THREE.TorusGeometry(r * 0.16, r * 0.026, 6, 10, Math.PI);
      handle.rotateZ(-Math.PI * 0.5);
      handle.rotateY(pah);
      handle.translate(Math.cos(pah) * r * 0.97, h * 0.74, Math.sin(pah) * r * 0.97);
      parts.push(handle);
    }
  }
  return transformParts(parts, cx, y, cz, 0);
}

/**
 * Builds a detailed Chăm Pa leaf-arch sandstone tympanum (dancing 4-armed Durga on buffalo head or Kala-Makara).
 */
export function createChamReliefTympanumParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  scale = 1.0,
  type: 'durga' | 'kala_makara' = 'durga'
): THREE.BufferGeometry[] {
  const s = scale;
  const parts: THREE.BufferGeometry[] = [];

  // Pointed leaf-arch outer flame molding (*Vòm lá đề*)
  const shape = new THREE.Shape();
  shape.moveTo(-1.15 * s, 0);
  shape.quadraticCurveTo(-1.12 * s, 1.15 * s, 0, 1.95 * s);
  shape.quadraticCurveTo(1.12 * s, 1.15 * s, 1.15 * s, 0);
  shape.closePath();

  const slab = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28 * s,
    bevelEnabled: true,
    bevelThickness: 0.04 * s,
    bevelSize: 0.04 * s,
    bevelSegments: 2,
    curveSegments: 14
  });
  slab.translate(0, 0, -0.14 * s);
  parts.push(slab);

  // FIX PN-02: Removed ahistorical outer row of 11 round rim beads; sculpt clean leaf-arch relief frame + reclining horizontal buffalo base (ref 66!)
  if (type === 'durga') {
    // Sculpted horizontal reclining buffalo body + raised head & horns beneath dancing 4-armed Durga
    const buffaloBody = new THREE.CylinderGeometry(0.18 * s, 0.21 * s, 0.88 * s, 8);
    buffaloBody.rotateZ(Math.PI * 0.5);
    buffaloBody.scale(1.0, 0.82, 0.72);
    buffaloBody.translate(-0.04 * s, 0.22 * s, 0.18 * s);
    const buffaloHead = new THREE.SphereGeometry(0.19 * s, 8, 6);
    buffaloHead.scale(1.15, 0.82, 0.75);
    buffaloHead.translate(0.44 * s, 0.34 * s, 0.20 * s);
    parts.push(buffaloBody, buffaloHead);
    for (const sx of [-1, 1]) {
      const horn = new THREE.TorusGeometry(0.15 * s, 0.032 * s, 5, 8, Math.PI * 0.75);
      horn.rotateZ(sx * 0.55);
      horn.translate(0.44 * s + sx * 0.16 * s, 0.44 * s, 0.20 * s);
      // Bent dancing thighs & calves
      const thigh = new THREE.CylinderGeometry(0.055 * s, 0.065 * s, 0.30 * s, 6);
      thigh.rotateZ(sx * 0.75);
      thigh.translate(sx * 0.18 * s, 0.56 * s, 0.20 * s);
      const calf = new THREE.CylinderGeometry(0.048 * s, 0.055 * s, 0.28 * s, 6);
      calf.rotateZ(-sx * 0.35);
      calf.translate(sx * 0.22 * s, 0.38 * s, 0.20 * s);
      parts.push(horn, thigh, calf);
    }
    const body = new THREE.CylinderGeometry(0.13 * s, 0.15 * s, 0.48 * s, 8);
    body.translate(0, 0.88 * s, 0.20 * s);
    const head = new THREE.SphereGeometry(0.14 * s, 8, 6);
    head.translate(0, 1.24 * s, 0.20 * s);
    const crown = new THREE.ConeGeometry(0.11 * s, 0.30 * s, 6);
    crown.translate(0, 1.50 * s, 0.20 * s);
    parts.push(body, head, crown);
    for (const sx of [-1, 1]) {
      for (const aOff of [0.35, 1.05]) {
        const arm = new THREE.CylinderGeometry(0.042 * s, 0.048 * s, 0.52 * s, 6);
        arm.rotateZ(sx * aOff);
        arm.translate(sx * 0.34 * s, 0.94 * s + (aOff > 0.7 ? 0.18 * s : -0.06 * s), 0.22 * s);
        parts.push(arm);
      }
      // 2 kneeling flanking musicians
      const mus = new THREE.CylinderGeometry(0.10 * s, 0.13 * s, 0.40 * s, 6);
      mus.translate(sx * 0.68 * s, 0.36 * s, 0.18 * s);
      const musHead = new THREE.SphereGeometry(0.09 * s, 6, 5);
      musHead.translate(sx * 0.68 * s, 0.62 * s, 0.18 * s);
      parts.push(mus, musHead);
    }
  } else {
    // FIX MS-05: Sculpted Kala-Makara guardian mask with brow ridge, bulging eyes, fangs, nose crest & curling Makara floral garlands (ref 41 & 86!)
    const mask = new THREE.SphereGeometry(0.36 * s, 8, 6);
    mask.scale(1.28, 0.92, 0.52);
    mask.translate(0, 0.92 * s, 0.18 * s);
    const brow = new THREE.BoxGeometry(0.82 * s, 0.12 * s, 0.16 * s);
    brow.translate(0, 1.16 * s, 0.24 * s);
    const nose = new THREE.ConeGeometry(0.11 * s, 0.28 * s, 4);
    nose.translate(0, 0.92 * s, 0.30 * s);
    const crownCrest = new THREE.ConeGeometry(0.24 * s, 0.42 * s, 5);
    crownCrest.translate(0, 1.44 * s, 0.20 * s);
    parts.push(mask, brow, nose, crownCrest);
    for (const sx of [-1, 1]) {
      const eye = new THREE.SphereGeometry(0.10 * s, 6, 5);
      eye.translate(sx * 0.22 * s, 1.02 * s, 0.29 * s);
      const fang = new THREE.ConeGeometry(0.05 * s, 0.20 * s, 4);
      fang.rotateX(Math.PI);
      fang.translate(sx * 0.22 * s, 0.66 * s, 0.26 * s);
      const scroll = new THREE.TorusGeometry(0.28 * s, 0.072 * s, 5, 10, Math.PI * 1.4);
      scroll.rotateZ(sx * 0.35);
      scroll.translate(sx * 0.56 * s, 0.44 * s, 0.18 * s);
      const cheekVolute = new THREE.TorusGeometry(0.16 * s, 0.048 * s, 5, 8);
      cheekVolute.translate(sx * 0.44 * s, 0.94 * s, 0.20 * s);
      parts.push(eye, fang, scroll, cheekVolute);
    }
  }

  return transformParts(parts, cx, y, cz, rotY);
}

/**
 * Builds a historical armored tank (T-54B #843 / Type-59 #390 at Dinh Độc Lập, M41 at Củ Chi, M24 at ĐBP).
 */
export function createHistoricalTankParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  scale = 1.0
): { armorParts: THREE.BufferGeometry[]; darkParts: THREE.BufferGeometry[] } {
  const s = scale;
  const armorParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];

  // Sloped hull + fenders
  const hull = new THREE.BoxGeometry(3.1 * s, 0.96 * s, 5.8 * s);
  hull.translate(0, 1.08 * s, 0);
  const glacis = new THREE.BoxGeometry(3.05 * s, 0.72 * s, 1.15 * s);
  glacis.rotateX(0.55);
  glacis.translate(0, 1.04 * s, 2.95 * s);
  armorParts.push(hull, glacis);

  // Twin tracks + 5 roadwheels per side
  for (const sx of [-1, 1]) {
    const track = new THREE.BoxGeometry(0.56 * s, 0.88 * s, 5.95 * s);
    track.translate(sx * 1.48 * s, 0.52 * s, 0);
    darkParts.push(track);
    for (let w = 0; w < 5; w++) {
      const wheel = new THREE.CylinderGeometry(0.38 * s, 0.38 * s, 0.62 * s, 10);
      wheel.rotateZ(Math.PI * 0.5);
      wheel.translate(sx * 1.48 * s, 0.44 * s, -2.2 * s + w * 1.1 * s);
      darkParts.push(wheel);
    }
    // Rear external cylindrical fuel drums
    const drum = new THREE.CylinderGeometry(0.24 * s, 0.24 * s, 0.92 * s, 8);
    drum.rotateZ(Math.PI * 0.5);
    drum.translate(sx * 0.78 * s, 1.38 * s, -2.92 * s);
    armorParts.push(drum);
  }

  // Cast dome turret + commander cupola + 100mm main cannon
  const turret = new THREE.SphereGeometry(1.38 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  turret.scale(1.0, 0.76, 1.18);
  turret.translate(0, 1.48 * s, 0.28 * s);
  const cupola = new THREE.CylinderGeometry(0.38 * s, 0.44 * s, 0.28 * s, 10);
  cupola.translate(-0.42 * s, 2.38 * s, -0.05 * s);
  const mantlet = new THREE.BoxGeometry(0.76 * s, 0.48 * s, 0.52 * s);
  mantlet.translate(0, 1.92 * s, 1.72 * s);
  const barrel = new THREE.CylinderGeometry(0.085 * s, 0.115 * s, 4.9 * s, 10);
  barrel.rotateX(Math.PI * 0.5 - 0.08);
  barrel.translate(0, 2.12 * s, 4.05 * s);
  const boreEvac = new THREE.CylinderGeometry(0.145 * s, 0.145 * s, 0.62 * s, 10);
  boreEvac.rotateX(Math.PI * 0.5 - 0.08);
  boreEvac.translate(0, 2.28 * s, 5.82 * s);
  armorParts.push(turret, cupola, mantlet, barrel, boreEvac);

  transformParts(armorParts, cx, y, cz, rotY);
  transformParts(darkParts, cx, y, cz, rotY);
  return { armorParts, darkParts };
}

/**
 * Builds the iconic rooftop UH-1 Iroquois (Huey) Helicopter parked atop Dinh Độc Lập.
 */
export function createUH1HelicopterParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  scale = 1.0
): { bodyParts: THREE.BufferGeometry[]; darkParts: THREE.BufferGeometry[] } {
  const s = scale;
  const bodyParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];

  // Main cabin + rounded nose + engine cowling
  const cabin = new THREE.BoxGeometry(2.3 * s, 1.55 * s, 4.4 * s);
  cabin.translate(0, 1.48 * s, 0.35 * s);
  const nose = new THREE.SphereGeometry(1.18 * s, 10, 8);
  nose.scale(0.96, 0.66, 1.38);
  nose.translate(0, 1.34 * s, 2.45 * s);
  const cowl = new THREE.BoxGeometry(1.15 * s, 0.68 * s, 2.2 * s);
  cowl.translate(0, 2.52 * s, -0.35 * s);
  bodyParts.push(cabin, nose, cowl);

  // Tapered tail boom + vertical fin + horizontal stabilizers
  const boom = new THREE.CylinderGeometry(0.24 * s, 0.58 * s, 6.2 * s, 8);
  boom.rotateX(Math.PI * 0.5);
  boom.translate(0, 1.72 * s, -4.65 * s);
  const fin = new THREE.BoxGeometry(0.14 * s, 1.75 * s, 0.95 * s);
  fin.rotateX(-0.32);
  fin.translate(0, 2.55 * s, -7.45 * s);
  const stab = new THREE.BoxGeometry(2.6 * s, 0.12 * s, 0.62 * s);
  stab.translate(0, 1.76 * s, -5.65 * s);
  bodyParts.push(boom, fin, stab);

  // Landing skids + boarding steps + side cabin windows + cockpit glass + main & tail rotors
  for (const sx of [-1, 1]) {
    const skid = new THREE.CylinderGeometry(0.065 * s, 0.065 * s, 4.6 * s, 7);
    skid.rotateX(Math.PI * 0.5);
    skid.translate(sx * 1.18 * s, 0.12 * s, 0.55 * s);
    // Side iron boarding step bar attached to landing skid
    const stepBar = new THREE.BoxGeometry(0.24 * s, 0.05 * s, 1.35 * s);
    stepBar.translate(sx * 1.24 * s, 0.42 * s, 0.85 * s);
    // Dark side cabin door windows (front pilot & rear sliding door windows)
    const sideWin1 = new THREE.BoxGeometry(0.08 * s, 0.68 * s, 1.05 * s);
    sideWin1.translate(sx * 1.16 * s, 1.66 * s, 1.45 * s);
    const sideWin2 = new THREE.BoxGeometry(0.08 * s, 0.72 * s, 1.32 * s);
    sideWin2.translate(sx * 1.16 * s, 1.64 * s, -0.25 * s);
    for (const sz of [-0.9, 1.5]) {
      const strut = new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.95 * s, 6);
      strut.rotateZ(sx * 0.25);
      strut.translate(sx * 1.04 * s, 0.52 * s, sz * s);
      darkParts.push(strut);
    }
    darkParts.push(skid, stepBar, sideWin1, sideWin2);
  }

  const windshield = new THREE.BoxGeometry(2.15 * s, 0.88 * s, 1.25 * s);
  windshield.rotateX(0.36);
  windshield.translate(0, 1.62 * s, 2.55 * s);
  const mast = new THREE.CylinderGeometry(0.11 * s, 0.14 * s, 0.85 * s, 8);
  mast.translate(0, 3.22 * s, 0.25 * s);
  const mainRotor = new THREE.BoxGeometry(11.6 * s, 0.06 * s, 0.42 * s);
  mainRotor.rotateY(0.42);
  mainRotor.translate(0, 3.60 * s, 0.25 * s);
  const tailRotor = new THREE.BoxGeometry(0.08 * s, 2.2 * s, 0.18 * s);
  tailRotor.translate(-0.22 * s, 3.15 * s, -7.65 * s);
  darkParts.push(windshield, mast, mainRotor, tailRotor);

  transformParts(bodyParts, cx, y, cz, rotY);
  transformParts(darkParts, cx, y, cz, rotY);
  return { bodyParts, darkParts };
}

/**
 * Builds a vintage open-top Langbiang mountain Jeep (Đà Lạt).
 */
export function createVintageJeepParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0
): { bodyParts: THREE.BufferGeometry[]; darkParts: THREE.BufferGeometry[] } {
  const bodyParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];

  const chassis = new THREE.BoxGeometry(1.68, 0.68, 3.55);
  chassis.translate(0, 0.82, 0);
  const hood = new THREE.BoxGeometry(1.42, 0.42, 1.35);
  hood.translate(0, 1.22, 1.02);
  const windshield = new THREE.BoxGeometry(1.56, 0.62, 0.08);
  windshield.rotateX(-0.18);
  windshield.translate(0, 1.68, 0.36);
  bodyParts.push(chassis, hood, windshield);

  // Roll-bar hoops & seats
  for (const rz of [-0.55, -1.45]) {
    const bar = new THREE.TorusGeometry(0.76, 0.04, 6, 12, Math.PI);
    bar.translate(0, 1.25, rz);
    darkParts.push(bar);
  }
  for (const sx of [-0.88, 0.88]) {
    for (const sz of [-1.12, 1.12]) {
      const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 10);
      wheel.rotateZ(Math.PI * 0.5);
      wheel.translate(sx, 0.38, sz);
      darkParts.push(wheel);
    }
  }
  const spare = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 10);
  spare.rotateX(Math.PI * 0.5);
  spare.translate(0, 0.92, -1.86);
  darkParts.push(spare);

  transformParts(bodyParts, cx, y, cz, rotY);
  transformParts(darkParts, cx, y, cz, rotY);
  return { bodyParts, darkParts };
}

/**
 * Builds a coastal mangrove (*Cây Đước Cà Mau — Rhizophora*) with arching stilt roots
 * plunging into tidal mudflats and a dense glossy emerald canopy.
 */
export function createMangroveTreeParts(
  cx: number,
  y: number,
  cz: number,
  scale = 1.0,
  seed = 1
): { barkParts: THREE.BufferGeometry[]; leafParts: THREE.BufferGeometry[] } {
  const rand = mulberry32(seed);
  const s = scale;
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];

  const trunkH = (4.6 + rand() * 3.4) * s;
  const rootTopY = 1.8 * s;

  // FIX CM-02: 10 branching stilt roots (*rễ nơm phân nhánh bậc 2*) + 8 upright breathing pneumatophores (*rễ thở*) in tidal mud (budget-tuned — ref 102!)
  const rootCount = 10;
  for (let i = 0; i < rootCount; i++) {
    const a = (i / rootCount) * Math.PI * 2 + rand() * 0.28;
    const reach = (1.35 + rand() * 0.95) * s;
    const ry = rootTopY * (0.50 + rand() * 0.52);
    const midX = Math.cos(a) * reach * 0.62;
    const midY = ry * 0.58;
    const midZ = Math.sin(a) * reach * 0.62;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.14 * s, ry, Math.sin(a) * 0.14 * s),
      new THREE.Vector3(midX, midY, midZ),
      new THREE.Vector3(Math.cos(a) * reach, -0.75 * s, Math.sin(a) * reach)
    ]);
    barkParts.push(new THREE.TubeGeometry(curve, 4, 0.048 * s, 4, false));
    // Secondary forked prop root branching outward from mid-arch down into mud
    if (i % 2 === 0) {
      const forkAng = a + (rand() > 0.5 ? 0.26 : -0.26);
      const forkReach = reach * 1.24;
      const forkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(midX, midY, midZ),
        new THREE.Vector3(Math.cos(forkAng) * forkReach * 0.85, midY * 0.45, Math.sin(forkAng) * forkReach * 0.85),
        new THREE.Vector3(Math.cos(forkAng) * forkReach, -0.75 * s, Math.sin(forkAng) * forkReach)
      ]);
      barkParts.push(new THREE.TubeGeometry(forkCurve, 3, 0.032 * s, 3, false));
    }
  }
  // 8 Dense upright breathing pneumatophore spikes (*rễ thở*) emerging from mudflat around base
  for (let p = 0; p < 8; p++) {
    const pa = (p / 8) * Math.PI * 2 + rand() * 0.4;
    const pr = (0.75 + rand() * 1.65) * s;
    const ph = (0.28 + rand() * 0.26) * s;
    const spike = new THREE.CylinderGeometry(0.014 * s, 0.022 * s, ph, 3);
    spike.translate(Math.cos(pa) * pr, ph * 0.45 - 0.08 * s, Math.sin(pa) * pr);
    barkParts.push(spike);
  }

  // Main trunk + 3 spreading upper limbs
  const trunk = new THREE.CylinderGeometry(0.11 * s, 0.18 * s, trunkH, 7);
  trunk.translate(0, rootTopY * 0.4 + trunkH * 0.5, 0);
  barkParts.push(trunk);

  const crownY = rootTopY * 0.4 + trunkH;
  for (let b = 0; b < 4; b++) {
    const a = (b / 4) * Math.PI * 2 + rand() * 0.6;
    const rOut = (1.1 + rand() * 0.9) * s;
    const puff = createSculptedRockGeometry(seed + b * 17, (1.45 + rand() * 0.45) * s, (1.05 + rand() * 0.35) * s, (1.45 + rand() * 0.45) * s, 1);
    puff.translate(Math.cos(a) * rOut, crownY + (rand() - 0.3) * 0.8 * s, Math.sin(a) * rOut);
    leafParts.push(puff);
  }
  const topCrown = createSculptedRockGeometry(seed + 99, 1.85 * s, 1.25 * s, 1.85 * s, 1);
  topCrown.translate(0, crownY + 0.95 * s, 0);
  leafParts.push(topCrown);

  transformParts(barkParts, cx, y, cz, 0);
  transformParts(leafParts, cx, y, cz, 0);
  return { barkParts, leafParts };
}

/**
 * Builds a highland Đà Lạt 3-needle umbrella pine (*Thông Ba Lá — Pinus kesiya*)
 * with tall slender trunk and spreading flat umbrella canopy clusters instead of Christmas-tree cones.
 */
export function createUmbrellaPineParts(
  cx: number,
  y: number,
  cz: number,
  height = 16.0,
  seed = 1
): { barkParts: THREE.BufferGeometry[]; leafParts: THREE.BufferGeometry[] } {
  const rand = mulberry32(seed);
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];

  const trunk = new THREE.CylinderGeometry(0.16, 0.36, height * 0.92, 7);
  trunk.translate(0, height * 0.44, 0);
  barkParts.push(trunk);

  // 4-5 high lateral branches with broad flattened umbrella foliage pads
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand() * 0.5;
    const bh = height * (0.68 + i * 0.065);
    const reach = 1.9 + rand() * 1.4;
    const limb = new THREE.CylinderGeometry(0.06, 0.11, reach, 5);
    limb.rotateZ(-1.15);
    limb.rotateY(a);
    limb.translate(Math.cos(a) * reach * 0.45, bh, Math.sin(a) * reach * 0.45);
    barkParts.push(limb);

    const pad = createSculptedRockGeometry(seed + i * 23, 2.3 + rand() * 0.7, 0.78 + rand() * 0.25, 2.2 + rand() * 0.7, 1);
    pad.translate(Math.cos(a) * reach * 0.85, bh + 0.55, Math.sin(a) * reach * 0.85);
    leafParts.push(pad);
  }
  const crown = createSculptedRockGeometry(seed + 131, 3.1, 1.05, 3.0, 1);
  crown.translate(0, height * 0.96, 0);
  leafParts.push(crown);

  transformParts(barkParts, cx, y, cz, 0);
  transformParts(leafParts, cx, y, cz, 0);
  return { barkParts, leafParts };
}

/**
 * Builds a monumental 32-petal sculpted multi-whorl pink lotus bloom (for Đại Liên Hoa Đài).
 */
export function createMonumentalLotusParts(
  cx: number,
  y: number,
  cz: number,
  scale = 1.0
): { petalParts: THREE.BufferGeometry[]; coreParts: THREE.BufferGeometry[] } {
  const s = scale;
  const petalParts: THREE.BufferGeometry[] = [];
  const coreParts: THREE.BufferGeometry[] = [];

  // 3 concentric whorls (12 outer + 12 mid + 8 inner = 32 sculpted pointed lotus petals)
  const whorls = [
    { count: 12, tilt: 1.08, rOff: 1.35 * s, yOff: 0.45 * s, w: 0.92 * s, h: 2.85 * s, phase: 0 },
    { count: 12, tilt: 0.68, rOff: 0.98 * s, yOff: 0.85 * s, w: 0.78 * s, h: 2.55 * s, phase: Math.PI / 12 },
    { count: 8, tilt: 0.34, rOff: 0.58 * s, yOff: 1.20 * s, w: 0.62 * s, h: 2.15 * s, phase: Math.PI / 8 }
  ];

  for (const wh of whorls) {
    for (let i = 0; i < wh.count; i++) {
      const a = wh.phase + (i / wh.count) * Math.PI * 2;
      // Pointed cupped lotus petal (8x6 segments for smooth monumental 10m scale within budget)
      const petal = new THREE.SphereGeometry(1.0, 8, 6);
      const pos = petal.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        let vx = pos.getX(v);
        const vy = pos.getY(v);
        let vz = pos.getZ(v);
        // Taper tip to a graceful lotus point when vy > 0
        const tipTaper = vy > 0 ? 1.0 - 0.68 * Math.pow(vy, 1.5) : 1.0;
        const cup = -0.22 * (1.0 - vx * vx);
        vx *= wh.w * tipTaper;
        vz = vz * 0.22 * wh.w + cup * wh.w;
        pos.setXYZ(v, vx, (vy + 1.0) * 0.5 * wh.h, vz);
      }
      petal.computeVertexNormals();
      petal.rotateX(wh.tilt);
      petal.rotateY(a);
      petal.translate(Math.sin(a) * wh.rOff, wh.yOff, Math.cos(a) * wh.rOff);
      petalParts.push(petal);
    }
  }

  // FIX HV02-5: Sculpted flat lotus receptacle (*gương sen*) with 7 recessed seed sockets & 24 delicate anther-tipped golden stamens (ref 45 & 05!)
  const pod = new THREE.CylinderGeometry(0.98 * s, 0.44 * s, 0.90 * s, 14);
  pod.translate(0, 1.32 * s, 0);
  coreParts.push(pod);
  const podRim = new THREE.TorusGeometry(0.95 * s, 0.065 * s, 5, 16);
  podRim.rotateX(Math.PI * 0.5);
  podRim.translate(0, 1.77 * s, 0);
  coreParts.push(podRim);
  const centerSeed = new THREE.SphereGeometry(0.14 * s, 6, 4);
  centerSeed.scale(1.0, 0.55, 1.0);
  centerSeed.translate(0, 1.79 * s, 0);
  coreParts.push(centerSeed);
  for (let sd = 0; sd < 6; sd++) {
    const sa = (sd / 6) * Math.PI * 2;
    const seed = new THREE.SphereGeometry(0.13 * s, 6, 4);
    seed.scale(1.0, 0.55, 1.0);
    seed.translate(Math.sin(sa) * 0.46 * s, 1.78 * s, Math.cos(sa) * 0.46 * s);
    coreParts.push(seed);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const tilt = 0.24 + (i % 2) * 0.14;
    const st = new THREE.CylinderGeometry(0.018 * s, 0.014 * s, 0.88 * s, 4);
    st.rotateX(tilt);
    st.rotateY(a);
    st.translate(Math.sin(a) * 0.94 * s, 1.62 * s, Math.cos(a) * 0.94 * s);
    const anther = new THREE.SphereGeometry(0.055 * s, 5, 4);
    anther.translate(
      Math.sin(a) * (0.94 + Math.sin(tilt) * 0.44) * s,
      (1.62 + Math.cos(tilt) * 0.44) * s,
      Math.cos(a) * (0.94 + Math.sin(tilt) * 0.44) * s
    );
    coreParts.push(st, anther);
  }

  transformParts(petalParts, cx, y, cz, 0);
  transformParts(coreParts, cx, y, cz, 0);
  return { petalParts, coreParts };
}

/**
 * Builds Chùa Một Cột's authentic square orthogonal dark-ironwood cantilever truss
 * (*Hệ vì kèo trực giao 8 thanh chống chéo + cột treo đứng + dầm gánh vuông* — ref `50_he_vi_keo_chua_mot_cot.jpg`).
 */
export function createOrthogonalOnePillarTrussParts(
  cx: number,
  y: number,
  cz: number,
  span = 3.6,
  rise = 1.55
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const half = span * 0.5;
  const clampOff = 0.62; // Clamps both sides of the Ø1.24m smooth stone pillar in a `#` grid (ref 50)

  // 1. Two parallel pairs of heavy ironwood main collar beams clamping the stone pillar (`#` shape) at lower & upper levels
  for (const hOff of [rise * 0.42, rise]) {
    for (const side of [-1, 1]) {
      const bX = new THREE.BoxGeometry(span + 0.45, 0.22, 0.22);
      bX.translate(0, hOff, side * clampOff);
      const bZ = new THREE.BoxGeometry(0.22, 0.22, span + 0.45);
      bZ.translate(side * clampOff, hOff, 0);
      parts.push(bX, bZ);
    }
  }

  // 2. Outer perimeter floor ring girders supporting the Liên Hoa Đài balcony
  for (const side of [-1, 1]) {
    const gX = new THREE.BoxGeometry(span + 0.35, 0.20, 0.20);
    gX.translate(0, rise, side * half);
    const gZ = new THREE.BoxGeometry(0.20, 0.20, span + 0.35);
    gZ.translate(side * half, rise, 0);
    parts.push(gX, gZ);
  }

  // 3. FIX CMC-01: 8 Orthogonal Diagonal Struts arranged in 4 PARALLEL PAIRS at ±0.62m (NO 45° diagonals!)
  //    plus 8 full-height vertical hanging posts (*cột lửng*) connecting the deck down to the lower `#` beams!
  const strutLen = Math.hypot(half - clampOff * 0.65, rise * 0.88);
  const strutPitch = Math.atan2(half - clampOff * 0.65, rise * 0.88);
  for (const dir of [-1, 1]) {
    for (const pairOff of [-clampOff, clampOff]) {
      // Pair along X (sloping in X-Y plane, offset at z = ±0.62m)
      const sX = new THREE.BoxGeometry(0.18, strutLen, 0.18);
      sX.rotateZ(-dir * strutPitch);
      sX.translate(dir * (clampOff * 0.45 + half * 0.45), rise * 0.48, pairOff);
      parts.push(sX);

      // Pair along Z (sloping in Z-Y plane, offset at x = ±0.62m)
      const sZ = new THREE.BoxGeometry(0.18, strutLen, 0.18);
      sZ.rotateX(dir * strutPitch);
      sZ.translate(pairOff, rise * 0.48, dir * (clampOff * 0.45 + half * 0.45));
      parts.push(sZ);

      // Full-height vertical hanging drop-posts (*cột lửng*) connecting upper floor beam solidly down to lower `#` beam
      const dropH = rise * 0.68;
      const dX = new THREE.BoxGeometry(0.15, dropH, 0.15);
      dX.translate(dir * (half - 0.18), rise - dropH * 0.5, pairOff);
      const dZ = new THREE.BoxGeometry(0.15, dropH, 0.15);
      dZ.translate(pairOff, rise - dropH * 0.5, dir * (half - 0.18));
      parts.push(dX, dZ);
    }
  }
  return transformParts(parts, cx, y, cz, 0);
}

/**
 * Builds an angular-turret historical tank (M24 Chaffee at Điện Biên Phủ or M41 Walker Bulldog at Củ Chi)
 * distinct from the cast-dome T-54B/Type-59 tanks at Dinh Độc Lập.
 */
export function createAngularTankParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  scale = 1.0,
  damagedTilt = 0.08
): { armorParts: THREE.BufferGeometry[]; darkParts: THREE.BufferGeometry[] } {
  const s = scale;
  const armorParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];

  const hull = new THREE.BoxGeometry(2.75 * s, 0.92 * s, 4.95 * s);
  hull.translate(0, 1.02 * s, 0);
  const glacis = new THREE.BoxGeometry(2.70 * s, 0.68 * s, 1.05 * s);
  glacis.rotateX(0.62);
  glacis.translate(0, 1.00 * s, 2.52 * s);
  armorParts.push(hull, glacis);

  for (const sx of [-1, 1]) {
    const track = new THREE.BoxGeometry(0.48 * s, 0.82 * s, 5.15 * s);
    track.translate(sx * 1.32 * s, 0.48 * s, 0);
    darkParts.push(track);
    for (let w = 0; w < 5; w++) {
      const wheel = new THREE.CylinderGeometry(0.34 * s, 0.34 * s, 0.54 * s, 9);
      wheel.rotateZ(Math.PI * 0.5);
      wheel.translate(sx * 1.32 * s, 0.40 * s, -1.9 * s + w * 0.95 * s);
      darkParts.push(wheel);
    }
  }

  // Welded angular slab turret (M24/M41) + shorter 75/76mm gun
  const turret = new THREE.CylinderGeometry(0.95 * s, 1.24 * s, 0.76 * s, 6);
  turret.rotateY(Math.PI / 6);
  turret.translate(0, 1.82 * s, 0.18 * s);
  const bustle = new THREE.BoxGeometry(1.52 * s, 0.56 * s, 0.96 * s);
  bustle.translate(0, 1.84 * s, -0.82 * s);
  const barrel = new THREE.CylinderGeometry(0.075 * s, 0.095 * s, 3.65 * s, 8);
  barrel.rotateX(Math.PI * 0.5 + damagedTilt);
  barrel.translate(0, 1.86 * s - damagedTilt * 1.2 * s, 2.95 * s);
  armorParts.push(turret, bustle, barrel);

  transformParts(armorParts, cx, y, cz, rotY);
  transformParts(darkParts, cx, y, cz, rotY);
  return { armorParts, darkParts };
}

/**
 * Builds an authentic Langbiang Đà Lạt UAZ-469 soft-top mountain jeep
 * with front brush-guard bullbar, recessed round headlights, and black canvas canopy (ref `88_thung_lung_tinh_yeu_langbiang.jpg`).
 */
export function createUAZ469JeepParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0
): {
  bodyParts: THREE.BufferGeometry[];
  darkParts: THREE.BufferGeometry[];
  lightParts: THREE.BufferGeometry[];
} {
  const bodyParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];
  const lightParts: THREE.BufferGeometry[] = [];

  // Lower body tub + stepped hood + front wheel fenders
  const tub = new THREE.BoxGeometry(1.78, 0.72, 3.92);
  tub.translate(0, 0.86, 0);
  const hood = new THREE.BoxGeometry(1.44, 0.44, 1.38);
  hood.translate(0, 1.30, 1.22);
  const grille = new THREE.BoxGeometry(1.56, 0.52, 0.14);
  grille.translate(0, 1.12, 1.94);
  const windFrame = new THREE.BoxGeometry(1.68, 0.62, 0.10);
  windFrame.rotateX(-0.18);
  windFrame.translate(0, 1.78, 0.48);
  bodyParts.push(tub, hood, grille, windFrame);

  // Black canvas soft-top canopy + roof bars + front tubular bullbar
  const canopy = new THREE.BoxGeometry(1.66, 0.82, 2.38);
  canopy.translate(0, 1.86, -0.78);
  const roofCap = new THREE.BoxGeometry(1.54, 0.16, 2.32);
  roofCap.translate(0, 2.30, -0.78);
  const bullH1 = new THREE.CylinderGeometry(0.032, 0.032, 1.66, 6);
  bullH1.rotateZ(Math.PI * 0.5);
  bullH1.translate(0, 1.32, 2.12);
  const bullH2 = new THREE.CylinderGeometry(0.032, 0.032, 1.66, 6);
  bullH2.rotateZ(Math.PI * 0.5);
  bullH2.translate(0, 0.78, 2.12);
  darkParts.push(canopy, roofCap, bullH1, bullH2);
  for (const sx of [-0.76, -0.32, 0.32, 0.76]) {
    const bv = new THREE.CylinderGeometry(0.028, 0.028, 0.62, 6);
    bv.translate(sx, 1.05, 2.12);
    darkParts.push(bv);
  }
  for (const sx of [-0.90, 0.90]) {
    for (const sz of [-1.22, 1.22]) {
      const wheel = new THREE.CylinderGeometry(0.41, 0.41, 0.28, 12);
      wheel.rotateZ(Math.PI * 0.5);
      wheel.translate(sx, 0.41, sz);
      darkParts.push(wheel);
    }
  }
  const spare = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 10);
  spare.rotateX(Math.PI * 0.5);
  spare.translate(0, 0.98, -2.06);
  darkParts.push(spare);

  // Twin recessed round headlights
  for (const sx of [-0.56, 0.56]) {
    const lamp = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10);
    lamp.rotateX(Math.PI * 0.5);
    lamp.translate(sx, 1.14, 2.02);
    lightParts.push(lamp);
  }

  transformParts(bodyParts, cx, y, cz, rotY);
  transformParts(darkParts, cx, y, cz, rotY);
  transformParts(lightParts, cx, y, cz, rotY);
  return { bodyParts, darkParts, lightParts };
}

/**
 * Builds angular cubist Tây Nguyên *Tượng Nhà Mồ* folk funerary woodcarvings
 * (seated mourner resting chin on hands, standing couple, serrated totem — ref `90_tuong_nha_mo_tay_nguyen.jpg`).
 */
export function createNhaMoFolkStatueParts(
  cx: number,
  y: number,
  cz: number,
  rotY = 0,
  variant: 0 | 1 | 2 = 0
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  // Vertical rough-hewn wooden palisade post pedestal
  const post = new THREE.CylinderGeometry(0.13, 0.15, 1.05, 7);
  post.translate(0, 0.52, 0);
  parts.push(post);

  if (variant === 0) {
    // Classic seated mourner (*Tượng người ôm mặt khóc*) with angular flat-plane face & bent elbows on knees
    const seat = new THREE.BoxGeometry(0.30, 0.24, 0.28);
    seat.translate(0, 1.14, 0);
    const torso = new THREE.BoxGeometry(0.24, 0.46, 0.20);
    torso.translate(0, 1.46, -0.04);
    const head = new THREE.BoxGeometry(0.24, 0.30, 0.22);
    head.translate(0, 1.84, 0.02);
    const brow = new THREE.BoxGeometry(0.25, 0.07, 0.06);
    brow.translate(0, 1.94, 0.13);
    const nose = new THREE.BoxGeometry(0.05, 0.11, 0.06);
    nose.translate(0, 1.84, 0.14);
    parts.push(seat, torso, head, brow, nose);
    for (const sx of [-1, 1]) {
      const arm = new THREE.BoxGeometry(0.06, 0.44, 0.07);
      arm.translate(sx * 0.12, 1.54, 0.09);
      const knee = new THREE.BoxGeometry(0.08, 0.26, 0.14);
      knee.translate(sx * 0.11, 1.24, 0.11);
      parts.push(arm, knee);
    }
  } else if (variant === 1) {
    // Standing ancestral guardian carving
    const legs = new THREE.BoxGeometry(0.24, 0.38, 0.18);
    legs.translate(0, 1.22, 0);
    const torso = new THREE.BoxGeometry(0.28, 0.46, 0.20);
    torso.translate(0, 1.62, 0);
    const head = new THREE.BoxGeometry(0.22, 0.28, 0.20);
    head.translate(0, 2.00, 0);
    parts.push(legs, torso, head);
  } else {
    // Serrated crocodile / bird-crest funerary totem pole
    const shaft = new THREE.BoxGeometry(0.18, 0.92, 0.22);
    shaft.rotateX(0.14);
    shaft.translate(0, 1.48, 0);
    parts.push(shaft);
    for (let k = 0; k < 5; k++) {
      const tooth = new THREE.ConeGeometry(0.06, 0.14, 4);
      tooth.rotateX(Math.PI * 0.5);
      tooth.translate(0, 1.18 + k * 0.16, 0.15);
      parts.push(tooth);
    }
    const finial = new THREE.ConeGeometry(0.12, 0.34, 5);
    finial.translate(0, 2.08, 0.06);
    parts.push(finial);
  }
  return transformParts(parts, cx, y, cz, rotY);
}

// ============================================================================
// Smooth Parallel-Transport Tapered Tube, Seamless Sculpted Dragon & Ancient Banyan Builders
// ============================================================================

/**
 * Sweeps a twist-free parallel-transport (Bishop) frame along any 3D curve to produce
 * a 100% seamless, variable-radius, optionally profiled mesh with closed tapered tips.
 * Eliminates all Frenet-frame twist flips and segmented cylinder seams.
 */
export function createSmoothTaperedTubeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radialSegments: number,
  radiusFn: (t: number) => number,
  profileScaleFn?: (t: number, theta: number) => number
): THREE.BufferGeometry {
  const segs = Math.max(2, Math.floor(tubularSegments));
  const radSegs = Math.max(4, Math.floor(radialSegments));
  const pts = curve.getSpacedPoints(segs);
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(segs, i + 1)];
    const tan = new THREE.Vector3().subVectors(next, prev);
    if (tan.lengthSq() < 1e-10) {
      tan.set(0, 1, 0);
    } else {
      tan.normalize();
    }
    tangents.push(tan);
  }

  // Twist-free Bishop parallel transport frame initialized with world-up reference
  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  const refUp = Math.abs(tangents[0].y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const b0 = new THREE.Vector3().crossVectors(tangents[0], refUp).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, tangents[0]).normalize();
  normals.push(n0);
  binormals.push(b0);

  const rotAxis = new THREE.Vector3();
  const stepQuat = new THREE.Quaternion();
  for (let i = 1; i <= segs; i++) {
    const prevT = tangents[i - 1];
    const curT = tangents[i];
    const prevN = normals[i - 1].clone();
    const dot = THREE.MathUtils.clamp(prevT.dot(curT), -1, 1);
    if (dot < 0.99999) {
      rotAxis.crossVectors(prevT, curT);
      if (rotAxis.lengthSq() > 1e-10) {
        rotAxis.normalize();
        stepQuat.setFromAxisAngle(rotAxis, Math.acos(dot));
        prevN.applyQuaternion(stepQuat);
      }
    }
    // Re-orthogonalize against curT
    prevN.addScaledVector(curT, -prevN.dot(curT));
    if (prevN.lengthSq() < 1e-10) {
      prevN.set(0, 1, 0).addScaledVector(curT, -curT.y);
    }
    prevN.normalize();
    const curB = new THREE.Vector3().crossVectors(curT, prevN).normalize();
    normals.push(prevN);
    binormals.push(curB);
  }

  const ringCols = radSegs + 1;
  const ringVerts = (segs + 1) * ringCols;
  const positions = new Float32Array((ringVerts + 2) * 3);
  const uvs = new Float32Array((ringVerts + 2) * 2);
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const center = pts[i];
    const N = normals[i];
    const B = binormals[i];
    const baseR = Math.max(0.002, radiusFn(t));

    for (let j = 0; j <= radSegs; j++) {
      const vFrac = j / radSegs;
      const theta = vFrac * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const prof = profileScaleFn ? profileScaleFn(t, theta) : 1.0;
      const r = baseR * prof;

      const vx = center.x + (B.x * cosT + N.x * sinT) * r;
      const vy = center.y + (B.y * cosT + N.y * sinT) * r;
      const vz = center.z + (B.z * cosT + N.z * sinT) * r;

      const idx = i * ringCols + j;
      positions[idx * 3] = vx;
      positions[idx * 3 + 1] = vy;
      positions[idx * 3 + 2] = vz;
      uvs[idx * 2] = t;
      uvs[idx * 2 + 1] = vFrac;
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radSegs; j++) {
      const a = i * ringCols + j;
      const b = (i + 1) * ringCols + j;
      const c = (i + 1) * ringCols + (j + 1);
      const d = i * ringCols + (j + 1);
      indices.push(a, d, b, b, d, c);
    }
  }

  // Closed end caps so tapered ends never show hollow tubes
  const startCapIdx = ringVerts;
  const endCapIdx = ringVerts + 1;
  positions[startCapIdx * 3] = pts[0].x;
  positions[startCapIdx * 3 + 1] = pts[0].y;
  positions[startCapIdx * 3 + 2] = pts[0].z;
  uvs[startCapIdx * 2] = 0;
  uvs[startCapIdx * 2 + 1] = 0.5;

  positions[endCapIdx * 3] = pts[segs].x;
  positions[endCapIdx * 3 + 1] = pts[segs].y;
  positions[endCapIdx * 3 + 2] = pts[segs].z;
  uvs[endCapIdx * 2] = 1;
  uvs[endCapIdx * 2 + 1] = 0.5;

  for (let j = 0; j < radSegs; j++) {
    indices.push(startCapIdx, j, j + 1);
    const lastRing = segs * ringCols;
    indices.push(endCapIdx, lastRing + j + 1, lastRing + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a seamless, organic, continuously undulating Vietnamese Imperial Dragon
 * (body tapering smoothly from neck -> chest -> waist -> whip tail with integrated flowing dorsal ridge,
 * plus sculpted lofted head, open jaws, antlers, whiskers, cloud mane & 4 curved clawed legs).
 */
export function createSmoothDragonParts(
  curve: THREE.CatmullRomCurve3,
  opts: {
    baseRadius: number;
    tubularSegments?: number;
    radialSegments?: number;
    headAt?: 'start' | 'end' | 'none';
    includeLegs?: boolean;
    dorsalCrestHeight?: number;
    crestWaveCount?: number;
  }
): {
  bodyParts: THREE.BufferGeometry[];
  accentParts: THREE.BufferGeometry[];
  maneParts: THREE.BufferGeometry[];
  eyePositions: THREE.Vector3[];
  headOrigin?: THREE.Vector3;
  headForward?: THREE.Vector3;
} {
  const baseR = opts.baseRadius;
  const segs = opts.tubularSegments ?? 72;
  const radSegs = opts.radialSegments ?? 12;
  const headAt = opts.headAt ?? 'end';
  const crestH = opts.dorsalCrestHeight ?? 0.44;
  const crestWaves = opts.crestWaveCount ?? 22;

  const bodyParts: THREE.BufferGeometry[] = [];
  const accentParts: THREE.BufferGeometry[] = [];
  const maneParts: THREE.BufferGeometry[] = [];
  const eyePositions: THREE.Vector3[] = [];

  // Re-orient parametric u so u=0 is always near the head and u=1 is always the whip tail tip
  const toHeadParam = (t: number) => (headAt === 'end' ? 1.0 - t : t);

  // 1. Continuous anatomical tapered body with integrated undulating dorsal spine crest & soft ventral keel
  const bodyGeo = createSmoothTaperedTubeGeometry(
    curve,
    segs,
    radSegs,
    (t) => {
      const u = toHeadParam(t);
      const neckEase = THREE.MathUtils.smoothstep(u, 0.0, 0.10);
      const chestSwell = 0.84 + 0.24 * Math.sin(Math.min(1, u * 2.1) * Math.PI * 0.5) * neckEase;
      const tailTaper = 1.0 - 0.90 * Math.pow(u, 1.65);
      // Very subtle organic breathing/scale-rib modulation (smooth, NOT blocky rings!)
      const rib = 1.0 + 0.025 * Math.sin(u * Math.PI * 36.0);
      return Math.max(baseR * 0.07, baseR * chestSwell * tailTaper * rib);
    },
    (t, theta) => {
      const u = toHeadParam(t);
      const sinT = Math.sin(theta);
      // Integrated smooth dorsal flame-ridge crest rising along top spine
      const topRidge = Math.pow(Math.max(0, sinT), 6.0);
      const waveCrest = 0.55 + 0.45 * Math.sin(u * Math.PI * crestWaves * 2.0);
      const dorsalBoost = topRidge * crestH * waveCrest * (1.0 - u * 0.65);
      // 2D Tactile overlapping diamond-scale relief & segmented ventral belly plates (0 extra triangles!)
      const scaleDiamond = 0.022 * Math.sin(u * Math.PI * 56.0) * Math.cos(theta * 6.0);
      const bellyPlates = sinT < -0.25 ? 0.028 * Math.sin(u * Math.PI * 44.0) : 0.0;
      const bellyFlat = Math.pow(Math.max(0, -sinT), 3.0) * -0.10;
      return 1.0 + dorsalBoost + scaleDiamond + bellyPlates + bellyFlat;
    }
  );
  bodyParts.push(bodyGeo);

  // Flowing continuous gilded dorsal ribbon ridge smoothly hugging the dragon's spine
  const crestPts: THREE.Vector3[] = [];
  const crestSamples = Math.min(48, Math.max(18, Math.floor(segs * 0.65)));
  for (let i = 1; i < crestSamples; i++) {
    const t = i / crestSamples;
    const u = toHeadParam(t);
    const p = curve.getPoint(t);
    const localR = baseR * (1.0 - 0.85 * Math.pow(u, 1.6));
    const wave = Math.sin(u * Math.PI * crestWaves * 2.0) * 0.22 * localR;
    crestPts.push(new THREE.Vector3(p.x, p.y + localR * (1.08 + crestH * 0.65) + wave, p.z));
  }
  if (crestPts.length >= 4) {
    const crestCurve = new THREE.CatmullRomCurve3(crestPts);
    accentParts.push(
      createSmoothTaperedTubeGeometry(
        crestCurve,
        crestSamples,
        6,
        (t) => {
          const u = toHeadParam(t);
          return Math.max(baseR * 0.04, baseR * 0.18 * (1.0 - u * 0.78) * (0.72 + 0.28 * Math.sin(u * Math.PI * crestWaves * 2.0)));
        }
      )
    );
  }

  // Multi-Plume Cloud-Flame Tail Fan (*Đuôi Rồng Xòe Vân Mây*) fanning out gracefully from the whip tail tip
  const tTail = headAt === 'end' ? 0.0 : 1.0;
  const tailOrigin = curve.getPoint(tTail);
  const tailTan = curve.getTangent(tTail).normalize();
  const tailBack = headAt === 'end' ? tailTan.clone().negate() : tailTan.clone();
  const tailRight = new THREE.Vector3().crossVectors(tailBack, new THREE.Vector3(0, 1, 0));
  if (tailRight.lengthSq() < 1e-4) tailRight.set(1, 0, 0);
  tailRight.normalize();
  for (let f = -1; f <= 1; f++) {
    const plumeMid = tailOrigin
      .clone()
      .addScaledVector(tailBack, baseR * 1.15)
      .addScaledVector(tailRight, f * baseR * 0.55)
      .add(new THREE.Vector3(0, baseR * (0.35 + Math.abs(f) * 0.18), 0));
    const plumeTip = tailOrigin
      .clone()
      .addScaledVector(tailBack, baseR * 2.35)
      .addScaledVector(tailRight, f * baseR * 1.05)
      .add(new THREE.Vector3(0, baseR * (0.85 - Math.abs(f) * 0.22), 0));
    accentParts.push(
      createSmoothTaperedTubeGeometry(
        new THREE.CatmullRomCurve3([tailOrigin.clone(), plumeMid, plumeTip]),
        5,
        4,
        (t) => baseR * (0.20 * (1.0 - t * 0.85))
      )
    );
  }

  // 2. Four continuous curved muscular legs with elbow cloud-flame spurs, tapered forearms & 4 curved talons
  if (opts.includeLegs) {
    const legSpecs: Array<[number, number]> = [
      [0.24, -1],
      [0.38, 1],
      [0.64, -1],
      [0.76, 1]
    ];
    for (const [uPos, side] of legSpecs) {
      const t = headAt === 'end' ? 1.0 - uPos : uPos;
      const pt = curve.getPoint(THREE.MathUtils.clamp(t, 0.08, 0.92));
      const tan = curve.getTangent(THREE.MathUtils.clamp(t, 0.08, 0.92)).normalize();
      const fwd = headAt === 'end' ? tan.clone() : tan.clone().negate();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
      if (right.lengthSq() < 1e-4) right.set(1, 0, 0);
      right.normalize();

      const shoulder = pt.clone().addScaledVector(right, side * baseR * 0.72).add(new THREE.Vector3(0, -baseR * 0.25, 0));
      const elbow = shoulder
        .clone()
        .addScaledVector(right, side * baseR * 1.45)
        .addScaledVector(fwd, baseR * 0.45)
        .add(new THREE.Vector3(0, -baseR * 0.95, 0));
      const wrist = elbow
        .clone()
        .addScaledVector(right, side * baseR * 0.65)
        .addScaledVector(fwd, baseR * 1.15)
        .add(new THREE.Vector3(0, -baseR * 1.05, 0));

      const legCurve = new THREE.CatmullRomCurve3([shoulder, elbow, wrist]);
      bodyParts.push(
        createSmoothTaperedTubeGeometry(legCurve, 12, 7, (lt) => baseR * (0.42 - lt * 0.16))
      );

      // Swept S-curved Elbow Cloud-Flame Spur (*Lông khuỷu chân rồng xoắn mây*)
      const spurMid = elbow
        .clone()
        .addScaledVector(fwd, -baseR * 0.85)
        .addScaledVector(right, side * baseR * 0.45)
        .add(new THREE.Vector3(0, baseR * 0.42, 0));
      const spurTip = elbow
        .clone()
        .addScaledVector(fwd, -baseR * 1.75)
        .addScaledVector(right, side * baseR * 0.22)
        .add(new THREE.Vector3(0, baseR * 0.78, 0));
      maneParts.push(
        createSmoothTaperedTubeGeometry(
          new THREE.CatmullRomCurve3([elbow.clone(), spurMid, spurTip]),
          5,
          4,
          (st) => baseR * 0.16 * (1.0 - st * 0.82)
        )
      );

      // Sculpted Shoulder / Hip Cloud-Scroll Armor Rosette (*Vân mây xoắn bả vai & hông rồng*)
      const shoulderScroll = new THREE.TorusGeometry(baseR * 0.34, baseR * 0.065, 5, 10, Math.PI * 1.45);
      shoulderScroll.rotateY(side * Math.PI * 0.42);
      shoulderScroll.translate(shoulder.x, shoulder.y + baseR * 0.12, shoulder.z);
      const shoulderBoss = new THREE.SphereGeometry(baseR * 0.13, 6, 4);
      shoulderBoss.translate(shoulder.x + right.x * side * baseR * 0.08, shoulder.y + baseR * 0.12, shoulder.z + right.z * side * baseR * 0.08);
      accentParts.push(shoulderScroll, shoulderBoss);

      // 3 forward curved golden talons + 1 rear opposing dewclaw talon fanning out from each wrist
      for (let c = -1; c <= 1; c++) {
        const clawDir = fwd
          .clone()
          .addScaledVector(right, c * 0.42 + side * 0.15)
          .normalize();
        const clawMid = wrist.clone().addScaledVector(clawDir, baseR * 0.45).add(new THREE.Vector3(0, -baseR * 0.18, 0));
        const clawTip = wrist.clone().addScaledVector(clawDir, baseR * 0.85).add(new THREE.Vector3(0, -baseR * 0.48, 0));
        accentParts.push(
          createSmoothTaperedTubeGeometry(
            new THREE.CatmullRomCurve3([wrist.clone(), clawMid, clawTip]),
            6,
            5,
            (ct) => baseR * 0.12 * (1.0 - ct * 0.82)
          )
        );
      }
      const dewMid = wrist.clone().addScaledVector(fwd, -baseR * 0.36).add(new THREE.Vector3(0, -baseR * 0.10, 0));
      const dewTip = wrist.clone().addScaledVector(fwd, -baseR * 0.64).add(new THREE.Vector3(0, -baseR * 0.32, 0));
      accentParts.push(
        createSmoothTaperedTubeGeometry(
          new THREE.CatmullRomCurve3([wrist.clone(), dewMid, dewTip]),
          4,
          4,
          (ct) => baseR * 0.095 * (1.0 - ct * 0.80)
        )
      );
    }
  }

  // 3. Sculpted Continuous Lofted Dragon Head, Open Jaws, Curved Antlers, Whiskers & Silk Cloud Mane
  let headOrigin: THREE.Vector3 | undefined;
  let headForward: THREE.Vector3 | undefined;
  if (headAt !== 'none') {
    const tHead = headAt === 'end' ? 1.0 : 0.0;
    const pHead = curve.getPoint(tHead);
    const rawTan = curve.getTangent(tHead).normalize();
    const fwd = headAt === 'end' ? rawTan.clone() : rawTan.clone().negate();
    // Level the head gaze slightly forward & proud
    fwd.y = THREE.MathUtils.clamp(fwd.y * 0.45, -0.25, 0.35);
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, 1);
    fwd.normalize();

    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();

    headOrigin = pHead.clone();
    headForward = fwd.clone();
    const s = baseR;

    const ptLocal = (rx: number, uy: number, fz: number) =>
      pHead
        .clone()
        .addScaledVector(right, rx * s)
        .addScaledVector(up, uy * s)
        .addScaledVector(fwd, fz * s);

    // Seamless lofted upper cranium -> sculpted brow -> flared snout -> upturned Lý-dynasty nose crest
    const skullCurve = new THREE.CatmullRomCurve3([
      ptLocal(0, -0.12, -0.45),
      ptLocal(0, 0.22, 0.25),
      ptLocal(0, 0.08, 1.35),
      ptLocal(0, 0.02, 2.35),
      ptLocal(0, 0.36, 2.75)
    ]);
    bodyParts.push(
      createSmoothTaperedTubeGeometry(
        skullCurve,
        18,
        10,
        (t) => s * (0.95 + 0.36 * Math.sin(Math.min(1, t * 1.45) * Math.PI) - t * 0.56),
        (t, theta) => {
          const wide = Math.abs(Math.cos(theta)) * 0.16;
          const brow = Math.max(0, Math.sin(theta)) * (t > 0.15 && t < 0.55 ? 0.18 : 0.05);
          return 1.0 + wide + brow;
        }
      )
    );

    // Sculpted open lower jaw + chin beard curve
    const jawCurve = new THREE.CatmullRomCurve3([
      ptLocal(0, -0.42, 0.05),
      ptLocal(0, -0.82, 1.05),
      ptLocal(0, -0.78, 2.15),
      ptLocal(0, -0.58, 2.45)
    ]);
    bodyParts.push(
      createSmoothTaperedTubeGeometry(jawCurve, 12, 8, (t) => s * (0.68 - t * 0.42))
    );

    // Curled S-shaped Dragon Tongue (*Lưỡi Rồng Uốn*) inside open jaw
    const tongueCurve = new THREE.CatmullRomCurve3([
      ptLocal(0, -0.45, 0.85),
      ptLocal(0, -0.32, 1.45),
      ptLocal(0, -0.42, 1.85),
      ptLocal(0, -0.26, 2.25)
    ]);
    bodyParts.push(
      createSmoothTaperedTubeGeometry(tongueCurve, 6, 4, (t) => s * (0.14 * (1.0 - t * 0.72)))
    );

    // Imperial Forehead "Chữ Vương (王)" Golden Relief Crest & Cranial Flame-Crest Fin (*Mào Lửa Đỉnh Đầu Rồng*)
    for (const [barW, barZ, barY] of [
      [0.52, 1.05, 0.56],
      [0.42, 1.22, 0.52],
      [0.48, 1.38, 0.48]
    ]) {
      const fBar = ptLocal(0, barY, barZ);
      const barGeo = new THREE.BoxGeometry(barW * s, 0.055 * s, 0.075 * s);
      barGeo.translate(fBar.x, fBar.y, fBar.z);
      accentParts.push(barGeo);
    }
    const vCenterPos = ptLocal(0, 0.53, 1.22);
    const vCenterBar = new THREE.BoxGeometry(0.065 * s, 0.06 * s, 0.38 * s);
    vCenterBar.translate(vCenterPos.x, vCenterPos.y, vCenterPos.z);
    accentParts.push(vCenterBar);

    const cranialCrestCurve = new THREE.CatmullRomCurve3([
      ptLocal(0, 0.58, 0.82),
      ptLocal(0, 1.28, 0.05),
      ptLocal(0, 1.68, -0.95),
      ptLocal(0, 1.32, -1.75)
    ]);
    accentParts.push(
      createSmoothTaperedTubeGeometry(cranialCrestCurve, 8, 5, (t) => s * (0.18 * (1.0 - t * 0.78)))
    );

    // 3-Strand Flowing Under-Chin Dragon Beard (*Râu Cằm Rồng 3 Dải Uốn Lượn*)
    for (let cb = -1; cb <= 1; cb++) {
      const chinBeardCurve = new THREE.CatmullRomCurve3([
        ptLocal(cb * 0.16, -0.76, 2.22),
        ptLocal(cb * 0.28, -1.32, 1.95),
        ptLocal(cb * 0.36, -1.85, 1.28)
      ]);
      maneParts.push(
        createSmoothTaperedTubeGeometry(chinBeardCurve, 6, 4, (t) => s * (0.085 * (1.0 - t * 0.80)))
      );
    }

    // Flowing cheek brow ridges, branched deer antlers, nostrils, cheek gill-scrolls, teeth & multi-strand cloud mane
    for (const side of [-1, 1]) {
      // Flared sculpted nostrils (*lỗ mũi rồng loe*)
      const nostrilPos = ptLocal(side * 0.28, 0.26, 2.55);
      const nostril = new THREE.TorusGeometry(0.11 * s, 0.032 * s, 5, 8);
      nostril.rotateY(side * 0.45);
      nostril.translate(nostrilPos.x, nostrilPos.y, nostrilPos.z);
      bodyParts.push(nostril);

      // Spiral cheek gill-scrolls (*mang rồng xoắn ốc*) + Bodhi-leaf Ear Fin (*tai rồng hình lá đề*)
      const gillPos = ptLocal(side * 0.96, -0.05, 0.25);
      const gill = new THREE.TorusGeometry(0.22 * s, 0.045 * s, 5, 10, Math.PI * 1.4);
      gill.rotateY(side * Math.PI * 0.45);
      gill.translate(gillPos.x, gillPos.y, gillPos.z);
      const earPos = ptLocal(side * 0.88, 0.48, -0.25);
      const earFin = new THREE.ConeGeometry(0.18 * s, 0.58 * s, 4);
      earFin.scale(0.45, 1.0, 1.0);
      earFin.rotateX(-0.65);
      earFin.rotateZ(-side * 0.42);
      earFin.translate(earPos.x, earPos.y, earPos.z);
      bodyParts.push(gill, earFin);

      // Side jaw teeth along upper & lower mouth
      for (const tz of [1.25, 1.65]) {
        const upTooth = ptLocal(side * 0.42, -0.24, tz);
        const ut = new THREE.ConeGeometry(0.065 * s, 0.26 * s, 4);
        ut.rotateX(Math.PI);
        ut.translate(upTooth.x, upTooth.y, upTooth.z);
        const loTooth = ptLocal(side * 0.36, -0.58, tz - 0.1);
        const lt = new THREE.ConeGeometry(0.055 * s, 0.22 * s, 4);
        lt.translate(loTooth.x, loTooth.y, loTooth.z);
        maneParts.push(ut, lt);
      }

      const browCurve = new THREE.CatmullRomCurve3([
        ptLocal(side * 0.35, 0.52, 1.45),
        ptLocal(side * 0.96, 0.72, 0.75),
        ptLocal(side * 1.15, 0.44, -0.35)
      ]);
      bodyParts.push(
        createSmoothTaperedTubeGeometry(browCurve, 10, 6, (t) => s * (0.24 * (1.0 - t * 0.45)))
      );

      // Swept tapered S-curved antlers (*sừng hươu*)
      const antlerCurve = new THREE.CatmullRomCurve3([
        ptLocal(side * 0.58, 0.75, -0.15),
        ptLocal(side * 1.08, 1.85, -0.95),
        ptLocal(side * 1.38, 2.85, -1.85)
      ]);
      maneParts.push(
        createSmoothTaperedTubeGeometry(antlerCurve, 12, 6, (t) => s * 0.17 * (1.0 - t * 0.78))
      );
      // Secondary antler tine fork
      const tineCurve = new THREE.CatmullRomCurve3([
        ptLocal(side * 0.98, 1.55, -0.75),
        ptLocal(side * 1.42, 2.05, -0.55)
      ]);
      maneParts.push(
        createSmoothTaperedTubeGeometry(tineCurve, 6, 5, (t) => s * 0.10 * (1.0 - t * 0.80))
      );

      // 3 layered flowing tapered silk mane ribbons trailing smoothly behind neck
      for (let m = 0; m < 3; m++) {
        const maneCurve = new THREE.CatmullRomCurve3([
          ptLocal(side * (0.78 + m * 0.16), 0.54 - m * 0.42, -0.45),
          ptLocal(side * (1.42 + m * 0.28), 0.75 - m * 0.54, -1.55),
          ptLocal(side * (1.12 + m * 0.24), 0.15 - m * 0.68, -2.75)
        ]);
        maneParts.push(
          createSmoothTaperedTubeGeometry(maneCurve, 12, 6, (t) => s * (0.16 - m * 0.025) * (1.0 - t * 0.80))
        );
      }

      // Long flowing S-curled golden whiskers (*râu rồng*)
      const whiskerCurve = new THREE.CatmullRomCurve3([
        ptLocal(side * 0.68, -0.18, 2.05),
        ptLocal(side * 2.15, -0.05, 2.55),
        ptLocal(side * 3.35, -0.95, 1.65),
        ptLocal(side * 4.15, -0.35, 0.45)
      ]);
      accentParts.push(
        createSmoothTaperedTubeGeometry(whiskerCurve, 16, 6, (t) => s * 0.095 * (1.0 - t * 0.76))
      );

      // Ivory fangs
      const fangPos = ptLocal(side * 0.48, -0.42, 2.05);
      const fang = new THREE.ConeGeometry(0.11 * s, 0.48 * s, 5);
      fang.rotateX(Math.PI);
      fang.translate(fangPos.x, fangPos.y, fangPos.z);
      maneParts.push(fang);

      eyePositions.push(ptLocal(side * 0.92, 0.34, 0.78));
    }
  }

  return { bodyParts, accentParts, maneParts, eyePositions, headOrigin, headForward };
}

/**
 * Builds a lifelike ancient Vietnamese Banyan tree (*Cây Đa Cổ Thụ*) with:
 * - Gnarled fluted multi-fusion buttress trunk & sinuous ground-gripping surface roots
 * - Spreading curved tapered primary & secondary boughs (zero straight sticks!)
 * - Both anchored pillar prop roots (*rễ trụ chống đất*) and curtains of curved aerial roots (*rễ khí sinh*)
 * - Lush multi-tone 3D layered dome canopy clusters (vertex-colored for 1 draw call)
 */
export function createRealisticAncientBanyanParts(
  cx: number,
  baseY: number,
  cz: number,
  scale = 1.0,
  seed = 40404,
  opts?: {
    boughCount?: number;
    propRootCount?: number;
    danglingRootCount?: number;
    canopyDensity?: number;
    getHeight?: (x: number, z: number) => number;
  }
): {
  barkParts: THREE.BufferGeometry[];
  canopyParts: THREE.BufferGeometry[];
  canopyCenters: Array<[number, number, number, number]>;
} {
  const rand = mulberry32(seed);
  const barkParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];
  const canopyCenters: Array<[number, number, number, number]> = [];
  const s = scale;
  const boughCount = opts?.boughCount ?? 6;
  const propRootCount = opts?.propRootCount ?? 7;
  const danglingRootCount = opts?.danglingRootCount ?? 18;
  const canopyDensity = opts?.canopyDensity ?? 1.0;
  const sampleY = (x: number, z: number) => (opts?.getHeight ? opts.getHeight(x, z) : baseY);

  const paintGeo = (g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry => {
    const c = new THREE.Color(hex);
    const cnt = g.attributes.position.count;
    const cols = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  };

  // 1. Gnarled Multi-Fusion Fluted Main Trunk (deep buttress flutes flaring to 2.2x at ground!)
  const trunkH = 6.8 * s;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx, baseY - 0.6 * s, cz),
    new THREE.Vector3(cx + (rand() - 0.5) * 0.45 * s, baseY + trunkH * 0.35, cz + (rand() - 0.5) * 0.45 * s),
    new THREE.Vector3(cx + (rand() - 0.5) * 0.55 * s, baseY + trunkH * 0.72, cz + (rand() - 0.5) * 0.55 * s),
    new THREE.Vector3(cx + (rand() - 0.5) * 0.35 * s, baseY + trunkH, cz + (rand() - 0.5) * 0.35 * s)
  ]);
  const flutePhase = rand() * Math.PI * 2;
  const trunkGeo = createSmoothTaperedTubeGeometry(
    trunkCurve,
    10,
    10,
    (t) => {
      const rootFlare = Math.pow(1.0 - t, 2.8) * 1.15;
      const crownFlare = Math.pow(Math.max(0, t - 0.72) / 0.28, 1.8) * 0.24;
      return (0.98 + rootFlare + crownFlare) * s;
    },
    (t, theta) => {
      // Deep organic buttress flutes + braided helical root-vein tendril relief (0 extra tris!)
      const twist = theta + t * 0.85 + flutePhase;
      const fluteAmt = (1.0 - t * 0.62) * 0.26;
      const braidedTendon = fluteAmt * 0.28 * Math.sin(twist * 13.0 - t * 6.0);
      return 1.0 + fluteAmt * Math.sin(twist * 6.0) + fluteAmt * 0.45 * Math.cos(twist * 11.0) + braidedTendon;
    }
  );
  barkParts.push(trunkGeo);

  // 6 sinuous surface buttress roots gripping the earth around the trunk base
  for (let r = 0; r < 6; r++) {
    const ra = (r / 6) * Math.PI * 2 + (rand() - 0.5) * 0.42;
    const reach = (2.8 + rand() * 1.8) * s;
    const rx1 = cx + Math.cos(ra) * 0.95 * s;
    const rz1 = cz + Math.sin(ra) * 0.95 * s;
    const rx2 = cx + Math.cos(ra + 0.14) * reach * 0.58;
    const rz2 = cz + Math.sin(ra + 0.14) * reach * 0.58;
    const rx3 = cx + Math.cos(ra - 0.10) * reach;
    const rz3 = cz + Math.sin(ra - 0.10) * reach;
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + Math.cos(ra) * 0.52 * s, baseY + 1.85 * s, cz + Math.sin(ra) * 0.52 * s),
      new THREE.Vector3(rx1, sampleY(rx1, rz1) + 0.65 * s, rz1),
      new THREE.Vector3(rx2, sampleY(rx2, rz2) + 0.22 * s, rz2),
      new THREE.Vector3(rx3, sampleY(rx3, rz3) - 0.22 * s, rz3)
    ]);
    barkParts.push(
      createSmoothTaperedTubeGeometry(rootCurve, 7, 5, (t) => (0.42 * (1.0 - t * 0.78)) * s)
    );
    // Arched surface root bridge loop & mossy root-collar patch hugging the damp root valley
    if (r % 2 === 0) {
      const loopCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rx2, sampleY(rx2, rz2) - 0.08 * s, rz2),
        new THREE.Vector3((rx2 + rx3) * 0.5, sampleY(rx2, rz2) + 0.34 * s, (rz2 + rz3) * 0.5),
        new THREE.Vector3(rx3, sampleY(rx3, rz3) - 0.14 * s, rz3)
      ]);
      barkParts.push(createSmoothTaperedTubeGeometry(loopCurve, 5, 4, (t) => (0.14 * (1.0 - t * 0.45)) * s));
      const mossPatch = new THREE.SphereGeometry(0.36 * s, 5, 4);
      mossPatch.scale(1.4, 0.38, 1.1);
      mossPatch.translate(rx1, sampleY(rx1, rz1) + 0.18 * s, rz1);
      canopyParts.push(paintGeo(mossPatch, '#355e27'));
    }
  }

  // Gnarled Ancient Trunk Bark Burls (*U Bướu Vỏ Cây Cổ Thụ*) & Dark Recessed Tree Hollows (*Hốc Cây Đa Cổ Thụ*) along lower multi-fusion trunk
  for (let bl = 0; bl < 4; bl++) {
    const ba = (bl / 4) * Math.PI * 2 + 0.4;
    const burl = new THREE.SphereGeometry((0.28 + (bl % 2) * 0.09) * s, 6, 4);
    burl.scale(1.15, 0.82, 0.75);
    burl.translate(cx + Math.cos(ba) * 0.92 * s, baseY + (1.4 + bl * 0.85) * s, cz + Math.sin(ba) * 0.92 * s);
    barkParts.push(burl);
    if (bl < 2) {
      // Blooming Epiphytic Wild Forest Orchids (*Hoa Phong Lan Rừng Bám Thân Đa*)
      const ox = cx + Math.cos(ba + 0.35) * 0.96 * s;
      const oy = baseY + (2.4 + bl * 1.1) * s;
      const oz = cz + Math.sin(ba + 0.35) * 0.96 * s;
      for (let op = 0; op < 3; op++) {
        const bloom = new THREE.SphereGeometry(0.11 * s, 5, 4);
        bloom.translate(ox + (op - 1) * 0.12 * s, oy - op * 0.14 * s, oz);
        canopyParts.push(paintGeo(bloom, bl === 0 ? '#d868c8' : '#f2c640'));
      }
    }
  }

  // 2. Massive Organic Spreading Curved Primary Boughs + Forked Secondary Limbs
  const crownOrigin = trunkCurve.getPoint(0.92);
  const boughCurves: THREE.CatmullRomCurve3[] = [];
  for (let b = 0; b < boughCount; b++) {
    const ba = (b / boughCount) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const reach = (6.8 + rand() * 3.6) * s;
    const midLift = (1.6 + rand() * 1.2) * s;
    const endLift = (2.3 + rand() * 1.5) * s;
    const bend = (rand() - 0.5) * 0.45;

    const p0 = crownOrigin.clone().add(new THREE.Vector3(Math.cos(ba) * 0.4 * s, -0.6 * s, Math.sin(ba) * 0.4 * s));
    const p1 = new THREE.Vector3(
      cx + Math.cos(ba + bend * 0.4) * reach * 0.38,
      crownOrigin.y + midLift,
      cz + Math.sin(ba + bend * 0.4) * reach * 0.38
    );
    const p2 = new THREE.Vector3(
      cx + Math.cos(ba + bend) * reach * 0.72,
      crownOrigin.y + midLift * 0.92 + 0.5 * s,
      cz + Math.sin(ba + bend) * reach * 0.72
    );
    const p3 = new THREE.Vector3(
      cx + Math.cos(ba + bend * 0.7) * reach,
      crownOrigin.y + endLift,
      cz + Math.sin(ba + bend * 0.7) * reach
    );

    const bCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    boughCurves.push(bCurve);
    barkParts.push(
      createSmoothTaperedTubeGeometry(bCurve, 8, 6, (t) => (0.46 * (1.0 - t * 0.72)) * s)
    );

    // Forked secondary branch spreading sideways & upward
    for (const fSide of [-1, 1]) {
      const fBase = bCurve.getPoint(0.55 + (fSide > 0 ? 0.12 : 0));
      const fa = ba + fSide * (0.45 + rand() * 0.25);
      const fLen = (2.8 + rand() * 1.6) * s;
      const fMid = new THREE.Vector3(
        fBase.x + Math.cos(fa) * fLen * 0.52,
        fBase.y + (0.65 + rand() * 0.55) * s,
        fBase.z + Math.sin(fa) * fLen * 0.52
      );
      const fTip = new THREE.Vector3(
        fBase.x + Math.cos(fa) * fLen,
        fBase.y + (1.35 + rand() * 0.85) * s,
        fBase.z + Math.sin(fa) * fLen
      );
      barkParts.push(
        createSmoothTaperedTubeGeometry(
          new THREE.CatmullRomCurve3([fBase, fMid, fTip]),
          5,
          4,
          (t) => (0.20 * (1.0 - t * 0.76)) * s
        )
      );
      canopyCenters.push([fTip.x, fTip.y + 0.65 * s, fTip.z, (2.6 + rand() * 0.9) * s]);
    }

    canopyCenters.push([p2.x, p2.y + 1.15 * s, p2.z, (3.2 + rand() * 0.8) * s]);
    canopyCenters.push([p3.x, p3.y + 0.85 * s, p3.z, (3.4 + rand() * 1.0) * s]);

    // Epiphytic bird's-nest fern rosettes (*dương xỉ tổ rồng bám cành cổ thụ*) & ripening red-amber banyan fig clusters (*quả đa chín*) on first 3 main boughs
    if (b < 3) {
      const epPt = bCurve.getPoint(0.38);
      for (let fr = 0; fr < 5; fr++) {
        const fa = (fr / 5) * Math.PI * 2 + b;
        const frond = new THREE.ConeGeometry(0.16 * s, 0.72 * s, 4);
        frond.scale(1.0, 1.0, 0.28);
        frond.rotateX(0.75);
        frond.rotateY(fa);
        frond.translate(epPt.x + Math.sin(fa) * 0.24 * s, epPt.y + 0.34 * s, epPt.z + Math.cos(fa) * 0.24 * s);
        canopyParts.push(paintGeo(frond, fr % 2 === 0 ? '#3d7a2a' : '#539137'));
      }
      const figPt = bCurve.getPoint(0.64);
      for (let fg = 0; fg < 3; fg++) {
        const fig = new THREE.SphereGeometry(0.085 * s, 5, 4);
        fig.translate(figPt.x + (fg - 1) * 0.14 * s, figPt.y - 0.12 * s, figPt.z + (fg % 2 === 0 ? 0.09 : -0.09) * s);
        canopyParts.push(paintGeo(fig, fg === 1 ? '#d95b2b' : '#b83c1d'));
      }
    }
  }
  // High central cathedral dome over the main trunk
  canopyCenters.push([cx, crownOrigin.y + 3.4 * s, cz, 4.6 * s]);

  // 3a. Anchored Pillar Prop Roots (*rễ trụ chống đất*) curving organically from heavy boughs into the earth + splayed toes
  for (let p = 0; p < propRootCount; p++) {
    const bCurve = boughCurves[p % boughCurves.length];
    const tAttach = 0.38 + rand() * 0.42;
    const topPt = bCurve.getPoint(tAttach);
    const groundX = topPt.x + (rand() - 0.5) * 1.35 * s;
    const groundZ = topPt.z + (rand() - 0.5) * 1.35 * s;
    const groundY = sampleY(groundX, groundZ) - 0.35 * s;
    const mid1 = new THREE.Vector3(
      THREE.MathUtils.lerp(topPt.x, groundX, 0.34) + (rand() - 0.5) * 0.55 * s,
      THREE.MathUtils.lerp(topPt.y, groundY, 0.34),
      THREE.MathUtils.lerp(topPt.z, groundZ, 0.34) + (rand() - 0.5) * 0.55 * s
    );
    const mid2 = new THREE.Vector3(
      THREE.MathUtils.lerp(topPt.x, groundX, 0.70) + (rand() - 0.5) * 0.45 * s,
      THREE.MathUtils.lerp(topPt.y, groundY, 0.70),
      THREE.MathUtils.lerp(topPt.z, groundZ, 0.70) + (rand() - 0.5) * 0.45 * s
    );
    const pCurve = new THREE.CatmullRomCurve3([topPt, mid1, mid2, new THREE.Vector3(groundX, groundY, groundZ)]);
    const baseThick = (0.11 + rand() * 0.08) * s;
    barkParts.push(
      createSmoothTaperedTubeGeometry(pCurve, 7, 5, (t) => {
        const topFlare = Math.pow(1.0 - t, 3.0) * 0.65;
        const botFlare = Math.pow(t, 3.0) * 0.85;
        return baseThick * (1.0 + topFlare + botFlare);
      })
    );
    // 2 splayed surface root toes gripping the soil at each prop-root landing
    for (const rtSide of [-1, 1]) {
      const toeAng = p * 1.1 + rtSide * 1.25;
      const toe = new THREE.ConeGeometry(baseThick * 0.68, 0.78 * s, 4);
      toe.rotateX(1.18);
      toe.rotateY(toeAng);
      toe.translate(groundX + Math.sin(toeAng) * 0.28 * s, groundY + 0.38 * s, groundZ + Math.cos(toeAng) * 0.28 * s);
      barkParts.push(toe);
    }
  }

  // 3b. Dangling Curved Aerial Root Curtains (*rễ khí sinh buông rủ*) swaying beneath horizontal limbs
  for (let d = 0; d < danglingRootCount; d++) {
    const bCurve = boughCurves[d % boughCurves.length];
    const tAttach = 0.25 + rand() * 0.65;
    const topPt = bCurve.getPoint(tAttach).add(
      new THREE.Vector3((rand() - 0.5) * 1.2 * s, -0.15 * s, (rand() - 0.5) * 1.2 * s)
    );
    const dropLen = (2.4 + rand() * 4.2) * s;
    const swayX = (rand() - 0.5) * 0.65 * s;
    const swayZ = (rand() - 0.5) * 0.65 * s;
    const dCurve = new THREE.CatmullRomCurve3([
      topPt,
      new THREE.Vector3(topPt.x + swayX * 0.45, topPt.y - dropLen * 0.48, topPt.z + swayZ * 0.45),
      new THREE.Vector3(topPt.x - swayX * 0.25, topPt.y - dropLen, topPt.z + swayZ * 0.85)
    ]);
    barkParts.push(
      createSmoothTaperedTubeGeometry(dCurve, 4, 4, (t) => (0.042 * (1.0 - t * 0.62)) * s)
    );
  }

  // 4. Layered Multi-Tone Broadleaf Dome Canopy (deep shaded underside -> rich emerald mid -> sunlit olive crown)
  const shadePalette = ['#1d421c', '#295723', '#366c2a', '#4a8532', '#5e993b'];
  const subPerCenter = Math.max(1, Math.round(1.6 * canopyDensity));
  for (let cIdx = 0; cIdx < canopyCenters.length; cIdx++) {
    const [kx, ky, kz, kr] = canopyCenters[cIdx];
    for (let k = 0; k < subPerCenter; k++) {
      const ang = (k / subPerCenter) * Math.PI * 2 + rand() * 0.9;
      const offR = k === 0 ? 0 : kr * (0.36 + rand() * 0.34);
      const liftY = (k === 0 ? 0.32 : (rand() - 0.35) * 0.65) * kr * 0.45;
      const puffR = kr * (0.64 + rand() * 0.24);
      const puff = new THREE.DodecahedronGeometry(puffR, 0);
      // Organic foliage irregularity on vertices so dome never looks like a smooth plastic ball
      const pAttr = puff.attributes.position;
      for (let vi = 0; vi < pAttr.count; vi++) {
        const vx = pAttr.getX(vi);
        const vy = pAttr.getY(vi);
        const vz = pAttr.getZ(vi);
        const bump = 0.86 + 0.26 * Math.sin(vx * 2.1 + vz * 1.9 + cIdx) * Math.cos(vy * 2.4 + k);
        pAttr.setXYZ(vi, vx * bump * 1.18, vy * bump * 0.58, vz * bump * 1.18);
      }
      puff.computeVertexNormals();
      puff.translate(kx + Math.cos(ang) * offR, ky + liftY, kz + Math.sin(ang) * offR);
      const toneIdx = Math.min(
        shadePalette.length - 1,
        Math.max(0, Math.floor(((liftY / Math.max(0.5, kr * 0.5)) + 0.75) * 2.2 + (rand() - 0.3)))
      );
      canopyParts.push(paintGeo(puff, shadePalette[toneIdx]));
    }
  }

  return { barkParts, canopyParts, canopyCenters };
}
