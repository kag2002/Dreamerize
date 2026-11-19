import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SAMPLES_DIR = path.join(ROOT_DIR, 'public', 'samples');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function normalizeQuat(w, x, y, z) {
  const len = Math.hypot(w, x, y, z) || 1;
  return [w / len, x / len, y / len, z / len];
}

/**
 * Computes unit quaternion (w, x, y, z) rotating +Y axis to target direction (dx, dy, dz).
 */
function quatFromUpToDir(dx, dy, dz) {
  const len = Math.hypot(dx, dy, dz) || 1;
  const vx = dx / len;
  const vy = dy / len;
  const vz = dz / len;
  const dot = vy;
  if (dot > 0.9999) return [1, 0, 0, 0];
  if (dot < -0.9999) return [0, 1, 0, 0];
  // cross((0,1,0), v) = (vz, 0, -vx)
  return normalizeQuat(1 + dot, vz, 0, -vx);
}

function quatFromEulerY(yaw) {
  const half = yaw * 0.5;
  return [Math.cos(half), 0, Math.sin(half), 0];
}

// ============================================================================
// 1. Generate public/samples/coastal-garden.splat (< 350 KB)
// ============================================================================
function generateCoastalGardenSplat() {
  const rand = mulberry32(0x53504c54);
  const splats = [];

  const pushSplat = (
    px,
    py,
    pz,
    sx,
    sy,
    sz,
    r,
    g,
    b,
    a,
    quat = [1, 0, 0, 0]
  ) => {
    const [qw, qx, qy, qz] = normalizeQuat(quat[0], quat[1], quat[2], quat[3]);
    splats.push({
      px,
      py,
      pz,
      sx,
      sy,
      sz,
      r: clamp(Math.round(r * 255), 0, 255),
      g: clamp(Math.round(g * 255), 0, 255),
      b: clamp(Math.round(b * 255), 0, 255),
      a: clamp(Math.round(a * 255), 0, 255),
      qw,
      qx,
      qy,
      qz
    });
  };

  // A. Lush mossy garden lawn & clover ground (1,650 crisp fine-scale splats)
  for (let i = 0; i < 1650; i++) {
    const angle = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * 15.0;
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad - 1.0;

    // Leave basin hollow for the sapphire reflecting pond at (1.8, -4.4)
    const pondDx = (x - 1.8) / 4.1;
    const pondDz = (z + 4.4) / 3.1;
    if (pondDx * pondDx + pondDz * pondDz < 0.94) continue;

    const undulation = 0.06 * Math.sin(x * 0.28) * Math.cos(z * 0.24);
    const sunPatch = 0.5 + 0.5 * Math.sin(x * 0.4 + z * 0.3);
    const bladeContrast = rand() < 0.3 ? 1.07 : 0.96;
    const r = (0.16 + 0.12 * sunPatch + (rand() - 0.5) * 0.03) * bladeContrast;
    const g = (0.38 + 0.18 * sunPatch + (rand() - 0.5) * 0.04) * bladeContrast;
    const b = (0.14 + 0.05 * sunPatch + (rand() - 0.5) * 0.02) * bladeContrast;

    pushSplat(
      x,
      undulation + (rand() - 0.5) * 0.02,
      z,
      0.19 + rand() * 0.16,
      0.045 + rand() * 0.025,
      0.19 + rand() * 0.16,
      r,
      g,
      b,
      0.78,
      quatFromEulerY(rand() * Math.PI * 2)
    );
  }

  // B. Mossy stepping-stone garden path (480 crisp splats) from z=+9.2 through arch z=+2 to pond edge z=-2.2
  const stoneCount = 16;
  for (let s = 0; s < stoneCount; s++) {
    const t = s / (stoneCount - 1);
    const szCenter = 9.2 - t * 11.4;
    const sxCenter = Math.sin(t * Math.PI * 1.15) * 0.9;
    const yaw = (rand() - 0.5) * 0.5;
    const q = quatFromEulerY(yaw);

    for (let k = 0; k < 22; k++) {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * 0.44;
      const ox = Math.cos(a) * rr;
      const oz = Math.sin(a) * rr * 0.78;
      const shade = 0.64 + (rand() - 0.5) * 0.16;
      pushSplat(
        sxCenter + ox,
        0.045 + (rand() - 0.5) * 0.015,
        szCenter + oz,
        0.095 + rand() * 0.055,
        0.022,
        0.085 + rand() * 0.05,
        shade * 1.04,
        shade * 0.99,
        shade * 0.9,
        0.98,
        q
      );
    }

    for (let m = 0; m < 8; m++) {
      const a = (m / 8) * Math.PI * 2 + rand() * 0.35;
      const rr = 0.46 + rand() * 0.1;
      pushSplat(
        sxCenter + Math.cos(a) * rr,
        0.05 + rand() * 0.03,
        szCenter + Math.sin(a) * rr,
        0.06 + rand() * 0.04,
        0.035 + rand() * 0.025,
        0.06 + rand() * 0.04,
        0.16 + rand() * 0.07,
        0.46 + rand() * 0.14,
        0.14 + rand() * 0.05,
        0.94,
        quatFromEulerY(rand() * Math.PI)
      );
    }
  }

  // C. Sunlit Stone Coastal Pavilion Arch at z = +2.0, columns at x = ±2.35
  const archZ = 2.0;
  const colPositions = [-2.35, 2.35];
  for (const cx of colPositions) {
    // Stepped stone pedestal base
    for (let i = 0; i < 140; i++) {
      const y = rand() * 0.52;
      const w = 0.64 - y * 0.24;
      const px = cx + (rand() - 0.5) * w * 2;
      const pz = archZ + (rand() - 0.5) * w * 2;
      const sun = 0.72 + (px > cx ? 0.14 : -0.1) + (rand() - 0.5) * 0.12;
      pushSplat(
        px,
        y,
        pz,
        0.07 + rand() * 0.04,
        0.04 + rand() * 0.03,
        0.07 + rand() * 0.04,
        sun * 0.98,
        sun * 0.91,
        sun * 0.8,
        0.98
      );
    }

    // Fluted travertine stone shaft (y = 0.52 .. 3.55)
    for (let i = 0; i < 420; i++) {
      const y = 0.52 + rand() * 3.03;
      const theta = rand() * Math.PI * 2;
      const rCol = 0.31 + (rand() - 0.5) * 0.04;
      const px = cx + Math.cos(theta) * rCol;
      const pz = archZ + Math.sin(theta) * rCol;
      const mortarRing = Math.abs(((y * 2.2) % 1) - 0.5) > 0.44 ? 0.82 : 1.0;
      const warm = (0.76 + 0.18 * Math.cos(theta - 0.6) + (rand() - 0.5) * 0.08) * mortarRing;
      const mossMix = y < 1.15 && rand() < 0.26 ? 1 : 0;
      pushSplat(
        px,
        y,
        pz,
        0.05 + rand() * 0.025,
        0.095 + rand() * 0.045,
        0.05 + rand() * 0.025,
        mossMix ? 0.24 : warm * 0.99,
        mossMix ? 0.46 : warm * 0.91,
        mossMix ? 0.18 : warm * 0.78,
        0.98,
        quatFromEulerY(theta)
      );
    }

    // Climbing ivy / flowering vine around columns
    for (let i = 0; i < 110; i++) {
      const y = 0.35 + rand() * 2.9;
      const theta = y * 2.6 + (cx < 0 ? 0.4 : 2.2) + (rand() - 0.5) * 0.45;
      const rVine = 0.36 + rand() * 0.05;
      const isBloom = rand() < 0.26;
      pushSplat(
        cx + Math.cos(theta) * rVine,
        y,
        archZ + Math.sin(theta) * rVine,
        0.042 + rand() * 0.024,
        0.042 + rand() * 0.024,
        0.042 + rand() * 0.024,
        isBloom ? 0.98 : 0.18 + rand() * 0.08,
        isBloom ? 0.66 : 0.48 + rand() * 0.16,
        isBloom ? 0.8 : 0.18 + rand() * 0.06,
        0.96
      );
    }
  }

  // Sweeping Pavilion Stone Arch & Keystone Crown (620 crisp voussoir splats)
  for (let i = 0; i < 620; i++) {
    const t = rand() * Math.PI;
    const radArch = 2.35 + (rand() - 0.5) * 0.28;
    const ax = -Math.cos(t) * radArch;
    const ay = 3.5 + Math.sin(t) * 2.02 + (rand() - 0.5) * 0.18;
    const az = archZ + (rand() - 0.5) * 0.48;
    const tx = Math.sin(t);
    const ty = Math.cos(t);
    const q = quatFromUpToDir(tx, ty, 0);
    const voussoir = Math.abs(((t * 11 / Math.PI) % 1) - 0.5) > 0.44 ? 0.84 : 1.0;
    const sunlit = (0.78 + 0.18 * Math.sin(t) + (rand() - 0.5) * 0.08) * voussoir;
    pushSplat(
      ax,
      ay,
      az,
      0.075 + rand() * 0.035,
      0.11 + rand() * 0.05,
      0.085 + rand() * 0.04,
      sunlit * 0.99,
      sunlit * 0.92,
      sunlit * 0.8,
      0.98,
      q
    );
  }

  // D. Blooming Sakura / Coastal Oak Tree at (-2.7, 0, -4.4)
  const treeBase = [-2.7, 0.0, -4.4];
  const branchSegments = [
    { a: [0, 0, 0], b: [0.25, 1.3, 0.15], r0: 0.34, r1: 0.26, n: 160 },
    { a: [0.25, 1.3, 0.15], b: [0.85, 2.55, 0.35], r0: 0.25, r1: 0.17, n: 130 },
    { a: [0.85, 2.55, 0.35], b: [2.05, 3.45, 0.65], r0: 0.16, r1: 0.09, n: 100 },
    { a: [0.85, 2.55, 0.35], b: [1.5, 3.85, -0.55], r0: 0.14, r1: 0.07, n: 90 },
    { a: [0.25, 1.3, 0.15], b: [-0.95, 2.65, -0.35], r0: 0.2, r1: 0.11, n: 110 },
    { a: [-0.95, 2.65, -0.35], b: [-1.85, 3.65, -0.15], r0: 0.11, r1: 0.06, n: 80 },
    { a: [0.55, 2.1, 0.25], b: [0.35, 3.65, 1.25], r0: 0.14, r1: 0.07, n: 85 }
  ];

  for (const seg of branchSegments) {
    const dx = seg.b[0] - seg.a[0];
    const dy = seg.b[1] - seg.a[1];
    const dz = seg.b[2] - seg.a[2];
    const q = quatFromUpToDir(dx, dy, dz);
    for (let i = 0; i < seg.n; i++) {
      const t = rand();
      const rad = seg.r0 * (1 - t) + seg.r1 * t;
      const ang = rand() * Math.PI * 2;
      const rr = rad * (0.45 + 0.55 * rand());
      const px = treeBase[0] + seg.a[0] + dx * t + Math.cos(ang) * rr;
      const py = treeBase[1] + seg.a[1] + dy * t;
      const pz = treeBase[2] + seg.a[2] + dz * t + Math.sin(ang) * rr;
      const moss = t < 0.38 && rand() < 0.28;
      const bark = 0.26 + rand() * 0.14;
      pushSplat(
        px,
        py,
        pz,
        rad * 0.28,
        0.1 + rand() * 0.06,
        rad * 0.28,
        moss ? 0.2 : bark * 1.18,
        moss ? 0.44 : bark * 0.82,
        moss ? 0.16 : bark * 0.6,
        0.98,
        q
      );
    }
  }

  // Crisp multi-cluster Sakura Blossom & Foliage Crown (2,100 fine splats)
  const canopyCenters = [
    { x: -1.1, y: 3.9, z: -3.7, rx: 1.85, ry: 1.05, rz: 1.65, n: 480 },
    { x: -3.8, y: 3.8, z: -4.5, rx: 1.65, ry: 0.95, rz: 1.55, n: 420 },
    { x: -2.3, y: 4.5, z: -4.9, rx: 1.75, ry: 1.1, rz: 1.55, n: 440 },
    { x: -2.2, y: 3.8, z: -3.0, rx: 1.45, ry: 0.9, rz: 1.35, n: 400 },
    { x: -0.4, y: 3.4, z: -4.2, rx: 1.35, ry: 0.8, rz: 1.25, n: 360 }
  ];

  for (const cluster of canopyCenters) {
    for (let i = 0; i < cluster.n; i++) {
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const rPow = Math.pow(rand(), 0.42);
      const s = Math.sqrt(1 - u * u) * rPow;
      const px = cluster.x + Math.cos(theta) * s * cluster.rx;
      const py = cluster.y + u * rPow * cluster.ry;
      const pz = cluster.z + Math.sin(theta) * s * cluster.rz;

      const sunFacing = clamp((py - 2.8) / 2.6, 0, 1);
      const isLeaf = rand() < 0.25 && sunFacing < 0.65;
      let r, g, b;
      if (isLeaf) {
        r = 0.2 + 0.18 * sunFacing + rand() * 0.06;
        g = 0.5 + 0.24 * sunFacing + rand() * 0.08;
        b = 0.22 + 0.08 * sunFacing;
      } else {
        const highlight = sunFacing * 0.62 + rand() * 0.38;
        r = 0.92 + highlight * 0.08;
        g = 0.54 + highlight * 0.36;
        b = 0.72 + highlight * 0.22;
      }

      pushSplat(
        px,
        py,
        pz,
        0.075 + rand() * 0.065,
        0.055 + rand() * 0.045,
        0.075 + rand() * 0.065,
        r,
        g,
        b,
        0.88 + rand() * 0.1,
        quatFromEulerY(rand() * Math.PI * 2)
      );
    }
  }

  // Drifting sakura petals in the breeze (140 splats)
  for (let i = 0; i < 140; i++) {
    pushSplat(
      -3.5 + rand() * 7.5,
      0.3 + rand() * 3.8,
      -6.5 + rand() * 8.5,
      0.028,
      0.012,
      0.022,
      0.99,
      0.74 + rand() * 0.16,
      0.84 + rand() * 0.12,
      0.92,
      quatFromUpToDir(rand() - 0.5, 1.0, rand() - 0.5)
    );
  }

  // E. Sapphire Reflecting Pond + Pebble Shore + Lantern at (1.8, 0, -4.4)
  const pondCx = 1.8;
  const pondCz = -4.4;
  for (let i = 0; i < 820; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand());
    const px = pondCx + Math.cos(ang) * rad * 3.8;
    const pz = pondCz + Math.sin(ang) * rad * 2.85;
    const depthMix = 1 - rad;
    const sakuraReflect = px < 1.8 && rand() < 0.22;
    const glint = rand() < 0.08;

    let r = 0.07 + 0.18 * (1 - depthMix);
    let g = 0.42 + 0.28 * (1 - depthMix);
    let b = 0.68 + 0.22 * (1 - depthMix);
    if (sakuraReflect) {
      r = 0.74 + rand() * 0.16;
      g = 0.62 + rand() * 0.14;
      b = 0.78 + rand() * 0.14;
    } else if (glint) {
      r = 0.98;
      g = 0.96;
      b = 0.88;
    }

    pushSplat(
      px,
      -0.02 + (rand() - 0.5) * 0.01,
      pz,
      0.13 + rand() * 0.11,
      0.014,
      0.11 + rand() * 0.09,
      r,
      g,
      b,
      0.92,
      quatFromEulerY(rand() * 0.3)
    );
  }

  // Pond shoreline boulders & pebbles (380 splats)
  for (let i = 0; i < 380; i++) {
    const ang = (i / 380) * Math.PI * 2 + (rand() - 0.5) * 0.08;
    const rx = 3.88 + (rand() - 0.5) * 0.38;
    const rz = 2.92 + (rand() - 0.5) * 0.34;
    const px = pondCx + Math.cos(ang) * rx;
    const pz = pondCz + Math.sin(ang) * rz;
    const shade = 0.44 + rand() * 0.24;
    const mossy = rand() < 0.28;
    pushSplat(
      px,
      0.05 + rand() * 0.12,
      pz,
      0.09 + rand() * 0.08,
      0.05 + rand() * 0.04,
      0.085 + rand() * 0.075,
      mossy ? 0.22 : shade,
      mossy ? 0.46 : shade * 0.99,
      mossy ? 0.18 : shade * 0.94,
      0.97,
      quatFromEulerY(rand() * Math.PI)
    );
  }

  // Glowing stone lantern beside the pond at (4.4, 0, -2.5) (220 splats)
  const lx = 4.4;
  const lz = -2.5;
  for (let i = 0; i < 220; i++) {
    const y = rand() * 1.9;
    const isCore = y > 1.06 && y < 1.42 && rand() < 0.52;
    const rLantern = y < 0.3 ? 0.34 : y > 1.42 ? 0.48 * (1 - (y - 1.42) * 1.35) : 0.2;
    const ang = rand() * Math.PI * 2;
    const rr = isCore ? rand() * 0.09 : Math.sqrt(rand()) * Math.max(0.07, rLantern);
    pushSplat(
      lx + Math.cos(ang) * rr,
      y,
      lz + Math.sin(ang) * rr,
      isCore ? 0.045 : 0.06,
      isCore ? 0.045 : 0.038,
      isCore ? 0.045 : 0.06,
      isCore ? 1.0 : 0.64 + rand() * 0.16,
      isCore ? 0.78 : 0.63 + rand() * 0.15,
      isCore ? 0.32 : 0.58 + rand() * 0.14,
      0.98
    );
  }

  // F. 360° Coastal Garden Perimeter, Flowering Shrubs & Sunlit Clouds
  for (let i = 0; i < 720; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = 10.2 + rand() * 4.4;
    const px = Math.cos(ang) * rad;
    const pz = Math.sin(ang) * rad - 1.0;
    const py = 0.18 + rand() * 1.15;
    const isBlossom = rand() < 0.28;
    pushSplat(
      px,
      py,
      pz,
      0.13 + rand() * 0.11,
      0.1 + rand() * 0.09,
      0.13 + rand() * 0.11,
      isBlossom ? 0.96 : 0.16 + rand() * 0.14,
      isBlossom ? 0.7 + rand() * 0.2 : 0.44 + rand() * 0.2,
      isBlossom ? 0.8 + rand() * 0.14 : 0.18 + rand() * 0.1,
      0.92,
      quatFromEulerY(rand() * Math.PI)
    );
  }

  // Distant 360° coastal turquoise ocean shimmer & sunlit cumulus clouds (up to 9,600)
  const targetTotal = 9600;
  let idx = 0;
  while (splats.length < targetTotal) {
    const ang = (idx / 1200) * Math.PI * 2 + (rand() - 0.5) * 0.18;
    if (idx % 3 === 0) {
      // Flush emerald-azure coastal horizon carpet
      const rad = 15.5 + rand() * 8.0;
      pushSplat(
        Math.cos(ang) * rad,
        -0.06 + (rand() - 0.5) * 0.04,
        Math.sin(ang) * rad - 1.0,
        0.55 + rand() * 0.4,
        0.04,
        0.55 + rand() * 0.4,
        0.16 + rand() * 0.08,
        0.52 + rand() * 0.14,
        0.64 + rand() * 0.14,
        0.68,
        quatFromEulerY(ang)
      );
    } else {
      // Soft sunlit 360° cumulus clouds high in the sky
      const rad = 22.0 + rand() * 9.0;
      const cy = 7.5 + rand() * 6.5;
      const warm = 0.94 + rand() * 0.06;
      pushSplat(
        Math.cos(ang) * rad,
        cy,
        Math.sin(ang) * rad - 1.0,
        0.85 + rand() * 0.65,
        0.4 + rand() * 0.35,
        0.75 + rand() * 0.55,
        warm,
        warm * 0.98,
        warm * 0.99,
        0.58 + rand() * 0.22,
        quatFromEulerY(ang)
      );
    }
    idx++;
  }

  // Serialize to 32-byte little-endian .splat format
  const count = splats.length;
  const buf = new ArrayBuffer(count * 32);
  const view = new DataView(buf);
  for (let i = 0; i < count; i++) {
    const s = splats[i];
    const off = i * 32;
    view.setFloat32(off, s.px, true);
    view.setFloat32(off + 4, s.py, true);
    view.setFloat32(off + 8, s.pz, true);
    view.setFloat32(off + 12, s.sx, true);
    view.setFloat32(off + 16, s.sy, true);
    view.setFloat32(off + 20, s.sz, true);
    view.setUint8(off + 24, s.r);
    view.setUint8(off + 25, s.g);
    view.setUint8(off + 26, s.b);
    view.setUint8(off + 27, s.a);
    view.setUint8(off + 28, clamp(Math.round(s.qw * 128 + 128), 0, 255));
    view.setUint8(off + 29, clamp(Math.round(s.qx * 128 + 128), 0, 255));
    view.setUint8(off + 30, clamp(Math.round(s.qy * 128 + 128), 0, 255));
    view.setUint8(off + 31, clamp(Math.round(s.qz * 128 + 128), 0, 255));
  }

  const outPath = path.join(SAMPLES_DIR, 'coastal-garden.splat');
  fs.writeFileSync(outPath, Buffer.from(buf));
  console.log(`Generated ${outPath}: ${count} splats (${(buf.byteLength / 1024).toFixed(2)} KB)`);
}

// ============================================================================
// 2. Generate public/samples/stone-lantern.glb (< 100 KB, valid binary glTF 2.0)
// ============================================================================
function createBoxPrimitive(w, h, d, tx = 0, ty = 0, tz = 0) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hd = d * 0.5;
  const faces = [
    { n: [0, 0, 1], c: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]] },
    { n: [0, 0, -1], c: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]] },
    { n: [0, 1, 0], c: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]] },
    { n: [0, -1, 0], c: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]] },
    { n: [1, 0, 0], c: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]] },
    { n: [-1, 0, 0], c: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]] }
  ];

  const positions = [];
  const normals = [];
  const indices = [];
  let vBase = 0;

  for (const f of faces) {
    for (const pt of f.c) {
      positions.push(pt[0] + tx, pt[1] + ty, pt[2] + tz);
      normals.push(f.n[0], f.n[1], f.n[2]);
    }
    indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
    vBase += 4;
  }

  return { positions, normals, indices };
}

function createCylinderPrimitive(rTop, rBot, height, radialSegs = 12, ty = 0) {
  const positions = [];
  const normals = [];
  const indices = [];
  const halfH = height * 0.5;
  const slope = rBot - rTop;

  // Side ring
  for (let i = 0; i <= radialSegs; i++) {
    const theta = (i / radialSegs) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const nLen = Math.hypot(cos * height, slope, sin * height) || 1;
    const nx = (cos * height) / nLen;
    const ny = slope / nLen;
    const nz = (sin * height) / nLen;

    positions.push(rTop * cos, halfH + ty, rTop * sin);
    normals.push(nx, ny, nz);
    positions.push(rBot * cos, -halfH + ty, rBot * sin);
    normals.push(nx, ny, nz);
  }

  for (let i = 0; i < radialSegs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, d, a, d, c);
  }

  // Top cap
  const topCenterIdx = positions.length / 3;
  positions.push(0, halfH + ty, 0);
  normals.push(0, 1, 0);
  for (let i = 0; i <= radialSegs; i++) {
    const theta = (i / radialSegs) * Math.PI * 2;
    positions.push(rTop * Math.cos(theta), halfH + ty, rTop * Math.sin(theta));
    normals.push(0, 1, 0);
  }
  for (let i = 0; i < radialSegs; i++) {
    indices.push(topCenterIdx, topCenterIdx + 1 + i + 1, topCenterIdx + 1 + i);
  }

  // Bottom cap
  const botCenterIdx = positions.length / 3;
  positions.push(0, -halfH + ty, 0);
  normals.push(0, -1, 0);
  for (let i = 0; i <= radialSegs; i++) {
    const theta = (i / radialSegs) * Math.PI * 2;
    positions.push(rBot * Math.cos(theta), -halfH + ty, rBot * Math.sin(theta));
    normals.push(0, -1, 0);
  }
  for (let i = 0; i < radialSegs; i++) {
    indices.push(botCenterIdx, botCenterIdx + 1 + i, botCenterIdx + 1 + i + 1);
  }

  return { positions, normals, indices };
}

function mergePrimitives(list) {
  const positions = [];
  const normals = [];
  const indices = [];
  let offset = 0;
  for (const item of list) {
    for (const p of item.positions) positions.push(p);
    for (const n of item.normals) normals.push(n);
    for (const idx of item.indices) indices.push(idx + offset);
    offset += item.positions.length / 3;
  }
  return { positions, normals, indices };
}

function generateStoneLanternGlb() {
  const materials = [
    {
      name: 'MossyGranite',
      pbrMetallicRoughness: {
        baseColorFactor: [0.58, 0.59, 0.55, 1.0],
        metallicFactor: 0.04,
        roughnessFactor: 0.88
      }
    },
    {
      name: 'DarkSlate',
      pbrMetallicRoughness: {
        baseColorFactor: [0.32, 0.35, 0.38, 1.0],
        metallicFactor: 0.08,
        roughnessFactor: 0.76
      }
    },
    {
      name: 'WarmLanternCore',
      pbrMetallicRoughness: {
        baseColorFactor: [1.0, 0.86, 0.56, 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.35
      },
      emissiveFactor: [1.0, 0.68, 0.22]
    },
    {
      name: 'AgedCedarWood',
      pbrMetallicRoughness: {
        baseColorFactor: [0.46, 0.29, 0.17, 1.0],
        metallicFactor: 0.02,
        roughnessFactor: 0.82
      }
    },
    {
      name: 'GardenMossGround',
      pbrMetallicRoughness: {
        baseColorFactor: [0.27, 0.43, 0.24, 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.94
      }
    },
    {
      name: 'TranquilWater',
      pbrMetallicRoughness: {
        baseColorFactor: [0.11, 0.44, 0.58, 1.0],
        metallicFactor: 0.15,
        roughnessFactor: 0.12
      }
    },
    {
      name: 'FireflyGlow',
      pbrMetallicRoughness: {
        baseColorFactor: [1.0, 0.94, 0.62, 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.2
      },
      emissiveFactor: [1.0, 0.84, 0.32]
    }
  ];

  // Build primitives grouped by material
  const mossGroundGeo = mergePrimitives([
    createCylinderPrimitive(6.4, 6.8, 0.08, 24, -0.04),
    createBoxPrimitive(1.05, 0.06, 1.05, -0.5, 0.03, 2.2),
    createBoxPrimitive(0.9, 0.06, 0.9, -0.35, 0.03, 0.9)
  ]);

  const tranquilWaterGeo = createBoxPrimitive(2.8, 0.05, 11.4, 2.3, 0.01, 0);

  const graniteParts = [
    // Stepped base plinth
    createCylinderPrimitive(0.72, 0.82, 0.24, 8, 0.12),
    // Tapered stone column shaft
    createCylinderPrimitive(0.24, 0.32, 1.15, 10, 0.82),
    // Middle platform (chūdai)
    createCylinderPrimitive(0.56, 0.38, 0.22, 6, 1.50),
    // 4 firebox corner pillars (hibukuro)
    createBoxPrimitive(0.09, 0.48, 0.09, -0.24, 1.85, -0.24),
    createBoxPrimitive(0.09, 0.48, 0.09, 0.24, 1.85, -0.24),
    createBoxPrimitive(0.09, 0.48, 0.09, -0.24, 1.85, 0.24),
    createBoxPrimitive(0.09, 0.48, 0.09, 0.24, 1.85, 0.24)
  ];
  const stone1 = createCylinderPrimitive(0.42, 0.46, 0.08, 8, 0.04);
  for (let i = 0; i < stone1.positions.length; i += 3) {
    stone1.positions[i] += 0.25;
    stone1.positions[i + 2] += 3.5;
  }
  const lanternGraniteGeo = mergePrimitives([...graniteParts, stone1]);

  const slateRoofGeo = mergePrimitives([
    // Sculpted pagoda roof cap (kasa)
    createCylinderPrimitive(0.24, 0.88, 0.36, 6, 2.26),
    // Roof crown & jewel finial (hōju)
    createCylinderPrimitive(0.14, 0.22, 0.16, 8, 2.52),
    createCylinderPrimitive(0.02, 0.13, 0.22, 8, 2.71)
  ]);

  const lanternCoreGeo = createBoxPrimitive(0.32, 0.36, 0.32, 0, 1.85, 0);

  // Arched wooden garden bridge spanning tranquil stream (centered x = 2.3, z = 0)
  const bridgeParts = [];
  const plankCount = 9;
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1) - 0.5;
    const bx = 2.3 + t * 3.8;
    const archY = 0.16 + Math.cos(t * Math.PI) * 0.48;
    bridgeParts.push(createBoxPrimitive(0.42, 0.09, 1.65, bx, archY, 0));
  }
  // Bridge side posts & continuous sloped handrails connecting posts cleanly
  const postTs = [-0.46, -0.16, 0.16, 0.46];
  for (const sideZ of [-0.78, 0.78]) {
    const postTops = [];
    for (const t of postTs) {
      const bx = 2.3 + t * 3.8;
      const archY = 0.16 + Math.cos(t * Math.PI) * 0.48;
      bridgeParts.push(createBoxPrimitive(0.09, 0.68, 0.09, bx, archY + 0.34, sideZ));
      postTops.push([bx, archY + 0.68]);
    }
    for (let s = 0; s < postTops.length - 1; s++) {
      const [x0, y0] = postTops[s];
      const [x1, y1] = postTops[s + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const mx = 0.5 * (x0 + x1);
      const my = 0.5 * (y0 + y1);
      const rail = createBoxPrimitive(len + 0.08, 0.07, 0.09, 0, 0, 0);
      for (let k = 0; k < rail.positions.length; k += 3) {
        const lx = rail.positions[k];
        const ly = rail.positions[k + 1];
        rail.positions[k] = mx + lx * cos - ly * sin;
        rail.positions[k + 1] = my + lx * sin + ly * cos;
        rail.positions[k + 2] += sideZ;
      }
      bridgeParts.push(rail);
    }
  }
  const bridgeGeo = mergePrimitives(bridgeParts);

  // 3 tiny glowing fireflies for embedded animation node
  const fireflyGeo = mergePrimitives([
    createBoxPrimitive(0.07, 0.07, 0.07, 0.7, 1.7, 0.4),
    createBoxPrimitive(0.06, 0.06, 0.06, -0.75, 2.1, -0.35),
    createBoxPrimitive(0.06, 0.06, 0.06, 0.25, 2.5, 0.65)
  ]);

  // Pack all geometry buffers into a single BIN chunk
  const meshes = [];
  const bufferViews = [];
  const accessors = [];
  const binChunks = [];
  let byteCursor = 0;

  const appendTypedArray = (typedArr) => {
    const raw = Buffer.from(typedArr.buffer, typedArr.byteOffset, typedArr.byteLength);
    const pad = (4 - (raw.byteLength % 4)) % 4;
    const offset = byteCursor;
    binChunks.push(raw);
    if (pad > 0) binChunks.push(Buffer.alloc(pad));
    byteCursor += raw.byteLength + pad;
    return { offset, length: raw.byteLength };
  };

  const addMeshDef = (name, geo, materialIdx) => {
    const posArr = new Float32Array(geo.positions);
    const normArr = new Float32Array(geo.normals);
    const idxArr = new Uint16Array(geo.indices);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < posArr.length; i += 3) {
      const x = posArr[i], y = posArr[i + 1], z = posArr[i + 2];
      if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
    }

    const posBuf = appendTypedArray(posArr);
    const normBuf = appendTypedArray(normArr);
    const idxBuf = appendTypedArray(idxArr);

    const posBvIdx = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: posBuf.offset, byteLength: posBuf.length, target: 34962 });
    const normBvIdx = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: normBuf.offset, byteLength: normBuf.length, target: 34962 });
    const idxBvIdx = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: idxBuf.offset, byteLength: idxBuf.length, target: 34963 });

    const posAccIdx = accessors.length;
    accessors.push({
      bufferView: posBvIdx,
      componentType: 5126, // FLOAT
      count: posArr.length / 3,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    });
    const normAccIdx = accessors.length;
    accessors.push({
      bufferView: normBvIdx,
      componentType: 5126,
      count: normArr.length / 3,
      type: 'VEC3'
    });
    const idxAccIdx = accessors.length;
    accessors.push({
      bufferView: idxBvIdx,
      componentType: 5123, // UNSIGNED_SHORT
      count: idxArr.length,
      type: 'SCALAR'
    });

    const meshIdx = meshes.length;
    meshes.push({
      name,
      primitives: [
        {
          attributes: { POSITION: posAccIdx, NORMAL: normAccIdx },
          indices: idxAccIdx,
          material: materialIdx
        }
      ]
    });
    return meshIdx;
  };

  const mGround = addMeshDef('MossGround', mossGroundGeo, 4);
  const mWater = addMeshDef('TranquilStream', tranquilWaterGeo, 5);
  const mGranite = addMeshDef('StoneLanternGranite', lanternGraniteGeo, 0);
  const mRoof = addMeshDef('StoneLanternRoof', slateRoofGeo, 1);
  const mCore = addMeshDef('StoneLanternCore', lanternCoreGeo, 2);
  const mBridge = addMeshDef('WoodenGardenBridge', bridgeGeo, 3);
  const mFireflies = addMeshDef('LanternFireflies', fireflyGeo, 6);

  // Embedded GLTF animation track (6s gentle orbit + vertical float on fireflies node)
  const times = new Float32Array([0, 1.5, 3.0, 4.5, 6.0]);
  const translations = new Float32Array([
    -0.8, 0.0, -1.2,
    -0.8, 0.22, -1.2,
    -0.8, 0.04, -1.2,
    -0.8, -0.14, -1.2,
    -0.8, 0.0, -1.2
  ]);
  const rotations = new Float32Array([
    0, 0, 0, 1,
    0, Math.sin(Math.PI * 0.25), 0, Math.cos(Math.PI * 0.25),
    0, Math.sin(Math.PI * 0.5), 0, Math.cos(Math.PI * 0.5),
    0, Math.sin(Math.PI * 0.75), 0, Math.cos(Math.PI * 0.75),
    0, 0, 0, 1
  ]);

  const tBuf = appendTypedArray(times);
  const posAnimBuf = appendTypedArray(translations);
  const rotAnimBuf = appendTypedArray(rotations);

  const tBv = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: tBuf.offset, byteLength: tBuf.length });
  const pBv = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: posAnimBuf.offset, byteLength: posAnimBuf.length });
  const rBv = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: rotAnimBuf.offset, byteLength: rotAnimBuf.length });

  const tAcc = accessors.length;
  accessors.push({ bufferView: tBv, componentType: 5126, count: 5, type: 'SCALAR', min: [0], max: [6.0] });
  const pAcc = accessors.length;
  accessors.push({ bufferView: pBv, componentType: 5126, count: 5, type: 'VEC3' });
  const rAcc = accessors.length;
  accessors.push({ bufferView: rBv, componentType: 5126, count: 5, type: 'VEC4' });

  const gltfJson = {
    asset: { version: '2.0', generator: 'Dreamerize Sample Asset Generator' },
    scene: 0,
    scenes: [{ name: 'StoneLanternSanctuary', nodes: [0, 1, 2, 3, 4, 5, 6] }],
    nodes: [
      { name: 'MossGround', mesh: mGround },
      { name: 'TranquilStream', mesh: mWater },
      { name: 'StoneLanternGranite', mesh: mGranite, translation: [-0.8, 0, -1.2] },
      { name: 'StoneLanternRoof', mesh: mRoof, translation: [-0.8, 0, -1.2] },
      { name: 'StoneLanternCore', mesh: mCore, translation: [-0.8, 0, -1.2] },
      { name: 'WoodenGardenBridge', mesh: mBridge },
      { name: 'LanternFireflies', mesh: mFireflies, translation: [-0.8, 0, -1.2] }
    ],
    materials,
    meshes,
    animations: [
      {
        name: 'FireflyOrbit',
        samplers: [
          { input: tAcc, interpolation: 'LINEAR', output: pAcc },
          { input: tAcc, interpolation: 'LINEAR', output: rAcc }
        ],
        channels: [
          { sampler: 0, target: { node: 6, path: 'translation' } },
          { sampler: 1, target: { node: 6, path: 'rotation' } }
        ]
      }
    ],
    buffers: [{ byteLength: byteCursor }],
    bufferViews,
    accessors
  };

  const jsonStr = JSON.stringify(gltfJson);
  const jsonRaw = Buffer.from(jsonStr, 'utf8');
  const jsonPad = (4 - (jsonRaw.byteLength % 4)) % 4;
  const jsonChunkLen = jsonRaw.byteLength + jsonPad;
  const jsonChunk = Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]);

  const binChunk = Buffer.concat(binChunks);
  const totalLen = 12 + 8 + jsonChunkLen + 8 + binChunk.byteLength;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLen, 8);

  const jsonHdr = Buffer.alloc(8);
  jsonHdr.writeUInt32LE(jsonChunkLen, 0);
  jsonHdr.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binHdr = Buffer.alloc(8);
  binHdr.writeUInt32LE(binChunk.byteLength, 0);
  binHdr.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  const glbBuffer = Buffer.concat([header, jsonHdr, jsonChunk, binHdr, binChunk]);
  const outPath = path.join(SAMPLES_DIR, 'stone-lantern.glb');
  fs.writeFileSync(outPath, glbBuffer);
  console.log(`Generated ${outPath}: ${(glbBuffer.byteLength / 1024).toFixed(2)} KB`);
}

fs.mkdirSync(SAMPLES_DIR, { recursive: true });
generateCoastalGardenSplat();
generateStoneLanternGlb();
