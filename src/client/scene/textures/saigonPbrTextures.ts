import * as THREE from 'three';

/**
 * Ultra-Lean SINGLE-MATERIAL Museum PBR & Artwork Master Atlas for
 * TP. Hồ Chí Minh Heritage Precinct:
 *   - Dinh Độc Lập (Independence Palace Exterior, Bamboo Brise-Soleil, Tanks 843/390, UH-1 445,
 *     Phòng Đại Yến & Phòng Trình Quốc Thư with 40-panel Bình Ngô Đại Cáo lacquer mural)
 *   - Nhà Thờ Đức Bà Sài Gòn (Marseille Brick Facade, Twin 60.5m Spires, Swiss Clock,
 *     Rose Window, Virgin Mary of Peace & Soaring Romanesque-Gothic Nave Interior)
 *
 * Packs ALL 16 architectural/relief textures + ALL 9 crisp 2K artworks/inscriptions into
 * ONE single 2048×3072 GPU material (`saigonMasterAtlasMat` + Sobel `normalMap` `flipY = true`)!
 */

export interface SaigonMaterialPack {
  saigonMasterAtlasMat: THREE.MeshStandardMaterial;
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

export const SAIGON_RELIEF_UV = {
  // Row 0 (y: 0..512 -> v: 0.8333..1.0)
  marseilleBrick: [0.0, 0.8333, 0.25, 1.0],
  creamLimestone: [0.25, 0.8333, 0.5, 1.0],
  zincSpireCladding: [0.5, 0.8333, 0.75, 1.0],
  cathedralTumblingTile: [0.75, 0.8333, 1.0, 1.0],
  // Row 1 (y: 512..1024 -> v: 0.6667..0.8333)
  naveCreamVault: [0.0, 0.6667, 0.25, 0.8333],
  stainedGlassLancet: [0.25, 0.6667, 0.5, 0.8333],
  roseWindowTracery: [0.5, 0.6667, 0.75, 0.8333],
  cathedralDoorWood: [0.75, 0.6667, 1.0, 0.8333],
  // Row 2 (y: 1024..1536 -> v: 0.5..0.6667)
  palacePrecastStone: [0.0, 0.5, 0.25, 0.6667],
  palaceRusticatedBase: [0.25, 0.5, 0.5, 0.6667],
  palaceGoldenCarpet: [0.5, 0.5, 0.75, 0.6667],
  palaceCrimsonBrocade: [0.75, 0.5, 1.0, 0.6667],
  // Row 3 (y: 1536..2048 -> v: 0.3333..0.5)
  palaceSonMaiLacquer: [0.0, 0.3333, 0.25, 0.5],
  palaceCarvedSpandrel: [0.25, 0.3333, 0.5, 0.5],
  militaryCamoArmor: [0.5, 0.3333, 0.75, 0.5],
  saigonParkLawn: [0.75, 0.3333, 1.0, 0.5]
} as const;

export type SaigonReliefKey = keyof typeof SAIGON_RELIEF_UV;

export const SAIGON_ART_UV = {
  // Row P0 (y: 2048..2560 -> v: 0.1667..0.3333)
  binhNgoDaiCaoMural: [0.0, 0.1667, 0.5, 0.3333],
  banquetLacquerMural: [0.5, 0.1667, 1.0, 0.3333],
  // Row P1 (y: 2560..2816 -> v: 0.0833..0.1667)
  saigonClockFace: [0.0, 0.0833, 0.1875, 0.1667],
  notreDameTympanum: [0.1875, 0.0833, 0.5, 0.1667],
  reginaPacisPlaque: [0.5, 0.0833, 0.75, 0.1667],
  helipadBombMarker: [0.75, 0.0833, 1.0, 0.1667],
  // Row P2 (y: 2816..3072 -> v: 0.0..0.0833)
  tank843Board: [0.0, 0.0, 0.333, 0.0833],
  huey445Marking: [0.333, 0.0, 0.666, 0.0833],
  stationsOfCross: [0.666, 0.0, 1.0, 0.0833]
} as const;

export type SaigonArtKey = keyof typeof SAIGON_ART_UV;

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

function createSaigonMasterAtlas(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
} {
  if (isHeadlessRenderer(renderer)) {
    return {
      map: finalizeDataTex(new Uint8Array([178, 92, 64, 255]), 1, 1, true, renderer),
      normalMap: finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, 1, false, renderer)
    };
  }
  const w = 2048;
  const h = 3072;
  const cObj = makeCanvas(w, h);
  const hObj = makeCanvas(w, h);
  if (!cObj || !hObj) {
    return {
      map: finalizeDataTex(new Uint8Array([178, 92, 64, 255]), 1, 1, true, renderer),
      normalMap: finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, 1, false, renderer)
    };
  }
  const c = cObj.ctx;
  const ht = hObj.ctx;
  c.fillStyle = '#c8c0b4';
  c.fillRect(0, 0, w, h);
  ht.fillStyle = '#808080';
  ht.fillRect(0, 0, w, h);
  const cell = 512;

  // ---- (0,0) MARSEILLE UNPLASTERED RED-ORANGE TERRACOTTA BRICK (`ND-01`) ----
  {
    const x0 = 0;
    const y0 = 0;
    c.fillStyle = '#c2b6a6';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#3a3a3a';
    ht.fillRect(x0, y0, cell, cell);
    const rows = 20;
    const cols = 8;
    const rh = cell / rows;
    const cw = cell / cols;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let col = -1; col <= cols; col++) {
        const bx = x0 + col * cw + shift;
        const by = y0 + r * rh;
        const h1 = hash2i(col + 13, r, 3001);
        const rx = Math.max(x0, bx + 2.5);
        const rw = Math.min(cw - 5, x0 + cell - rx);
        if (rw > 1) {
          c.fillStyle = `rgb(${clampByte(178 + (h1 - 0.5) * 32)},${clampByte(84 + (h1 - 0.5) * 20)},${clampByte(56 + (h1 - 0.5) * 16)})`;
          c.fillRect(rx, by + 2.5, rw, rh - 5);
          ht.fillStyle = '#d2d2d2';
          ht.fillRect(rx, by + 2.5, rw, rh - 5);
        }
      }
    }
    for (let s = 0; s < 12; s++) {
      const sx = x0 + hash2i(s, 1, 3011) * cell;
      const g = c.createLinearGradient(sx, y0, sx, y0 + 260);
      g.addColorStop(0, 'rgba(54, 34, 24, 0.22)');
      g.addColorStop(1, 'rgba(54, 34, 24, 0)');
      c.fillStyle = g;
      c.fillRect(sx - 12, y0, 24, 260);
    }
  }

  // ---- (1,0) CREAM-OCHRE ROMANESQUE CARVED LIMESTONE (`ND-02..07`, `NI-06..11`) ----
  {
    const x0 = 512;
    const y0 = 0;
    c.fillStyle = '#aba08e';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#505050';
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
        const h1 = hash2i(col + 7, r, 3101);
        const rx = Math.max(x0, bx + 2.5);
        const rw = Math.min(cw - 5, x0 + cell - rx);
        if (rw > 1) {
          c.fillStyle = `rgb(${clampByte(218 + (h1 - 0.5) * 20)},${clampByte(206 + (h1 - 0.5) * 20)},${clampByte(184 + (h1 - 0.5) * 18)})`;
          c.fillRect(rx, by + 2.5, rw, rh - 5);
          ht.fillStyle = '#c0c0c0';
          ht.fillRect(rx, by + 2.5, rw, rh - 5);
        }
      }
    }
  }

  // ---- (2,0) OCTAGONAL SLATE-GREY ZINC SPIRE CLADDING & STANDING-SEAM RIBS (`ND-20`) ----
  {
    const x0 = 1024;
    const y0 = 0;
    c.fillStyle = '#8e969c';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#808080';
    ht.fillRect(x0, y0, cell, cell);
    for (let r = 0; r < 16; r++) {
      const y = y0 + r * (cell / 16);
      c.fillStyle = r % 2 === 0 ? '#98a0a6' : '#858e94';
      c.fillRect(x0, y, cell, cell / 16 - 2);
      c.fillStyle = '#5e666c';
      c.fillRect(x0, y + cell / 16 - 2, cell, 2);
      ht.fillStyle = '#484848';
      ht.fillRect(x0, y + cell / 16 - 3, cell, 3);
    }
    for (let col = 0; col <= 8; col++) {
      const rx = x0 + col * (cell / 8);
      c.fillStyle = '#aeb6bc';
      c.fillRect(rx - 3, y0, 6, cell);
      ht.fillStyle = '#e0e0e0';
      ht.fillRect(rx - 3, y0, 6, cell);
    }
  }

  // ---- (3,0) FRENCH ENCAUSTIC ISOMETRIC TUMBLING-BLOCK CATHEDRAL FLOOR TILES (`NI-17`) ----
  {
    const x0 = 1536;
    const y0 = 0;
    c.fillStyle = '#d4cab6';
    c.fillRect(x0, y0, cell, cell);
    const cols = 6;
    const rows = 6;
    const dx = cell / cols;
    const dy = cell / rows;
    for (let r = -1; r <= rows; r++) {
      for (let col = -1; col <= cols; col++) {
        const cx = x0 + (col + (r % 2) * 0.5) * dx;
        const cy = y0 + r * dy;
        const hw = dx * 0.5;
        const hh = dy * 0.5;
        // Top diamond (warm cream)
        c.fillStyle = '#e2d8c4';
        c.beginPath();
        c.moveTo(cx, cy - hh);
        c.lineTo(cx + hw, cy - hh * 0.35);
        c.lineTo(cx, cy + hh * 0.3);
        c.lineTo(cx - hw, cy - hh * 0.35);
        c.closePath();
        c.fill();
        // Left face (slate grey)
        c.fillStyle = '#7e7d78';
        c.beginPath();
        c.moveTo(cx - hw, cy - hh * 0.35);
        c.lineTo(cx, cy + hh * 0.3);
        c.lineTo(cx, cy + hh);
        c.lineTo(cx - hw, cy + hh * 0.35);
        c.closePath();
        c.fill();
        // Right face (charcoal terracotta)
        c.fillStyle = '#4e4640';
        c.beginPath();
        c.moveTo(cx, cy + hh * 0.3);
        c.lineTo(cx + hw, cy - hh * 0.35);
        c.lineTo(cx + hw, cy + hh * 0.35);
        c.lineTo(cx, cy + hh);
        c.closePath();
        c.fill();
      }
    }
  }

  // ---- (0,1) WARM CREAM/PALE-OCHRE NAVE PLASTER GROIN VAULTS (`NI-01`, `NI-06`) ----
  {
    const x0 = 0;
    const y0 = 512;
    c.fillStyle = '#e4d6ba';
    c.fillRect(x0, y0, cell, cell);
    for (let i = 0; i < 65; i++) {
      const px = x0 + hash2i(i, 1, 3401) * cell;
      const py = y0 + hash2i(i, 2, 3401) * cell;
      const pr = 22 + hash2i(i, 3, 3401) * 56;
      c.fillStyle = i % 2 === 0 ? 'rgba(212, 194, 158, 0.20)' : 'rgba(242, 232, 210, 0.18)';
      c.beginPath();
      c.arc(px, py, pr, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---- (1,1) GLOWING RUBY/COBALT/GOLD STAINED-GLASS ROMANESQUE LANCET (`NI-13`, `NI-14`, `NI-23`) ----
  {
    const x0 = 512;
    const y0 = 512;
    const g = c.createLinearGradient(x0, y0, x0, y0 + cell);
    g.addColorStop(0, '#f8d24c');
    g.addColorStop(0.3, '#c82834');
    g.addColorStop(0.65, '#2458b8');
    g.addColorStop(1, '#268854');
    c.fillStyle = g;
    c.fillRect(x0, y0, cell, cell);
    // Crisp dark lead diamond/rosette tracery
    c.strokeStyle = '#1e1a18';
    c.lineWidth = 8;
    const step = cell / 6;
    for (let r = 0; r < 6; r++) {
      for (let col = 0; col < 6; col++) {
        const cx = x0 + (col + 0.5) * step;
        const cy = y0 + (r + 0.5) * step;
        c.fillStyle = (r + col) % 3 === 0 ? '#f6d458' : (r + col) % 3 === 1 ? '#d4363c' : '#2c68c8';
        c.beginPath();
        c.arc(cx, cy, step * 0.36, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }
    c.lineWidth = 18;
    c.strokeRect(x0 + 10, y0 + 10, cell - 20, cell - 20);
  }

  // ---- (2,1) CARVED CREAM-LIMESTONE 8-ROUNDEL ROSE WINDOW TRACERY (`ND-13`) ----
  {
    const x0 = 1024;
    const y0 = 512;
    c.fillStyle = '#221c18';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#242424';
    ht.fillRect(x0, y0, cell, cell);
    const cx = x0 + cell * 0.5;
    const cy = y0 + cell * 0.5;
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      // Stained glass radial glow behind tracery
      if (!isH) {
        const rg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 230);
        rg.addColorStop(0, '#f8d870');
        rg.addColorStop(0.45, '#c43238');
        rg.addColorStop(0.85, '#2a569e');
        rg.addColorStop(1, '#1a1816');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(cx, cy, 232, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = isH ? '#eaeaea' : '#dfd4be';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(cx, cy, 230, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, 66, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rx = cx + Math.cos(a) * 148;
        const ry = cy + Math.sin(a) * 148;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(rx, ry, 54, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 66, cy + Math.sin(a) * 66);
        ctx.lineTo(cx + Math.cos(a) * 230, cy + Math.sin(a) * 230);
        ctx.stroke();
      }
    }
  }

  // ---- (3,1) DARK VARNISHED MAHOGANY CATHEDRAL DOORS & PEW TIMBER (`ND-10`, `NI-20..21`) ----
  {
    const x0 = 1536;
    const y0 = 512;
    c.fillStyle = '#381e14';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#707070';
    ht.fillRect(x0, y0, cell, cell);
    for (let p = 0; p < 8; p++) {
      const h1 = hash2i(p, 1, 3701);
      c.fillStyle = `rgb(${clampByte(68 + (h1 - 0.5) * 18)},${clampByte(36 + (h1 - 0.5) * 12)},${clampByte(24 + (h1 - 0.5) * 10)})`;
      c.fillRect(x0 + p * 64 + 3, y0, 58, cell);
    }
    // Molded cathedral door stiles & recessed panels
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.strokeStyle = isH ? '#dcdcdc' : '#24120c';
      ctx.lineWidth = 14;
      for (let r = 0; r < 3; r++) {
        for (let col = 0; col < 2; col++) {
          ctx.strokeRect(x0 + 28 + col * 240, y0 + 26 + r * 162, 214, 134);
        }
      }
    }
  }

  // ---- (0,2) DINH ĐỘC LẬP WARM CREAM-IVORY *ĐÁ RỬA* PRECAST CONCRETE (`DL-03`) ----
  {
    const x0 = 0;
    const y0 = 1024;
    c.fillStyle = '#e8e2d2';
    c.fillRect(x0, y0, cell, cell);
    for (let i = 0; i < 80; i++) {
      const px = x0 + hash2i(i, 1, 3801) * cell;
      const py = y0 + hash2i(i, 2, 3801) * cell;
      const pr = 12 + hash2i(i, 3, 3801) * 32;
      c.fillStyle = i % 2 === 0 ? 'rgba(210, 202, 184, 0.22)' : 'rgba(246, 242, 232, 0.20)';
      c.beginPath();
      c.arc(px, py, pr, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---- (1,2) RUSTICATED POLYGONAL NATURAL STONE (*ĐÁ CHẺ*) BASE (`DL-05`) ----
  {
    const x0 = 512;
    const y0 = 1024;
    c.fillStyle = '#4a4640';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#343434';
    ht.fillRect(x0, y0, cell, cell);
    const rows = 9;
    const cols = 6;
    const rh = cell / rows;
    const cw = cell / cols;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const h1 = hash2i(col, r, 3901);
        const h2 = hash2i(col + 19, r, 3905);
        const cr = clampByte(112 + (h1 - 0.5) * 44);
        const cg = clampByte(104 + (h2 - 0.5) * 36);
        const cb = clampByte(90 + (h1 - 0.5) * 30);
        c.fillStyle = `rgb(${cr},${cg},${cb})`;
        c.fillRect(x0 + col * cw + 4, y0 + r * rh + 4, cw - 8, rh - 8);
        ht.fillStyle = '#c8c8c8';
        ht.fillRect(x0 + col * cw + 4, y0 + r * rh + 4, cw - 8, rh - 8);
      }
    }
  }

  // ---- (2,2) PLUSH GOLDEN-OCHRE BROADLOOM WOOL CARPET (`DI-02`) ----
  {
    const x0 = 1024;
    const y0 = 1024;
    c.fillStyle = '#cfa032';
    c.fillRect(x0, y0, cell, cell);
    for (let i = 0; i < 180; i++) {
      const px = x0 + hash2i(i, 1, 4001) * cell;
      const py = y0 + hash2i(i, 2, 4001) * cell;
      c.fillStyle = i % 2 === 0 ? 'rgba(182, 134, 34, 0.22)' : 'rgba(232, 192, 82, 0.22)';
      c.fillRect(px, py, 16, 6);
    }
  }

  // ---- (3,2) DEEP CRIMSON-VERMILION PLEATED BROCADE CURTAINS & RED CARPET (`DL-11`, `DI-26`) ----
  {
    const x0 = 1536;
    const y0 = 1024;
    c.fillStyle = '#8e1814';
    c.fillRect(x0, y0, cell, cell);
    for (let f = 0; f < 16; f++) {
      const fx = x0 + f * 32;
      const g = c.createLinearGradient(fx, y0, fx + 32, y0);
      g.addColorStop(0, '#5a0e0c');
      g.addColorStop(0.45, '#b8221c');
      g.addColorStop(1, '#5a0e0c');
      c.fillStyle = g;
      c.fillRect(fx, y0, 32, cell);
      ht.fillStyle = f % 2 === 0 ? '#c4c4c4' : '#585858';
      ht.fillRect(fx, y0, 16, cell);
    }
  }

  // ---- (0,3) MOTTLED GOLD-LEAF & VERMILION *SƠN MÀI* LACQUER (`DI-19`, `DI-22`, `DI-23`) ----
  {
    const x0 = 0;
    const y0 = 1536;
    c.fillStyle = '#4c140e';
    c.fillRect(x0, y0, cell, cell);
    for (let i = 0; i < 90; i++) {
      const px = x0 + hash2i(i, 1, 4201) * cell;
      const py = y0 + hash2i(i, 2, 4201) * cell;
      const pr = 10 + hash2i(i, 3, 4201) * 36;
      c.fillStyle = i % 3 === 0 ? 'rgba(226, 178, 56, 0.55)' : i % 3 === 1 ? 'rgba(176, 42, 24, 0.45)' : 'rgba(246, 214, 112, 0.35)';
      c.beginPath();
      c.arc(px, py, pr, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---- (1,3) CARVED FLORAL STONE RELIEF SPANDREL (`DL-06`) ----
  {
    const x0 = 512;
    const y0 = 1536;
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.fillStyle = isH ? '#646464' : '#d6cfc0';
      ctx.fillRect(x0, y0, cell, cell);
      ctx.strokeStyle = isH ? '#eaeaea' : '#b2a894';
      ctx.lineWidth = 10;
      ctx.strokeRect(x0 + 18, y0 + 18, cell - 36, cell - 36);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          ctx.arc(x0 + 82 + i * 116, y0 + 82 + j * 116, 36, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  // ---- (2,3) MILITARY OLIVE-DRAB & 3-TONE CAMOUFLAGE ARMOR (`DL-27`, `DL-31`) ----
  {
    const x0 = 1024;
    const y0 = 1536;
    c.fillStyle = '#465438';
    c.fillRect(x0, y0, cell, cell);
    for (let i = 0; i < 40; i++) {
      const px = x0 + hash2i(i, 1, 4401) * cell;
      const py = y0 + hash2i(i, 2, 4401) * cell;
      const pr = 24 + hash2i(i, 3, 4401) * 65;
      c.fillStyle = i % 3 === 0 ? 'rgba(54, 62, 40, 0.65)' : i % 3 === 1 ? 'rgba(96, 86, 58, 0.45)' : 'rgba(34, 42, 26, 0.55)';
      c.beginPath();
      c.arc(px, py, pr, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---- (3,3) SAIGON TROPICAL PARK EMERALD LAWN (`DL-21`, `ND-30`) ----
  {
    const x0 = 1536;
    const y0 = 1536;
    c.fillStyle = '#367c32';
    c.fillRect(x0, y0, cell, cell);
    for (let s = 0; s < 8; s++) {
      c.fillStyle = s % 2 === 0 ? 'rgba(66, 138, 52, 0.25)' : 'rgba(34, 96, 34, 0.25)';
      c.fillRect(x0 + s * 64, y0, 64, cell);
    }
  }

  // =================================================================================================
  // BOTTOM 1/3 (y: 2048..3072): 9 CRISP 2K ARTWORKS, MURALS, CLOCK, INSCRIPTIONS & MARKINGS
  // =================================================================================================
  const py0 = 2048;

  // 1. 40-PANEL (8×5) *BÌNH NGÔ ĐẠI CÁO* LACQUER MASTERPIECE (`DI-16..18`, x: 0..1024, y: 2048..2560)
  {
    const x = 0;
    const y = py0;
    const pw = 1024;
    const ph = 512;
    // Deep oxblood-crimson mitered lacquer frame
    c.fillStyle = '#4e0c0a';
    c.fillRect(x, y, pw, ph);
    // Warm luminous gold-leaf & amber sky backdrop
    const bg = c.createLinearGradient(x, y + 32, x, y + ph - 32);
    bg.addColorStop(0, '#c89228');
    bg.addColorStop(0.45, '#e6b842');
    bg.addColorStop(0.75, '#7c4c18');
    bg.addColorStop(1, '#26140c');
    c.fillStyle = bg;
    c.fillRect(x + 28, y + 28, pw - 56, ph - 56);
    // Silhouetted dark lacquer mountain peaks
    c.fillStyle = '#24140e';
    c.beginPath();
    c.moveTo(x + 28, y + 340);
    c.quadraticCurveTo(x + 190, y + 110, x + 360, y + 280);
    c.quadraticCurveTo(x + 540, y + 80, x + 740, y + 260);
    c.quadraticCurveTo(x + 880, y + 120, x + pw - 28, y + 310);
    c.lineTo(x + pw - 28, y + ph - 28);
    c.lineTo(x + 28, y + ph - 28);
    c.closePath();
    c.fill();
    // Luminous gold-leaf river & vermilion palace roofs + royal procession figures
    c.fillStyle = '#f2ca58';
    c.beginPath();
    c.moveTo(x + 28, y + 410);
    c.bezierCurveTo(x + 320, y + 330, x + 680, y + 440, x + pw - 28, y + 360);
    c.lineTo(x + pw - 28, y + 420);
    c.bezierCurveTo(x + 680, y + 480, x + 320, y + 390, x + 28, y + 460);
    c.closePath();
    c.fill();
    for (let k = 0; k < 18; k++) {
      const fx = x + 74 + k * 48;
      const fy = y + 310 + (k % 3) * 36;
      c.fillStyle = k % 2 === 0 ? '#c82418' : '#f4e8c4';
      c.fillRect(fx, fy, 14, 28);
    }
    // Crisp 8×5 grid seam lines separating all 40 lacquer panels (`DI-16`!)
    c.strokeStyle = '#1e0c08';
    c.lineWidth = 4;
    const gw = (pw - 56) / 8;
    const gh = (ph - 56) / 5;
    for (let col = 1; col < 8; col++) {
      c.beginPath();
      c.moveTo(x + 28 + col * gw, y + 28);
      c.lineTo(x + 28 + col * gw, y + ph - 28);
      c.stroke();
    }
    for (let row = 1; row < 5; row++) {
      c.beginPath();
      c.moveTo(x + 28, y + 28 + row * gh);
      c.lineTo(x + pw - 28, y + 28 + row * gh);
      c.stroke();
    }
  }

  // 2. PHÒNG ĐẠI YẾN LANDSCAPE LACQUER MURAL (`DI-08`, x: 1024..2048, y: 2048..2560)
  {
    const x = 1024;
    const y = py0;
    const pw = 1024;
    const ph = 512;
    c.fillStyle = '#2a1810';
    c.fillRect(x, y, pw, ph);
    const lg = c.createLinearGradient(x, y + 20, x, y + ph - 20);
    lg.addColorStop(0, '#d4a644');
    lg.addColorStop(0.55, '#9c5a26');
    lg.addColorStop(1, '#2a3822');
    c.fillStyle = lg;
    c.fillRect(x + 20, y + 20, pw - 40, ph - 40);
    c.fillStyle = '#1e2c1a';
    c.beginPath();
    c.moveTo(x + 20, y + 360);
    c.quadraticCurveTo(x + 320, y + 160, x + 640, y + 310);
    c.quadraticCurveTo(x + 860, y + 180, x + pw - 20, y + 340);
    c.lineTo(x + pw - 20, y + ph - 20);
    c.lineTo(x + 20, y + ph - 20);
    c.closePath();
    c.fill();
  }

  // 3. SWISS CATHEDRAL CLOCK FACE WITH ROMAN NUMERALS (`ND-14`, x: 0..384, y: 2560..2816)
  {
    const cx = 192;
    const cy = py0 + 640;
    const rad = 112;
    c.fillStyle = '#dfd6c4';
    c.fillRect(0, py0 + 512, 384, 256);
    c.fillStyle = '#f8f6ee';
    c.strokeStyle = '#383028';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(cx, cy, rad, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    c.fillStyle = '#1c1814';
    c.font = 'bold 20px "Times New Roman", serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI * 0.5 + (i / 12) * Math.PI * 2;
      c.fillText(nums[i], cx + Math.cos(a) * (rad - 22), cy + Math.sin(a) * (rad - 22));
    }
    // Ornate gilded/black clock hands at 10:10
    c.strokeStyle = '#241e18';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx - 46, cy - 36);
    c.moveTo(cx, cy);
    c.lineTo(cx + 62, cy - 42);
    c.stroke();
  }

  // 4. NOTRE-DAME INSCRIBED TYMPANUM (`ND-10`, x: 384..1024, y: 2560..2816)
  {
    const x = 384;
    const y = py0 + 512;
    c.fillStyle = '#dad0bc';
    c.fillRect(x, y, 640, 256);
    c.strokeStyle = '#8e826e';
    c.lineWidth = 8;
    c.strokeRect(x + 12, y + 12, 616, 232);
    c.fillStyle = '#483e32';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = 'bold 30px "Times New Roman", serif';
    c.fillText('DEO OPTIMO MAXIMO', x + 320, y + 72);
    c.font = 'bold 26px "Times New Roman", serif';
    c.fillText('BEATÆ MARIÆ VIRGINI IMMACULATÆ', x + 320, y + 132);
    c.font = 'bold 34px "Times New Roman", serif';
    c.fillText('A.D. 1880', x + 320, y + 194);
  }

  // 5. REGINA PACIS BRONZE PLAQUE (`ND-28`, x: 1024..1536, y: 2560..2816)
  {
    const x = 1024;
    const y = py0 + 512;
    c.fillStyle = '#3a2c22';
    c.fillRect(x, y, 512, 256);
    c.strokeStyle = '#b4924e';
    c.lineWidth = 10;
    c.strokeRect(x + 16, y + 16, 480, 224);
    c.fillStyle = '#e8cf86';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = 'bold 42px "Times New Roman", serif';
    c.fillText('REGINA PACIS', x + 256, y + 84);
    c.font = 'bold 30px "Times New Roman", serif';
    c.fillText('ORA PRO NOBIS', x + 256, y + 144);
    c.font = 'bold 24px "Times New Roman", serif';
    c.fillText('XVII - II - MCMLIX', x + 256, y + 198);
  }

  // 6. HELIPAD TILED DECK WITH TWIN RED BOMB-STRIKE CIRCLES & "H" (`DL-28`, `DL-32`, x: 1536..2048, y: 2560..2816)
  {
    const x = 1536;
    const y = py0 + 512;
    c.fillStyle = '#b4aca0';
    c.fillRect(x, y, 512, 256);
    c.strokeStyle = '#787268';
    c.lineWidth = 2;
    for (let gx = 0; gx <= 512; gx += 32) {
      c.beginPath();
      c.moveTo(x + gx, y);
      c.lineTo(x + gx, y + 256);
      c.stroke();
    }
    for (let gy = 0; gy <= 256; gy += 32) {
      c.beginPath();
      c.moveTo(x, y + gy);
      c.lineTo(x + 512, y + gy);
      c.stroke();
    }
    // Two iconic April 8, 1975 red bomb-strike rings (`DL-32`)
    c.strokeStyle = '#c81c18';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(x + 150, y + 128, 72, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(x + 362, y + 128, 72, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#c81c18';
    c.font = 'bold 28px "Segoe UI", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('8-4-1975', x + 150, y + 128);
    c.fillText('H', x + 362, y + 128);
  }

  // 7. TANK 843 / 390 TURRET NUMERAL & MUSEUM BOARD (`DL-27`, x: 0..682, y: 2816..3072)
  {
    const x = 0;
    const y = py0 + 768;
    c.fillStyle = '#465438';
    c.fillRect(x, y, 682, 256);
    c.fillStyle = '#ffffff';
    c.font = 'bold 130px "Segoe UI", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('843', x + 341, y + 132);
  }

  // 8. UH-1 HUEY "445" MARKING (`DL-31`, x: 682..1364, y: 2816..3072)
  {
    const x = 682;
    const y = py0 + 768;
    c.fillStyle = '#465438';
    c.fillRect(x, y, 682, 256);
    c.fillStyle = '#f8f6ee';
    c.font = 'bold 124px "Segoe UI", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('445', x + 341, y + 132);
  }

  // 9. STATIONS OF THE CROSS BAS-RELIEF PLAQUE (`NI-16`, x: 1364..2048, y: 2816..3072)
  {
    const x = 1364;
    const y = py0 + 768;
    c.fillStyle = '#7e5a28';
    c.fillRect(x, y, 684, 256);
    c.strokeStyle = '#e0b854';
    c.lineWidth = 12;
    c.strokeRect(x + 18, y + 18, 648, 220);
    c.fillStyle = '#d4a644';
    c.fillRect(x + 324, y + 48, 36, 160);
    c.fillRect(x + 264, y + 86, 156, 32);
  }

  return {
    map: wrapCanvasTex(cObj.canvas, true, renderer),
    normalMap: heightCanvasToNormalTex(hObj.canvas, 1.9, renderer)
  };
}

/**
 * Creates the ultra-lean SINGLE-MATERIAL Saigon Heritage Precinct Master Atlas Pack.
 */
export function createSaigonMaterialPack(renderer?: THREE.WebGLRenderer): SaigonMaterialPack {
  const master = createSaigonMasterAtlas(renderer);
  const saigonMasterAtlasMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: master.map,
    normalMap: master.normalMap,
    normalScale: new THREE.Vector2(1.75, 1.75),
    roughness: 0.72,
    metalness: 0.06,
    side: THREE.DoubleSide
  });

  return {
    saigonMasterAtlasMat,
    allMaterials: [saigonMasterAtlasMat],
    allTextures: [master.map, master.normalMap]
  };
}
