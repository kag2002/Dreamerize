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
  style?: 'royal' | 'market' | 'stone' | 'bronze' | 'lacquer_mural' | 'ceramic_relief';
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
      : style === 'stone'
        ? '#7b7568'
        : style === 'bronze'
          ? '#4b3b24'
          : style === 'lacquer_mural'
            ? '#3c1210'
            : style === 'ceramic_relief'
              ? '#1e5b63'
              : '#7d1614');
  const border =
    opts.borderColor ??
    (style === 'stone' ? '#b8b0a0' : style === 'ceramic_relief' ? '#e8c254' : '#e6b83e');
  const fg =
    opts.textColor ??
    (style === 'stone' ? '#ded8ca' : style === 'market' ? '#f8e391' : '#f7d15c');

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
    // Biên Hòa glazed ceramic folk motif medallion (lotus/fruit/fish silhouette)
    const grad = ctx2d.createRadialGradient(256, 128, 12, 256, 128, 220);
    grad.addColorStop(0, '#2c8a7a');
    grad.addColorStop(1, '#123d46');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, 512, 256);
    ctx2d.strokeStyle = '#e5bd53';
    ctx2d.lineWidth = 6;
    ctx2d.beginPath();
    ctx2d.ellipse(256, 128, 196, 94, 0, 0, Math.PI * 2);
    ctx2d.stroke();
    // Stylized lotus petals & waves
    ctx2d.fillStyle = '#e3b04b';
    for (let i = -3; i <= 3; i++) {
      ctx2d.beginPath();
      ctx2d.ellipse(256 + i * 38, 134 + Math.abs(i) * 8, 24, 52 - Math.abs(i) * 6, i * 0.22, 0, Math.PI * 2);
      ctx2d.fill();
    }
  }

  // Ornamental double border + corner cloud scrolls
  ctx2d.strokeStyle = border;
  ctx2d.lineWidth = 10;
  ctx2d.strokeRect(10, 10, 492, 236);
  ctx2d.lineWidth = 3;
  ctx2d.strokeRect(22, 22, 468, 212);

  // Corner motif squares
  for (const [cx, cy] of [
    [32, 32],
    [480, 32],
    [32, 224],
    [480, 224]
  ]) {
    ctx2d.fillStyle = border;
    ctx2d.fillRect(cx - 8, cy - 8, 16, 16);
  }

  if (opts.text) {
    ctx2d.fillStyle = fg;
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    const fontSize = opts.text.length > 18 ? 38 : opts.text.length > 11 ? 48 : 60;
    ctx2d.font = `bold ${fontSize}px Georgia, "Times New Roman", serif`;
    ctx2d.fillText(opts.text, 256, opts.subText ? 106 : 130, 440);
    if (opts.subText) {
      ctx2d.font = 'bold 26px Georgia, "Times New Roman", serif';
      ctx2d.fillText(opts.subText, 256, 168, 430);
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
  style: 'con_tien' | 'chu_van' | 'lotus_stone' | 'bamboo_x' | 'gold_pipe' = 'con_tien'
): THREE.BufferGeometry[] {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.25) return [];

  const rotY = Math.atan2(dx, dz);
  const parts: THREE.BufferGeometry[] = [];

  const railW = style === 'gold_pipe' ? 0.06 : style === 'bamboo_x' ? 0.08 : 0.14;
  const topRail = new THREE.BoxGeometry(railW, railW * 0.85, len);
  topRail.translate(0, height - railW * 0.42, len * 0.5);
  parts.push(topRail);

  const botRail = new THREE.BoxGeometry(railW * 1.15, railW * 0.95, len);
  botRail.translate(0, railW * 0.5, len * 0.5);
  parts.push(botRail);

  const spacing = style === 'con_tien' ? 0.34 : style === 'gold_pipe' ? 0.95 : style === 'bamboo_x' ? 0.9 : 0.85;
  const count = Math.max(2, Math.floor(len / spacing));
  const step = len / count;

  for (let i = 0; i <= count; i++) {
    const pz = i * step;
    if (style === 'con_tien') {
      // Turned wooden spindle (*con tiện*)
      const sp = new THREE.CylinderGeometry(0.032, 0.038, height - railW * 1.3, 6);
      sp.translate(0, height * 0.5, pz);
      parts.push(sp);
      if (i % 4 === 0 || i === count) {
        const post = new THREE.BoxGeometry(0.13, height + 0.08, 0.13);
        post.translate(0, (height + 0.08) * 0.5, pz);
        parts.push(post);
      }
    } else if (style === 'chu_van') {
      // Pierced Huế *chữ Vạn* / fretwork panel frame
      const post = new THREE.BoxGeometry(0.15, height, 0.15);
      post.translate(0, height * 0.5, pz);
      parts.push(post);
      if (i < count) {
        const midZ = pz + step * 0.5;
        const innerH = height - railW * 2.1;
        const vBar = new THREE.BoxGeometry(0.07, innerH, 0.07);
        vBar.translate(0, height * 0.5, midZ);
        const hBar = new THREE.BoxGeometry(0.07, 0.07, step * 0.72);
        hBar.translate(0, height * 0.5, midZ);
        const topHook = new THREE.BoxGeometry(0.07, innerH * 0.38, 0.07);
        topHook.translate(0, height * 0.5 + innerH * 0.25, midZ - step * 0.28);
        const botHook = new THREE.BoxGeometry(0.07, innerH * 0.38, 0.07);
        botHook.translate(0, height * 0.5 - innerH * 0.25, midZ + step * 0.28);
        parts.push(vBar, hBar, topHook, botHook);
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
      // lotus_stone
      const post = new THREE.BoxGeometry(0.18, height + 0.1, 0.18);
      post.translate(0, (height + 0.1) * 0.5, pz);
      parts.push(post);
      if (i < count) {
        const slab = new THREE.BoxGeometry(0.09, height * 0.55, step * 0.78);
        slab.translate(0, height * 0.45, pz + step * 0.5);
        parts.push(slab);
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

  // Central flaming pearl (*Mặt Nguyệt*) with radial flame petals
  const ped = new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 0.18 * s, 8);
  ped.translate(0, 0.09 * s, 0);
  goldParts.push(ped);

  const orb = new THREE.SphereGeometry(0.24 * s, 10, 8);
  orb.translate(0, 0.44 * s, 0);
  goldParts.push(orb);

  const halo = new THREE.TorusGeometry(0.34 * s, 0.045 * s, 7, 16);
  halo.translate(0, 0.44 * s, 0);
  goldParts.push(halo);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const flame = new THREE.ConeGeometry(0.055 * s, 0.18 * s, 5);
    flame.rotateZ(a - Math.PI * 0.5);
    flame.translate(Math.cos(a) * 0.42 * s, 0.44 * s + Math.sin(a) * 0.42 * s, 0);
    goldParts.push(flame);
  }

  // Twin sculpted curving dragons facing the flaming pearl
  const halfReach = Math.min(ridgeLen * 0.44, 2.8 * s);
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.52 * s, 0.48 * s, 0),
      new THREE.Vector3(side * (0.52 * s + halfReach * 0.25), 0.72 * s, 0),
      new THREE.Vector3(side * (0.52 * s + halfReach * 0.58), 0.28 * s, 0),
      new THREE.Vector3(side * (0.52 * s + halfReach * 0.85), 0.52 * s, 0),
      new THREE.Vector3(side * (0.52 * s + halfReach), 0.14 * s, 0)
    ]);
    const body = new THREE.TubeGeometry(curve, 16, 0.095 * s, 7, false);
    mainParts.push(body);

    // Sculpted dragon head + jaw + twin horns + dorsal fin spikes
    const head = new THREE.BoxGeometry(0.28 * s, 0.22 * s, 0.20 * s);
    head.translate(side * 0.48 * s, 0.50 * s, 0);
    const snout = new THREE.BoxGeometry(0.18 * s, 0.12 * s, 0.15 * s);
    snout.translate(side * 0.34 * s, 0.48 * s, 0);
    const mane = new THREE.ConeGeometry(0.09 * s, 0.32 * s, 5);
    mane.rotateZ(-side * 0.65);
    mane.translate(side * 0.62 * s, 0.68 * s, 0);
    goldParts.push(head, snout, mane);

    // 4 dorsal flame crests along the dragon back
    for (let k = 1; k <= 4; k++) {
      const pt = curve.getPoint(k * 0.2);
      const crest = new THREE.ConeGeometry(0.05 * s, 0.18 * s, 4);
      crest.translate(pt.x, pt.y + 0.12 * s, pt.z);
      goldParts.push(crest);
    }

    // *Kìm Nóc* (curled dragon-fish gable end finial)
    const endX = side * (ridgeLen * 0.48);
    const kim = new THREE.CylinderGeometry(0.12 * s, 0.19 * s, 0.48 * s, 7);
    kim.translate(endX, 0.24 * s, 0);
    const kimCurl = new THREE.ConeGeometry(0.14 * s, 0.36 * s, 6);
    kimCurl.rotateZ(-side * 0.48);
    kimCurl.translate(endX + side * 0.12 * s, 0.58 * s, 0);
    goldParts.push(kim, kimCurl);

    if (includePhoenixCorners) {
      const phBody = new THREE.ConeGeometry(0.11 * s, 0.42 * s, 6);
      phBody.rotateZ(side * 0.52);
      phBody.translate(endX + side * 0.26 * s, 0.34 * s, 0);
      goldParts.push(phBody);
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

  // Sloped carved masonry curb wall beneath the dragon body
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const tm = (t0 + t1) * 0.5;
    const segLen = horizLen / steps + 0.08;
    const wallH = 0.62 * s;
    const block = new THREE.BoxGeometry(0.46 * s, wallH, segLen);
    block.translate(0, dy * tm + wallH * 0.5 - 0.18 * s, horizLen * tm);
    parts.push(block);
  }

  // Undulating sinuous dragon spine along top of balustrade (from bottom head at z=0 up to tail at z=horizLen)
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const undulY = Math.sin(t * Math.PI * 5.0) * 0.16 * s;
    const undulX = Math.sin(t * Math.PI * 3.0) * 0.07 * s;
    pts.push(new THREE.Vector3(undulX, dy * t + 0.60 * s + undulY, horizLen * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const spine = new THREE.TubeGeometry(curve, 24, 0.21 * s, 9, false);
  parts.push(spine);

  // Dorsal scales / cloud-flame ridges along the back
  for (let i = 1; i <= 9; i++) {
    const pt = curve.getPoint(i / 10);
    const fin = new THREE.ConeGeometry(0.09 * s, 0.24 * s, 5);
    fin.rotateX(-0.35);
    fin.translate(pt.x, pt.y + 0.20 * s, pt.z);
    parts.push(fin);
  }

  // Sculpted Lê-dynasty dragon head at base (z ≈ 0, facing -Z)
  const headY = 0.72 * s;
  const cranium = new THREE.BoxGeometry(0.52 * s, 0.44 * s, 0.66 * s);
  cranium.translate(0, headY, -0.18 * s);
  const snout = new THREE.BoxGeometry(0.42 * s, 0.24 * s, 0.46 * s);
  snout.translate(0, headY - 0.04 * s, -0.58 * s);
  const lowerJaw = new THREE.BoxGeometry(0.36 * s, 0.14 * s, 0.42 * s);
  lowerJaw.translate(0, headY - 0.22 * s, -0.52 * s);
  const pearl = new THREE.SphereGeometry(0.11 * s, 8, 6);
  pearl.translate(0, headY - 0.12 * s, -0.74 * s);
  parts.push(cranium, snout, lowerJaw, pearl);

  // Twin swept horns, bulging eyes & flame mane scrolls
  for (const sx of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.065 * s, 0.46 * s, 6);
    horn.rotateX(0.75);
    horn.rotateZ(-sx * 0.25);
    horn.translate(sx * 0.19 * s, headY + 0.30 * s, 0.08 * s);

    const eye = new THREE.SphereGeometry(0.065 * s, 6, 5);
    eye.translate(sx * 0.24 * s, headY + 0.08 * s, -0.36 * s);

    const mane = new THREE.ConeGeometry(0.09 * s, 0.34 * s, 5);
    mane.rotateX(0.95);
    mane.translate(sx * 0.26 * s, headY + 0.02 * s, 0.16 * s);

    // Front clawed legs gripping the stone base
    const leg = new THREE.CylinderGeometry(0.085 * s, 0.10 * s, 0.46 * s, 6);
    leg.translate(sx * 0.24 * s, 0.34 * s, 0.25 * s);
    parts.push(horn, eye, mane, leg);
  }

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

  // Hexagonal domed tortoise carapace
  const shell = new THREE.CylinderGeometry(0.38 * s, 0.56 * s, 0.34 * s, 6);
  shell.scale(0.96, 1.0, 1.24);
  shell.translate(0, 0.30 * s, 0);
  const shellCap = new THREE.CylinderGeometry(0.24 * s, 0.38 * s, 0.12 * s, 6);
  shellCap.scale(0.96, 1.0, 1.24);
  shellCap.translate(0, 0.51 * s, 0);
  parts.push(shell, shellCap);

  // 4 clawed legs + protruding head + tail
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.BoxGeometry(0.18 * s, 0.18 * s, 0.24 * s);
      leg.translate(sx * 0.44 * s, 0.20 * s, sz * 0.42 * s);
      parts.push(leg);
    }
  }
  const neck = new THREE.CylinderGeometry(0.11 * s, 0.14 * s, 0.28 * s, 7);
  neck.rotateX(Math.PI * 0.42);
  neck.translate(0, 0.32 * s, 0.68 * s);
  const head = new THREE.SphereGeometry(0.14 * s, 8, 6);
  head.scale(0.95, 0.80, 1.28);
  head.translate(0, 0.38 * s, 0.84 * s);
  const tail = new THREE.ConeGeometry(0.06 * s, 0.20 * s, 5);
  tail.rotateX(-Math.PI * 0.45);
  tail.translate(0, 0.22 * s, -0.72 * s);
  parts.push(neck, head, tail);

  // Upright stele slab with arched dragon-cloud forehead (*trán bia*)
  const steleW = 0.72 * s;
  const steleH = 1.26 * s;
  const steleD = 0.18 * s;
  const slab = new THREE.BoxGeometry(steleW, steleH, steleD);
  slab.translate(0, 0.52 * s + steleH * 0.5, 0);
  const crown = new THREE.CylinderGeometry(steleW * 0.5, steleW * 0.5, steleD * 1.08, 12, 1, false, 0, Math.PI);
  crown.rotateZ(Math.PI * 0.5);
  crown.rotateY(Math.PI * 0.5);
  crown.translate(0, 0.52 * s + steleH, 0);
  // Relief side border strips
  for (const sx of [-1, 1]) {
    const border = new THREE.BoxGeometry(0.07 * s, steleH * 0.94, steleD * 1.18);
    border.translate(sx * (steleW * 0.46), 0.52 * s + steleH * 0.5, 0);
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
  } else {
    // Haunches + upright chest
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
    const snoutLen = type === 'dog' ? 0.22 * s : type === 'monkey' ? 0.10 * s : 0.16 * s;
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
  type: 'amitabha' | 'quanam' | 'ponagar' | 'virgin_mary' = 'amitabha'
): { bodyParts: THREE.BufferGeometry[]; accentParts: THREE.BufferGeometry[] } {
  const s = scale;
  const bodyParts: THREE.BufferGeometry[] = [];
  const accentParts: THREE.BufferGeometry[] = [];

  if (type === 'virgin_mary') {
    // Standing Our Lady of Peace (*Đức Mẹ Hòa Bình*) with draped robe & globe held in hands
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
    const halo = new THREE.TorusGeometry(0.29 * s, 0.022 * s, 6, 20);
    halo.translate(0, 2.70 * s, -0.10 * s);
    accentParts.push(miniCrossV, miniCrossH, halo);
  } else {
    // Seated Buddha / Quan Âm / Goddess Po Nagar atop a 3-layer pointed lotus throne
    const dais = new THREE.CylinderGeometry(0.95 * s, 1.08 * s, 0.36 * s, 14);
    dais.translate(0, 0.18 * s, 0);
    bodyParts.push(dais);

    // 2 whorls of sculpted upturned lotus petals around throne
    for (let ring = 0; ring < 2; ring++) {
      const nPetals = ring === 0 ? 14 : 12;
      const rad = ring === 0 ? 0.96 * s : 0.80 * s;
      const py = ring === 0 ? 0.36 * s : 0.48 * s;
      for (let i = 0; i < nPetals; i++) {
        const a = (i / nPetals) * Math.PI * 2 + ring * 0.22;
        const p = new THREE.ConeGeometry(0.18 * s, 0.42 * s, 5);
        p.scale(1.0, 1.0, 0.42);
        p.rotateX(ring === 0 ? 0.48 : 0.22);
        p.rotateY(a);
        p.translate(Math.sin(a) * rad, py, Math.cos(a) * rad);
        (ring === 0 ? bodyParts : accentParts).push(p);
      }
    }

    const seatY = 0.56 * s;
    // Crossed lotus-position knees
    const knees = new THREE.CylinderGeometry(0.76 * s, 0.88 * s, 0.44 * s, 14);
    knees.scale(1.12, 1.0, 0.86);
    knees.translate(0, seatY + 0.22 * s, 0.04 * s);
    bodyParts.push(knees);

    // Sculpted draped torso (*Áo cà sa*) via LatheGeometry
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

    // Head, ears, ushnisha / Mukuta crown
    const headY = seatY + 1.84 * s;
    const head = new THREE.SphereGeometry(0.28 * s, 12, 10);
    head.scale(0.94, 1.08, 0.96);
    head.translate(0, headY, 0.04 * s);
    bodyParts.push(head);

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
      // Ushnisha topknot + elongated earlobes
      const ushnisha = new THREE.SphereGeometry(0.13 * s, 8, 6);
      ushnisha.translate(0, headY + 0.28 * s, 0.02 * s);
      bodyParts.push(ushnisha);
      if (type === 'quanam') {
        for (let k = 0; k < 8; k++) {
          const a = -1.25 + (k / 7) * 2.5;
          const arm = new THREE.CylinderGeometry(0.042 * s, 0.05 * s, 0.68 * s, 6);
          arm.rotateZ(a);
          arm.translate(-Math.sin(a) * 0.58 * s, seatY + 1.10 * s + Math.cos(a) * 0.38 * s, -0.10 * s);
          accentParts.push(arm);
        }
      }
    }

    // Sculpted leaf-shaped aureole (*Lá đề hào quang*)
    const halo = new THREE.TorusGeometry(0.68 * s, 0.045 * s, 7, 22);
    halo.scale(0.88, 1.18, 1.0);
    halo.translate(0, headY - 0.04 * s, -0.26 * s);
    accentParts.push(halo);
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
  const woodParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  for (const sx of [-0.5, 0.5]) {
    const frame = new THREE.CylinderGeometry(radius, radius * 1.08, 0.08, 8);
    frame.rotateX(Math.PI * 0.5);
    frame.translate(sx * spacing, 0, 0.04);
    woodParts.push(frame);

    const boss = new THREE.SphereGeometry(radius * 0.56, 8, 6);
    boss.scale(1.0, 1.0, 0.45);
    boss.translate(sx * spacing, 0, 0.085);
    goldParts.push(boss);

    const ring = new THREE.TorusGeometry(radius * 0.78, radius * 0.12, 6, 8);
    ring.translate(sx * spacing, 0, 0.08);
    goldParts.push(ring);
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

  // 3 sturdy curved legs
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.CylinderGeometry(0.085 * s, 0.11 * s, 0.78 * s, 8);
    leg.rotateZ(0.14);
    leg.rotateY(a);
    leg.translate(Math.cos(a) * 0.42 * s, 0.58 * s, Math.sin(a) * 0.42 * s);
    bronzeParts.push(leg);
  }

  // Deep wide cauldron body with horizontal embossed relief ribs
  const prof = [
    new THREE.Vector2(0.02 * s, 0.62 * s),
    new THREE.Vector2(0.42 * s, 0.68 * s),
    new THREE.Vector2(0.68 * s, 1.05 * s),
    new THREE.Vector2(0.72 * s, 1.42 * s),
    new THREE.Vector2(0.56 * s, 1.68 * s),
    new THREE.Vector2(0.68 * s, 1.78 * s),
    new THREE.Vector2(0.60 * s, 1.80 * s)
  ];
  bronzeParts.push(new THREE.LatheGeometry(prof, 18));

  for (const ry of [1.02, 1.38]) {
    const band = new THREE.TorusGeometry(0.71 * s, 0.032 * s, 6, 18);
    band.rotateX(Math.PI * 0.5);
    band.translate(0, ry * s, 0);
    bronzeParts.push(band);
  }

  // Twin tall arched handles (*quai đỉnh*)
  for (const sx of [-1, 1]) {
    const h = new THREE.TorusGeometry(0.24 * s, 0.048 * s, 7, 12, Math.PI);
    h.translate(sx * 0.54 * s, 1.78 * s, 0);
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
 * Builds a full 3D hourglass Đông Sơn Ngọc Lũ Bronze Drum with 4 rim frogs & strap handles.
 */
export function createDongSonDrum3DParts(
  cx: number,
  y: number,
  cz: number,
  radius = 1.0
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

  // 4 rim frog statues (*tượng cóc*) + 4 strap handles (*quai trống*)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const frog = new THREE.SphereGeometry(r * 0.095, 7, 5);
    frog.scale(1.1, 0.72, 1.45);
    frog.rotateY(a + Math.PI * 0.5);
    frog.translate(Math.cos(a) * r * 0.84, h + r * 0.055, Math.sin(a) * r * 0.84);
    parts.push(frog);

    const handle = new THREE.TorusGeometry(r * 0.14, r * 0.032, 6, 10, Math.PI);
    handle.rotateZ(-Math.PI * 0.5);
    handle.rotateY(a + Math.PI * 0.25);
    handle.translate(Math.cos(a + Math.PI * 0.25) * r * 0.98, h * 0.74, Math.sin(a + Math.PI * 0.25) * r * 0.98);
    parts.push(handle);
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

  // Flame border beads along outer rim
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = Math.cos(t * Math.PI) * 1.14 * s;
    const fy = Math.sin(t * Math.PI) * 1.88 * s;
    const bead = new THREE.SphereGeometry(0.085 * s, 6, 5);
    bead.translate(x, fy, 0.14 * s);
    parts.push(bead);
  }

  if (type === 'durga') {
    // Buffalo head base + dancing 4-armed Durga relief
    const buffalo = new THREE.BoxGeometry(0.62 * s, 0.26 * s, 0.22 * s);
    buffalo.translate(0, 0.22 * s, 0.18 * s);
    const body = new THREE.CylinderGeometry(0.14 * s, 0.18 * s, 0.68 * s, 8);
    body.translate(0, 0.72 * s, 0.20 * s);
    const head = new THREE.SphereGeometry(0.14 * s, 8, 6);
    head.translate(0, 1.18 * s, 0.20 * s);
    const crown = new THREE.ConeGeometry(0.11 * s, 0.30 * s, 6);
    crown.translate(0, 1.44 * s, 0.20 * s);
    parts.push(buffalo, body, head, crown);
    for (const sx of [-1, 1]) {
      for (const aOff of [0.35, 1.05]) {
        const arm = new THREE.CylinderGeometry(0.042 * s, 0.048 * s, 0.52 * s, 6);
        arm.rotateZ(sx * aOff);
        arm.translate(sx * 0.34 * s, 0.88 * s + (aOff > 0.7 ? 0.18 * s : -0.06 * s), 0.22 * s);
        parts.push(arm);
      }
      // 2 flanking musicians
      const mus = new THREE.CylinderGeometry(0.10 * s, 0.13 * s, 0.40 * s, 6);
      mus.translate(sx * 0.68 * s, 0.36 * s, 0.18 * s);
      parts.push(mus);
    }
  } else {
    // Kala monster mask with curling Makara scrollwork
    const mask = new THREE.SphereGeometry(0.36 * s, 8, 6);
    mask.scale(1.25, 0.95, 0.55);
    mask.translate(0, 0.88 * s, 0.18 * s);
    parts.push(mask);
    for (const sx of [-1, 1]) {
      const scroll = new THREE.TorusGeometry(0.26 * s, 0.075 * s, 6, 10);
      scroll.translate(sx * 0.58 * s, 0.42 * s, 0.18 * s);
      parts.push(scroll);
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

  // Landing skids + struts + cockpit glass + main & tail rotors
  for (const sx of [-1, 1]) {
    const skid = new THREE.CylinderGeometry(0.065 * s, 0.065 * s, 4.6 * s, 7);
    skid.rotateX(Math.PI * 0.5);
    skid.translate(sx * 1.18 * s, 0.12 * s, 0.55 * s);
    for (const sz of [-0.9, 1.5]) {
      const strut = new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.95 * s, 6);
      strut.rotateZ(sx * 0.25);
      strut.translate(sx * 1.04 * s, 0.52 * s, sz * s);
      darkParts.push(strut);
    }
    darkParts.push(skid);
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

  // 7 arching stilt roots (*rễ chống*) radiating into the tidal mud
  const rootCount = 7;
  for (let i = 0; i < rootCount; i++) {
    const a = (i / rootCount) * Math.PI * 2 + rand() * 0.35;
    const reach = (1.35 + rand() * 0.85) * s;
    const ry = rootTopY * (0.55 + rand() * 0.45);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.14 * s, ry, Math.sin(a) * 0.14 * s),
      new THREE.Vector3(Math.cos(a) * reach * 0.68, ry * 0.62, Math.sin(a) * reach * 0.68),
      new THREE.Vector3(Math.cos(a) * reach, -0.75 * s, Math.sin(a) * reach)
    ]);
    barkParts.push(new THREE.TubeGeometry(curve, 6, 0.055 * s, 5, false));
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
      // Pointed cupped lotus petal using custom shaped Cone/Lathe distortion
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

  // Golden lotus seedpod + ring of stamens
  const pod = new THREE.CylinderGeometry(0.95 * s, 0.45 * s, 0.95 * s, 14);
  pod.translate(0, 1.35 * s, 0);
  coreParts.push(pod);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const st = new THREE.CylinderGeometry(0.045 * s, 0.03 * s, 0.85 * s, 5);
    st.rotateX(0.32);
    st.rotateY(a);
    st.translate(Math.sin(a) * 0.88 * s, 1.65 * s, Math.cos(a) * 0.88 * s);
    coreParts.push(st);
  }

  transformParts(petalParts, cx, y, cz, 0);
  transformParts(coreParts, cx, y, cz, 0);
  return { petalParts, coreParts };
}
