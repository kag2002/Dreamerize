import * as THREE from 'three';
import { CLOUD_SHADOW_GLSL } from './volumetricCloudShader';
import { clamp01, smoothstepJS } from '../vietnam/geometry/math';

export const VIETNAM_WATER_LEVEL = 0.0;

/**
 * Computes the curved centerline Z and deck elevation Y of Cầu Vàng (Golden Bridge)
 * at true 1:1 human scale (150m long, x in [-75, +75], ~23.8m above the Bà Nà gorge floor).
 */
export function getGoldenBridgeCurveAtX(x: number): { z: number; y: number; tangentYaw: number } {
  const halfSpan = 75.0;
  const clampedX = Math.max(-halfSpan, Math.min(halfSpan, x));
  const t = (clampedX + halfSpan) / (2.0 * halfSpan); // 0..1 from west to east
  const s = Math.sin(t * Math.PI);
  const c = Math.cos(t * Math.PI);
  const z = -145.0 - 15.0 * s;
  const y = 22.8 + 1.8 * s;
  const dzdx = (-15.0 * Math.PI / (2.0 * halfSpan)) * c;
  const tangentYaw = Math.atan2(dzdx, 1.0);
  return { z, y, tangentYaw };
}

/**
 * Smooth analytical terrain height function h(x, z) for "Việt Nam Kỳ Vĩ — Danh Thắng Di Sản".
 * Evaluates in O(1) deterministic time across the expanded 4800m × 4800m (wanderRadius: 1450m)
 * 1:1 Human-Scale 3-Region Vietnam Panorama (x, z in [-2400, +2400]):
 * - Inner Core (|x|, |z| < 520m): Hà Nội, Mù Cang Chải, Cầu Vàng, Hạ Long Bay, Huế, Hội An,
 *   Cầu Rồng, Sơn Đoòng, Tây Nguyên, Sài Gòn, Củ Chi, Mekong, Cà Mau, Phú Quốc, Côn Đảo.
 * - Outer Macro Cultural Sanctuary Ring (4800m × 4800m expansion): Tam Cốc Valley, Hội An Quarter & Hoài River,
 *   Huế Đại Nội Palace, Đại Liên Hoa Lotus Sanctuary, Đường Lâm Village, Long Vân Lacquer Valley,
 *   Đông Sơn Solar Plaza, Tây Nguyên Brocade Sanctuary, Đất Nước Heroic Canyon, Historical Filmstrip Colonnade,
 *   Trường Sơn Monsoon Gorge, Điện Biên Citadel Ridge, and Bạch Đằng Grand Armada Estuary.
 */
export function getVietnamHeritageHeight(x: number, z: number): number {
  const absX = Math.abs(x);

  // 1. Base rolling countryside undulation
  const baseRoll =
    0.55 * Math.cos(x * 0.018) * Math.sin(z * 0.016) +
    0.28 * Math.sin(x * 0.035 + 0.5) +
    0.22 * Math.cos(z * 0.031 - 0.3);

  // 2. Gentle eastern rolling hills in the parkland gap between Hoàn Kiếm, Chùa Hương, Hội An & Cầu Rồng
  let eastHills = 0.0;
  if (x > 96.0 && x < 225.0 && z > -125.0 && z < 10.0) {
    let eastHillMask =
      smoothstepJS(96.0, 122.0, x) *
      (1.0 - smoothstepJS(195.0, 225.0, x)) *
      smoothstepJS(-125.0, -95.0, z) *
      (1.0 - smoothstepJS(-14.0, 8.0, z));
    // Carve open Chùa Hương & Suối Yến approach (x in [160, 230], z in [-130, -95])
    if (x > 158.0 && z < -92.0) {
      eastHillMask *= 1.0 - smoothstepJS(158.0, 174.0, x) * (1.0 - smoothstepJS(-104.0, -92.0, z));
    }
    eastHills =
      eastHillMask *
      (2.4 +
        3.6 * smoothstepJS(110.0, 165.0, x) * (1.0 - smoothstepJS(185.0, 220.0, x)) +
        1.1 * Math.sin(x * 0.026 + z * 0.022) +
        0.7 * Math.cos(x * 0.048 - z * 0.035));
  }

  let h = 1.20 + baseRoll + eastHills;

  // 3. Ruộng bậc thang Mù Cang Chải: sweeping mountainous terraced slopes (x in [-320, -110], z in [-115, +12])
  let sapaMask = 0.0;
  let sapaHeight = 0.0;
  if (x > -345.0 && x < -102.0 && z > -128.0 && z < 24.0) {
    const sapaMaskX = smoothstepJS(-104.0, -122.0, x) * (1.0 - smoothstepJS(-305.0, -342.0, x));
    const sapaMaskZ = smoothstepJS(-124.0, -100.0, z) * (1.0 - smoothstepJS(-2.0, 16.0, z));
    const hueExcl = z > -24.0 ? smoothstepJS(50.0, 70.0, Math.hypot(x + 185.0, z - 42.0)) : 1.0;
    const mySonExcl = z < -86.0 && x < -268.0 ? smoothstepJS(30.0, 46.0, Math.hypot(x + 320.0, z + 135.0)) : 1.0;
    sapaMask = sapaMaskX * sapaMaskZ * hueExcl * mySonExcl;
    if (sapaMask > 0.0001) {
      const contour =
        8.0 * Math.sin(z * 0.024 + 0.4) +
        4.5 * Math.cos(z * 0.013 - 0.8);
      const distUpSlope = Math.min(162.0, Math.max(0.0, (-116.0 - x) + contour * 0.65));
      const stepWidth = 9.0;
      const stepRise = 2.4;
      const phase = distUpSlope / stepWidth;
      const stepIdx = Math.floor(phase);
      const frac = phase - stepIdx;
      const smoothFrac = smoothstepJS(0.72, 0.98, frac);
      sapaHeight = (stepIdx + smoothFrac) * stepRise + 1.4;
    }
  }
  if (sapaMask > 0.0001) {
    h = h * (1.0 - sapaMask) + (sapaHeight + baseRoll * 0.14) * sapaMask;
  }

  // 4. Cầu Vàng (Bà Nà Hills Gorge) (z ~ -145, x in [-95, +95])
  if (z > -195.0 && z < -95.0 && absX < 120.0) {
    // Deep gorge saddle y ~ 2.2m in center (|x| < 22)
    const gorgeMask = (1.0 - smoothstepJS(18.0, 34.0, absX)) * (1.0 - smoothstepJS(16.0, 38.0, Math.abs(z + 150.0)));
    if (gorgeMask > 0.0001) {
      h = h * (1.0 - gorgeMask) + 2.2 * gorgeMask;
    }

    // Two cliff pedestals at (±32, -143) rising to y ~ 9.5m for the two 24m Giant Hands
    const dPedW = x < 4.0 ? Math.hypot(x + 32.0, z + 143.0) : 999.0;
    const dPedE = x > -4.0 ? Math.hypot(x - 32.0, z + 143.0) : 999.0;
    const mPedW = dPedW < 20.0 ? 1.0 - smoothstepJS(6.5, 20.0, dPedW) : 0.0;
    const mPedE = dPedE < 20.0 ? 1.0 - smoothstepJS(6.5, 20.0, dPedE) : 0.0;
    const mPed = Math.max(mPedW, mPedE);
    if (mPed > 0.0001) {
      h = h * (1.0 - mPed) + 9.5 * mPed;
    }

    // Two mountain bluffs at (±78, -145) rising smoothly to y = 23.0m (radius 14m) supporting both bridge ends
    const dBluffW = x < 0.0 ? Math.hypot(x + 78.0, z + 145.0) : 999.0;
    const dBluffE = x >= 0.0 ? Math.hypot(x - 78.0, z + 145.0) : 999.0;
    const mBluffW = dBluffW < 38.0 ? 1.0 - smoothstepJS(14.0, 38.0, dBluffW) : 0.0;
    const mBluffE = dBluffE < 38.0 ? 1.0 - smoothstepJS(14.0, 38.0, dBluffE) : 0.0;
    const mBluff = Math.max(mBluffW, mBluffE);
    if (mBluff > 0.0001) {
      h = h * (1.0 - mBluff) + 23.0 * mBluff;
    }
  }

  // 5. Spawn Promenade & Hanoi Core
  // Spawn Terrace (0, 58) [y = 0.50m, r = 16m], Central Causeway (|x| < 10.5, z in [-36, +52]), Khuê Văn Các Courtyard (0, 0) [r = 26m, y = 1.45m]
  if (absX < 34.0 && z > -48.0 && z < 82.0) {
    const dSpawn = Math.hypot(x, z - 58.0);
    const spawnMask = dSpawn < 24.0 ? 1.0 - smoothstepJS(16.0, 24.0, dSpawn) : 0.0;

    const causewayXMask = 1.0 - smoothstepJS(9.0, 12.0, absX);
    const causewayZMask = smoothstepJS(-44.0, -35.0, z) * (1.0 - smoothstepJS(48.0, 58.0, z));
    const causewayMask = causewayXMask * causewayZMask;
    const causewayElev =
      z > 24.0
        ? 1.45 - 0.95 * smoothstepJS(26.0, 50.0, z)
        : 1.45 + 0.20 * (1.0 - smoothstepJS(-42.0, -24.0, z));

    const dCourtyard = Math.hypot(x, z);
    const courtyardMask = dCourtyard < 33.0 ? 1.0 - smoothstepJS(26.0, 33.0, dCourtyard) : 0.0;

    const promenadeMask = Math.max(spawnMask, Math.max(causewayMask, courtyardMask));
    if (promenadeMask > 0.0001) {
      let targetPromH = causewayElev;
      if (courtyardMask > 0.001 || spawnMask > 0.001) {
        const wSpawn = spawnMask;
        const wCourt = courtyardMask;
        const wCause = causewayMask * (1.0 - Math.max(wSpawn, wCourt));
        const wSum = Math.max(1e-5, wSpawn + wCourt + wCause);
        targetPromH = (wSpawn * 0.50 + wCourt * 1.45 + wCause * causewayElev) / wSum;
      }
      h = h * (1.0 - promenadeMask) + targetPromH * promenadeMask;
    }
  }

  // Hoàng Thành Thăng Long (0, -68..-118): spacious flat imperial plaza for Đoan Môn, expanded 46×28m Điện Kính Thiên & Cột Cờ Hà Nội (y = 1.65m)
  if (absX < 62.0 && z > -126.0 && z < -32.0) {
    const mx = 1.0 - smoothstepJS(50.0, 62.0, absX);
    const mz = smoothstepJS(-126.0, -116.0, z) * (1.0 - smoothstepJS(-42.0, -32.0, z));
    const mHT = mx * mz;
    if (mHT > 0.0001) {
      h = h * (1.0 - mHT) + 1.65 * mHT;
    }
  }

  // Chùa Một Cột — Hồ Linh Chiểu (-48, 22): formal square lotus pond basin (x in [-64, -32], z in [6, 38], bed y = -1.25m) + dry stone rim
  if (x > -74.0 && x < -22.0 && z > -4.0 && z < 48.0) {
    const rimMaskX = 1.0 - smoothstepJS(22.0, 26.0, Math.abs(x + 48.0));
    const rimMaskZ = 1.0 - smoothstepJS(22.0, 26.0, Math.abs(z - 22.0));
    const rimMask = rimMaskX * rimMaskZ;
    if (rimMask > 0.0001) {
      h = h * (1.0 - rimMask) + 0.85 * rimMask;
    }
    if (x > -66.0 && x < -30.0 && z > 4.0 && z < 40.0) {
      const basinX = 1.0 - smoothstepJS(14.5, 16.5, Math.abs(x + 48.0));
      const basinZ = 1.0 - smoothstepJS(14.5, 16.5, Math.abs(z - 22.0));
      const basinMask = basinX * basinZ;
      if (basinMask > 0.0001) {
        h = h * (1.0 - basinMask) + (-1.25) * basinMask;
      }
    }
  }

  // Hoàn Kiếm & Tháp Rùa (52, 22): expanded lake (x in [22, 102], z in [-18, 62], bed y = -1.25m) with Gò Rùa Islet (52, 22) & Đảo Ngọc / Đền Ngọc Sơn (78, 3)
  if (x > 18.0 && x < 108.0 && z > -24.0 && z < 68.0) {
    const dxL = Math.abs(x - 62.0) / 40.0;
    const dzL = Math.abs(z - 22.0) / 40.0;
    const dLake = Math.pow(Math.pow(dxL, 3.2) + Math.pow(dzL, 3.2), 1.0 / 3.2);
    if (dLake < 1.05) {
      const lakeMask = 1.0 - smoothstepJS(0.84, 1.04, dLake);
      // Keep Khuê Văn Các Courtyard core (r < 22) & Central Causeway cleanly dry
      const dCourt = Math.hypot(x, z);
      const courtProtect = dCourt < 25.0 ? 1.0 - smoothstepJS(21.5, 25.0, dCourt) : 0.0;
      const effectiveLake = lakeMask * (1.0 - courtProtect);
      if (effectiveLake > 0.0001) {
        h = h * (1.0 - effectiveLake) + (-1.25) * effectiveLake;
      }
    }
    const dIslet = Math.hypot(x - 52.0, z - 22.0);
    if (dIslet < 14.5) {
      const isletMask = 1.0 - smoothstepJS(7.5, 13.8, dIslet);
      if (isletMask > 0.0001) {
        const crown = 0.95 * (1.0 - smoothstepJS(6.5, 12.2, dIslet)) - 0.15 * smoothstepJS(8.5, 13.8, dIslet);
        h = h * (1.0 - isletMask) + Math.max(h, crown) * isletMask;
      }
    }
    // Đảo Ngọc (Ngọc Sơn Temple islet) at (78, 3)
    const dNgoc = Math.hypot(x - 78.0, z - 3.0);
    if (dNgoc < 13.5) {
      const ngocMask = 1.0 - smoothstepJS(7.2, 13.0, dNgoc);
      if (ngocMask > 0.0001) {
        const crown = 1.05 * (1.0 - smoothstepJS(6.2, 11.5, dNgoc));
        h = h * (1.0 - ngocMask) + Math.max(h, crown) * ngocMask;
      }
    }
  }

  // 6. Vịnh Hạ Long Bay Basin (z < -265, spanning full width, bed y = -2.2m)
  if (z < -240.0) {
    const coastZ = -265.0 + 14.0 * Math.sin(x * 0.014) * Math.cos(x * 0.006);
    const bayMask = smoothstepJS(coastZ + 8.0, coastZ - 16.0, z);
    if (bayMask > 0.0001) {
      h = h * (1.0 - bayMask) + (-2.2) * bayMask;
    }
  }

  // 7. Remaining Miền Bắc Peaks & Valleys (applied after Hạ Long so border peaks & cliffs rise cleanly)
  // Đền Hùng — Núi Nghĩa Lĩnh (-195, -210): forested hill y = 26.0m (crown r = 16m, skirt to r = 46m)
  if (x > -245.0 && x < -145.0 && z > -260.0 && z < -160.0) {
    const dDenHung = Math.hypot(x + 195.0, z + 210.0);
    if (dDenHung < 46.0) {
      const m = 1.0 - smoothstepJS(16.0, 46.0, dDenHung);
      h = h * (1.0 - m) + 26.0 * m;
    }
  }

  // Chùa Hương & Suối Yến (195, -180): Limestone Grotto Hill (222, -195) y = 16m & winding Suối Yến river (x in [168, 204], z in [-240, -110])
  if (x > 160.0 && x < 264.0 && z > -248.0 && z < -104.0) {
    if (x > 182.0 && z > -236.0 && z < -154.0) {
      const dGrotto = Math.hypot(x - 222.0, z + 195.0);
      if (dGrotto < 38.0) {
        const mHill = 1.0 - smoothstepJS(16.0, 38.0, dGrotto);
        h = h * (1.0 - mHill) + 16.0 * mHill;
      }
    }
    if (x > 164.0 && x < 208.0 && z > -244.0 && z < -106.0) {
      const riverCx = 186.0 + 5.5 * Math.sin((z + 180.0) * 0.045);
      const mx = 1.0 - smoothstepJS(9.5, 14.5, Math.abs(x - riverCx));
      const mz = smoothstepJS(-242.0, -230.0, z) * (1.0 - smoothstepJS(-122.0, -108.0, z));
      const mSuoiYen = mx * mz;
      if (mSuoiYen > 0.0001) {
        h = h * (1.0 - mSuoiYen) + (-1.1) * mSuoiYen;
      }
    }
  }

  // Cột cờ Lũng Cú (-380, -340): Dragon Mountain peak y = 44.0m (expanded flat summit r = 26m, skirt r = 56m)
  if (x > -440.0 && x < -320.0 && z > -400.0 && z < -280.0) {
    const dLungCu = Math.hypot(x + 380.0, z + 340.0);
    if (dLungCu < 56.0) {
      const m = 1.0 - smoothstepJS(26.0, 56.0, dLungCu);
      h = h * (1.0 - m) + 44.0 * m;
    }
  }

  // Đỉnh Fansipan (400, -330): Monumental Indochina peak y = 74.0m (expanded summit r = 32m for 21.5m Buddha + 11-tier Bảo Tháp + Pagoda, skirt r = 76m)
  if (x > 322.0 && x < 478.0 && z > -408.0 && z < -252.0) {
    const dFansipan = Math.hypot(x - 400.0, z + 330.0);
    if (dFansipan < 76.0) {
      const m = 1.0 - smoothstepJS(32.0, 76.0, dFansipan);
      const ridgeVar =
        dFansipan > 32.0
          ? 2.8 * Math.sin(x * 0.14 + z * 0.12) * smoothstepJS(32.0, 46.0, dFansipan) * (1.0 - smoothstepJS(64.0, 76.0, dFansipan))
          : 0.0;
      h = h * (1.0 - m) + (74.0 + ridgeVar) * m;
    }
  }

  // 8. Miền Trung & Tây Nguyên
  // Cố đô Huế — Ngọ Môn 58m (-185, 42): 92×86m flat imperial grounds (y = 1.55m) + Outer Moat (z in [4, 16], x in [-228, -142], y = -1.2m) + central bridge causeway at x = -185 (±7m)
  if (x > -243.0 && x < -127.0 && z > -13.0 && z < 97.0) {
    const mx = 1.0 - smoothstepJS(46.0, 56.0, Math.abs(x + 185.0));
    const mz = 1.0 - smoothstepJS(43.0, 53.0, Math.abs(z - 42.0));
    const mHue = mx * mz;
    if (mHue > 0.0001) {
      h = h * (1.0 - mHue) + 1.55 * mHue;
    }
    if (x > -231.0 && x < -139.0 && z > 2.0 && z < 18.0) {
      const moatX = 1.0 - smoothstepJS(41.5, 44.0, Math.abs(x + 185.0));
      const moatZ = 1.0 - smoothstepJS(4.5, 6.5, Math.abs(z - 10.0));
      const bridgeProtect = 1.0 - smoothstepJS(6.8, 9.2, Math.abs(x + 185.0));
      const mMoat = moatX * moatZ * (1.0 - bridgeProtect);
      if (mMoat > 0.0001) {
        h = h * (1.0 - mMoat) + (-1.2) * mMoat;
      }
    }
  }

  // Phố cổ Hội An (175, 45): 90×75m town terrace (y = 1.35m) bisected by Hoài River Canal (x in [167, 183], z in [8, 82], y = -1.1m)
  if (x > 118.0 && x < 232.0 && z > -4.0 && z < 94.0) {
    const mx = 1.0 - smoothstepJS(45.0, 55.0, Math.abs(x - 175.0));
    const mz = 1.0 - smoothstepJS(37.5, 47.5, Math.abs(z - 45.0));
    const mHoiAn = mx * mz;
    if (mHoiAn > 0.0001) {
      h = h * (1.0 - mHoiAn) + 1.35 * mHoiAn;
    }
    if (x > 165.0 && x < 185.0 && z > 6.0 && z < 84.0) {
      const cx = 1.0 - smoothstepJS(6.5, 8.8, Math.abs(x - 175.0));
      const cz = smoothstepJS(7.0, 12.0, z) * (1.0 - smoothstepJS(78.0, 83.0, z));
      const mCanal = cx * cz;
      if (mCanal > 0.0001) {
        h = h * (1.0 - mCanal) + (-1.1) * mCanal;
      }
    }
  }

  // Cầu Rồng Đà Nẵng (335, -35): wide Hàn River Estuary (x in [245, 425], z in [-68, -2], y = -1.6m) + level y = 2.0m riverbanks at x = 228 & x = 442
  if (x > 202.0 && x < 468.0 && z > -78.0 && z < 8.0) {
    const zBand = 1.0 - smoothstepJS(33.0, 42.0, Math.abs(z + 35.0));
    const mBankW = x < 252.0 ? (1.0 - smoothstepJS(13.0, 22.0, Math.abs(x - 228.0))) * zBand : 0.0;
    const mBankE = x > 418.0 ? (1.0 - smoothstepJS(13.0, 22.0, Math.abs(x - 442.0))) * zBand : 0.0;
    const mBanks = Math.max(mBankW, mBankE);
    if (mBanks > 0.0001) {
      h = h * (1.0 - mBanks) + 2.0 * mBanks;
    }
    if (x > 241.0 && x < 429.0 && z > -72.0 && z < 2.0) {
      const mx = 1.0 - smoothstepJS(85.0, 92.0, Math.abs(x - 335.0));
      const mz = 1.0 - smoothstepJS(29.0, 35.0, Math.abs(z + 35.0));
      const mHan = mx * mz;
      if (mHan > 0.0001) {
        h = h * (1.0 - mHan) + (-1.6) * mHan;
      }
    }
  }

  // Hang Sơn Đoòng (365, -205): sunken jungle cavern bowl (r = 48m, floor y = 3.0m) + towering karst rim (r = 50..82m, y = 38.0m)
  if (x > 280.0 && x < 450.0 && z > -290.0 && z < -120.0) {
    const dSonDoong = Math.hypot(x - 365.0, z + 205.0);
    if (dSonDoong < 84.0) {
      const outMask = 1.0 - smoothstepJS(66.0, 84.0, dSonDoong);
      const crag = 1.8 * Math.sin(x * 0.11 - z * 0.09) * smoothstepJS(48.0, 56.0, dSonDoong);
      const ridgeProfile = 3.0 + (35.0 + crag) * smoothstepJS(46.0, 55.0, dSonDoong);
      h = h * (1.0 - outMask) + ridgeProfile * outMask;
    }
  }

  // Phong Nha - Kẻ Bàng (275, -255): subterranean river inlet (x in [255, 295], z in [-290, -210], y = -1.6m) flanked by 32m cliff walls at x = 242 & x = 308
  if (x > 220.0 && x < 330.0 && z > -300.0 && z < -198.0) {
    const zBand = smoothstepJS(-296.0, -284.0, z) * (1.0 - smoothstepJS(-216.0, -202.0, z));
    if (zBand > 0.0001) {
      const mCliffW = x < 264.0 ? (1.0 - smoothstepJS(7.0, 20.0, Math.abs(x - 242.0))) * zBand : 0.0;
      const mCliffE = x > 286.0 ? (1.0 - smoothstepJS(7.0, 20.0, Math.abs(x - 308.0))) * zBand : 0.0;
      const mCliffs = Math.max(mCliffW, mCliffE);
      if (mCliffs > 0.0001) {
        h = h * (1.0 - mCliffs) + 32.0 * mCliffs;
      }
    }
    if (x > 251.0 && x < 299.0 && z > -295.0 && z < -206.0) {
      const mx = 1.0 - smoothstepJS(17.5, 22.0, Math.abs(x - 275.0));
      const mz = smoothstepJS(-294.0, -284.0, z) * (1.0 - smoothstepJS(-216.0, -206.0, z));
      const mChan = mx * mz;
      if (mChan > 0.0001) {
        h = h * (1.0 - mChan) + (-1.6) * mChan;
      }
    }
  }

  // Thánh địa Mỹ Sơn (-320, -135): expanded sheltered flat emerald valley floor (r = 38m, y = 4.0m)
  if (x > -378.0 && x < -262.0 && z > -193.0 && z < -77.0) {
    const dMySon = Math.hypot(x + 320.0, z + 135.0);
    if (dMySon < 54.0) {
      const m = 1.0 - smoothstepJS(38.0, 54.0, dMySon);
      h = h * (1.0 - m) + 4.0 * m;
    }
  }

  // Tháp Chàm Poshanư (435, 95): expanded coastal ochre sandstone headland bluff (r = 28m, y = 20.0m)
  if (x > 378.0 && x < 492.0 && z > 38.0 && z < 152.0) {
    const dPoshanu = Math.hypot(x - 435.0, z - 95.0);
    if (dPoshanu < 54.0) {
      const m = 1.0 - smoothstepJS(28.0, 54.0, dPoshanu);
      h = h * (1.0 - m) + 20.0 * m;
    }
  }

  // Biển hồ T'Nưng (Pleiku) (-455, 42): 85m crater lake (r = 42m, bed y = -1.8m) + dark basalt pine rim (r = 45..74m, y = 14.0m, flat east ledge around (-405, 42))
  if (x > -535.0 && x < -375.0 && z > -38.0 && z < 122.0) {
    const dBienHo = Math.hypot(x + 455.0, z - 42.0);
    if (dBienHo < 78.0) {
      const outMask = 1.0 - smoothstepJS(60.0, 76.0, dBienHo);
      const craterProfile = -1.8 + 15.8 * smoothstepJS(39.0, 45.5, dBienHo);
      h = h * (1.0 - outMask) + craterProfile * outMask;
    }
  }

  // Thung lũng Tình Yêu / Đồi Langbiang (Đà Lạt) (-375, 165): expanded highland pine plateau (r = 36m, y = 34.0m, skirt out to r = 72m)
  if (x > -452.0 && x < -298.0 && z > 88.0 && z < 242.0) {
    const dDaLat = Math.hypot(x + 375.0, z - 165.0);
    if (dDaLat < 72.0) {
      const m = 1.0 - smoothstepJS(36.0, 72.0, dDaLat);
      h = h * (1.0 - m) + 34.0 * m;
    }
  }

  // 9. Miền Nam & Hải Đảo (z > +130 to +620)
  // Saigon Grand Heritage Park (z in [145, 318], x in [-260, +260], flat landscaped park y = 1.40m)
  if (z > 132.0 && z < 332.0 && absX < 276.0) {
    const sx = 1.0 - smoothstepJS(256.0, 276.0, absX);
    const sz = smoothstepJS(132.0, 145.0, z) * (1.0 - smoothstepJS(318.0, 332.0, z));
    const mSaigon = sx * sz;
    if (mSaigon > 0.0001) {
      h = h * (1.0 - mSaigon) + 1.40 * mSaigon;
    }
  }

  // Địa đạo Củ Chi (-255, 270): expanded red-laterite bamboo clearing (r = 42m, y = 3.0m) for 9-tier Bến Dược tower & trenches
  if (x > -315.0 && x < -195.0 && z > 210.0 && z < 330.0) {
    const dCuChi = Math.hypot(x + 255.0, z - 270.0);
    if (dCuChi < 56.0) {
      const m = 1.0 - smoothstepJS(42.0, 56.0, dCuChi);
      h = h * (1.0 - m) + 3.0 * m;
    }
  }

  // Tháp Bà Ponagar (Nha Trang) (+265, 275): granite Cù Lao hillock (crown r = 22m, y = 17.5m)
  if (x > 215.0 && x < 315.0 && z > 225.0 && z < 325.0) {
    const dPonagar = Math.hypot(x - 265.0, z - 275.0);
    if (dPonagar < 48.0) {
      const m = 1.0 - smoothstepJS(22.0, 48.0, dPonagar);
      h = h * (1.0 - m) + 17.5 * m;
    }
  }

  // Mekong Delta & Trà Sư Wetland Basin (z in [330, 440], x in [-340, +340])
  if (z > 316.0 && z < 458.0 && absX < 358.0) {
    const dxM = 1.0 - smoothstepJS(336.0, 358.0, absX);
    const dzM = smoothstepJS(322.0, 332.0, z) * (1.0 - smoothstepJS(436.0, 448.0, z));
    const mDelta = dxM * dzM;
    if (mDelta > 0.0001) {
      h = h * (1.0 - mDelta) + 0.80 * mDelta;
    }

    // Broad Mekong River channel (z ~ 365±24, x in [-210, -24], bed y = -1.5m) for Chợ nổi Cái Răng (-72, 365)
    if (x > -222.0 && x < -14.0 && z > 328.0 && z < 402.0) {
      const zCenter = 365.0 + 7.0 * Math.sin((x + 72.0) * 0.025);
      const mx = smoothstepJS(-218.0, -204.0, x) * (1.0 - smoothstepJS(-28.0, -16.0, x));
      const mz = 1.0 - smoothstepJS(20.0, 26.5, Math.abs(z - zCenter));
      const mMekong = mx * mz;
      if (mMekong > 0.0001) {
        h = h * (1.0 - mMekong) + (-1.5) * mMekong;
      }
    }

    // Flooded emerald wetland basin (-245, 395) (expanded r = 64m, bed y = -0.8m) for Rừng tràm Trà Sư
    if (x > -320.0 && x < -170.0 && z > 322.0 && z < 462.0) {
      const dTraSu = Math.hypot(x + 245.0, z - 395.0);
      if (dTraSu < 72.0) {
        const mTraSu = 1.0 - smoothstepJS(56.0, 68.0, dTraSu);
        h = h * (1.0 - mTraSu) + (-0.8) * mTraSu;
      }
    }

    // Broad south embankment highway (x in [-16, +16], z in [320, 455], y = 1.1m) leading down to Mũi Cà Mau
    if (absX < 20.0 && z > 318.0 && z < 458.0) {
      const mx = 1.0 - smoothstepJS(15.0, 20.0, absX);
      const mz = smoothstepJS(318.0, 326.0, z) * (1.0 - smoothstepJS(450.0, 458.0, z));
      const mPath = mx * mz;
      if (mPath > 0.0001) {
        h = h * (1.0 - mPath) + 1.1 * mPath;
      }
    }
  }

  // Southern Pearl Sea (z > 445, bed y = -2.2m) + 3 large real-scale coastal cape/islands
  if (z > 432.0) {
    const southCoastZ = 445.0 + 8.0 * Math.sin(x * 0.014) * Math.sin(x * 0.006);
    const southSeaMask = smoothstepJS(southCoastZ - 6.0, southCoastZ + 16.0, z);
    if (southSeaMask > 0.0001) {
      h = h * (1.0 - southSeaMask) + (-2.2) * southSeaMask;
    }

    // Mũi Cà Mau expanded dry cape headland (0, 485): x in [-34, +34], z in [440, 518], y = +0.95m (for GPS 0001, Con Tàu, Hanoi Flag Tower & mangroves)
    if (absX < 42.0 && z > 436.0 && z < 528.0) {
      const mx = 1.0 - smoothstepJS(32.0, 40.0, absX);
      const mz = smoothstepJS(436.0, 444.0, z) * (1.0 - smoothstepJS(514.0, 524.0, z));
      const mCape = mx * mz;
      if (mCape > 0.0001) {
        h = h * (1.0 - mCape) + 0.95 * mCape;
      }
    }

    // Phú Quốc — Đảo Ngọc (-335, 515): expanded r = 72m, y = 1.2..11.5m (room for Dinh Cậu Cape & Lighthouse)
    if (x > -416.0 && x < -254.0 && z > 434.0 && z < 596.0) {
      const dPQ = Math.hypot(x + 335.0, z - 515.0);
      if (dPQ < 78.0) {
        const mPQ = 1.0 - smoothstepJS(68.0, 78.0, dPQ);
        const profile = 1.2 + 10.3 * (1.0 - smoothstepJS(10.0, 58.0, dPQ));
        h = h * (1.0 - mPQ) + profile * mPQ;
      }
    }

    // Côn Đảo (+335, 510): expanded r = 72m, y = 1.6..17.5m (room for Hàng Dương Memorial & Colonial Quarter)
    if (x > 254.0 && x < 416.0 && z > 429.0 && z < 591.0) {
      const dCD = Math.hypot(x - 335.0, z - 510.0);
      if (dCD < 78.0) {
        const mCD = 1.0 - smoothstepJS(68.0, 78.0, dCD);
        const profile = 1.6 + 15.9 * (1.0 - smoothstepJS(10.0, 58.0, dCD));
        h = h * (1.0 - mCD) + profile * mCD;
      }
    }
  }

  // 9b. Outer Macro Cultural Sanctuary Ring (4800m × 4800m expansion; fast-guarded outside inner core)
  if (absX > 450.0 || z < -268.0 || z > 270.0) {
    // M1: TamCocMacroKarstValley (680, -320) — 420×320m golden rice plain + Ngô Đồng river canal
    if (x > 468.0 && x < 905.0 && z > -445.0 && z < -158.0) {
      const mx = smoothstepJS(468.0, 492.0, x) * (1.0 - smoothstepJS(880.0, 905.0, x));
      const mz = smoothstepJS(-445.0, -420.0, z) * (1.0 - smoothstepJS(-182.0, -158.0, z));
      const mTamCoc = mx * mz;
      if (mTamCoc > 0.0001) {
        h = h * (1.0 - mTamCoc) + 1.25 * mTamCoc;
        const canalCenterZ = -308.0 + 18.0 * Math.sin((x - 680.0) * 0.016);
        const mCanal =
          (1.0 - smoothstepJS(7.5, 13.0, Math.abs(z - canalCenterZ))) *
          smoothstepJS(495.0, 520.0, x) *
          (1.0 - smoothstepJS(845.0, 875.0, x));
        if (mCanal > 0.0001) {
          h = h * (1.0 - mCanal) + (-1.15) * mCanal;
        }
      }
    }

    // M2: HoiAnGrandLanternQuarter (640, 140) — 260×220m town plaza (y = 1.35m)
    if (x > 505.0 && x < 780.0 && z > 26.0 && z < 236.0) {
      const mx = smoothstepJS(505.0, 525.0, x) * (1.0 - smoothstepJS(760.0, 780.0, x));
      const mz = smoothstepJS(26.0, 44.0, z) * (1.0 - smoothstepJS(218.0, 236.0, z));
      const mHoiAnQ = mx * mz;
      if (mHoiAnQ > 0.0001) {
        h = h * (1.0 - mHoiAnQ) + 1.35 * mHoiAnQ;
      }
    }

    // M3: HoaiRiverNightPromenade (760, 260) — 320×240m banks (y = 1.35m) + broad river channel (y = -1.35m)
    if (x > 596.0 && x < 928.0 && z > 212.0 && z < 392.0) {
      const mx = smoothstepJS(596.0, 618.0, x) * (1.0 - smoothstepJS(906.0, 928.0, x));
      const mz = smoothstepJS(212.0, 230.0, z) * (1.0 - smoothstepJS(372.0, 392.0, z));
      const mProm = mx * mz;
      if (mProm > 0.0001) {
        h = h * (1.0 - mProm) + 1.35 * mProm;
        const mRiver =
          smoothstepJS(614.0, 636.0, x) *
          (1.0 - smoothstepJS(884.0, 906.0, x)) *
          smoothstepJS(238.0, 252.0, z) *
          (1.0 - smoothstepJS(322.0, 336.0, z));
        if (mRiver > 0.0001) {
          h = h * (1.0 - mRiver) + (-1.35) * mRiver;
        }
      }
    }

    // M4: HueGrandImperialPalace (-680, 80) — imperial stone court esplanade (y = 1.65m)
    if (x > -770.0 && x < -540.0 && z > -42.0 && z < 208.0) {
      const mx = smoothstepJS(-770.0, -746.0, x) * (1.0 - smoothstepJS(-564.0, -540.0, x));
      const mz = smoothstepJS(-42.0, -22.0, z) * (1.0 - smoothstepJS(188.0, 208.0, z));
      const mHueP = mx * mz;
      if (mHueP > 0.0001) {
        h = h * (1.0 - mHueP) + 1.65 * mHueP;
      }
    }

    // M9: TayNguyenBrocadeSanctuaryMacro (-840, 120) — elevated basalt plateau (y = 14.0m)
    if (x > -1015.0 && x < -765.0 && z > 8.0 && z < 258.0) {
      const mx = smoothstepJS(-1015.0, -982.0, x) * (1.0 - smoothstepJS(-792.0, -765.0, x));
      const mz = smoothstepJS(8.0, 38.0, z) * (1.0 - smoothstepJS(228.0, 258.0, z));
      const mTN = mx * mz;
      if (mTN > 0.0001) {
        h = h * (1.0 - mTN) + 14.0 * mTN;
      }
    }

    // M5: DaiLienHoaLotusSanctuary (0, -560) — circular marble lotus island (r < 54m basin -1.25m, r=54..92m marble esplanade 1.45m)
    if (absX < 114.0 && z > -674.0 && z < -446.0) {
      const dLotus = Math.hypot(x, z + 560.0);
      if (dLotus < 112.0) {
        const islandMask = 1.0 - smoothstepJS(88.0, 112.0, dLotus);
        const basinMask = 1.0 - smoothstepJS(46.0, 56.0, dLotus);
        const lotusElev = 1.45 * (1.0 - basinMask) + (-1.25) * basinMask;
        h = h * (1.0 - islandMask) + lotusElev * islandMask;
      }
    }

    // M6: DuongLamAncientVillageMacro (-640, -180) — 320×280m Red River Delta courtyard (y = 2.2m)
    if (x > -805.0 && x < -480.0 && z > -318.0 && z < -45.0) {
      const mx = smoothstepJS(-805.0, -780.0, x) * (1.0 - smoothstepJS(-505.0, -480.0, x));
      const mz = smoothstepJS(-318.0, -295.0, z) * (1.0 - smoothstepJS(-68.0, -45.0, z));
      const mDL = mx * mz;
      if (mDL > 0.0001) {
        h = h * (1.0 - mDL) + 2.2 * mDL;
      }
    }

    // M7: LongVanLacquerValleyMacro (820, -80) — 360×300m lacquer valley floor (y = 2.0m)
    if (x > 635.0 && x < 1005.0 && z > -225.0 && z < 65.0) {
      const mx = smoothstepJS(635.0, 662.0, x) * (1.0 - smoothstepJS(978.0, 1005.0, x));
      const mz = smoothstepJS(-225.0, -200.0, z) * (1.0 - smoothstepJS(40.0, 65.0, z));
      const mLV = mx * mz;
      if (mLV > 0.0001) {
        h = h * (1.0 - mLV) + 2.0 * mLV;
      }
    }

    // M8: DongSonSunSanctuaryMacro (-680, 420) — 340×300m solar plaza terrace (y = 1.8m)
    if (x > -855.0 && x < -505.0 && z > 265.0 && z < 575.0) {
      const mx = smoothstepJS(-855.0, -826.0, x) * (1.0 - smoothstepJS(-534.0, -505.0, x));
      const mz = smoothstepJS(265.0, 294.0, z) * (1.0 - smoothstepJS(546.0, 575.0, z));
      const mDS = mx * mz;
      if (mDS > 0.0001) {
        h = h * (1.0 - mDS) + 1.8 * mDS;
      }
    }

    // M10: DatNuocHeroicCanyonMacro (-560, -640) — canyon amphitheater floor (18m) & carved horseshoe cliff rim (42m)
    if (x > -755.0 && x < -365.0 && z > -775.0 && z < -505.0) {
      const mx = smoothstepJS(-755.0, -720.0, x) * (1.0 - smoothstepJS(-400.0, -365.0, x));
      const mz = smoothstepJS(-775.0, -740.0, z) * (1.0 - smoothstepJS(-535.0, -505.0, z));
      const mCanyon = mx * mz;
      if (mCanyon > 0.0001) {
        const dRimX = smoothstepJS(72.0, 118.0, Math.abs(x + 560.0));
        const dRimZ = 1.0 - smoothstepJS(-705.0, -655.0, z);
        const rimFactor = Math.max(dRimX, dRimZ);
        const canyonElev = 18.0 + 24.0 * rimFactor;
        h = h * (1.0 - mCanyon) + canyonElev * mCanyon;
      }
    }

    // M11: HistoricalMemoryColonnadeMacro (0, -320) — basalt promenade (z in [-342, -274]) keeping (0, -360) < -1.0!
    if (absX < 138.0 && z > -352.0 && z < -266.0) {
      const mx = 1.0 - smoothstepJS(116.0, 138.0, absX);
      const mz = smoothstepJS(-352.0, -338.0, z) * (1.0 - smoothstepJS(-280.0, -266.0, z));
      const mMem = mx * mz;
      if (mMem > 0.0001) {
        h = h * (1.0 - mMem) + 1.65 * mMem;
      }
    }

    // M13: TruongSonMonsoonJungleGorge (740, -560) — jungle gorge floor (2.4m) & towering side karst ridges (34m)
    if (x > 525.0 && x < 955.0 && z > -735.0 && z < -445.0) {
      const mx = smoothstepJS(525.0, 560.0, x) * (1.0 - smoothstepJS(920.0, 955.0, x));
      const mz = smoothstepJS(-735.0, -700.0, z) * (1.0 - smoothstepJS(-475.0, -445.0, z));
      const mGorge = mx * mz;
      if (mGorge > 0.0001) {
        const wallX = smoothstepJS(56.0, 92.0, Math.abs(x - 740.0));
        const wallZ = 1.0 - smoothstepJS(-665.0, -622.0, z);
        const gorgeElev = 2.4 + 31.6 * Math.max(wallX, wallZ);
        h = h * (1.0 - mGorge) + gorgeElev * mGorge;
      }
    }

    // M14: DienBienHighlandCitadelMacro (-820, -520) — bastion hill (28m) & sweeping highland crag arc (60m)
    if (x > -1025.0 && x < -615.0 && z > -695.0 && z < -345.0) {
      const mx = smoothstepJS(-1025.0, -990.0, x) * (1.0 - smoothstepJS(-650.0, -615.0, x));
      const mz = smoothstepJS(-695.0, -660.0, z) * (1.0 - smoothstepJS(-380.0, -345.0, z));
      const mDB = mx * mz;
      if (mDB > 0.0001) {
        const ridgeBack = 1.0 - smoothstepJS(-595.0, -535.0, z);
        const ridgeSide = smoothstepJS(85.0, 130.0, Math.abs(x + 820.0));
        // FIX HV10-3: Carve genuine -4.5m deep A1 Hill explosive crater depression at (-798, -504, r=16m)
        const dCrater = Math.hypot(x + 798.0, z + 504.0);
        const craterDip = (1.0 - smoothstepJS(2.0, 16.0, dCrater)) * 4.5;
        const dbElev = 28.0 + 32.0 * Math.max(ridgeBack, ridgeSide) - craterDip;
        h = h * (1.0 - mDB) + dbElev * mDB;
      }
    }

    // M15: BachDangGrandArmadaMacro (-240, -760) — wide river estuary (-2.2m) & forested flank riverbanks (2.6m)
    if (x > -478.0 && x < -6.0 && z > -945.0 && z < -585.0) {
      const mWestBank =
        smoothstepJS(-478.0, -460.0, x) *
        (1.0 - smoothstepJS(-430.0, -412.0, x)) *
        smoothstepJS(-920.0, -895.0, z) *
        (1.0 - smoothstepJS(-670.0, -645.0, z));
      const mEastBank =
        smoothstepJS(-55.0, -42.0, x) *
        (1.0 - smoothstepJS(-20.0, -6.0, x)) *
        smoothstepJS(-925.0, -900.0, z) *
        (1.0 - smoothstepJS(-715.0, -695.0, z));
      const mBanks = Math.max(mWestBank, mEastBank);
      if (mBanks > 0.0001) {
        h = h * (1.0 - mBanks) + 2.6 * mBanks;
      }
    }
  }

  // 10. Outer Mountain Border Ring pushed outside |x| > 1650 or z > 1580 (fades smoothly north of Hạ Long Bay)
  const rimDist = Math.max(0.0, Math.max(absX - 1650.0, z - 1580.0));
  if (rimDist > 0.0 && z > -620.0) {
    const rimRise = Math.min(96.0, rimDist * 0.24) * (0.75 + 0.25 * Math.sin(x * 0.015 + z * 0.014));
    h += rimRise * smoothstepJS(-620.0, -420.0, z);
  }

  return h;
}

/**
 * Evaluates smooth surface normal of the Vietnam Heritage terrain in O(1) time.
 */
export function getVietnamHeritageNormal(
  x: number,
  z: number,
  target = new THREE.Vector3()
): THREE.Vector3 {
  const eps = 0.12;
  const hL = getVietnamHeritageHeight(x - eps, z);
  const hR = getVietnamHeritageHeight(x + eps, z);
  const hD = getVietnamHeritageHeight(x, z - eps);
  const hU = getVietnamHeritageHeight(x, z + eps);
  return target.set(hL - hR, 2.0 * eps, hD - hU).normalize();
}

/**
 * Generates an intricate procedural Trống Đồng Đông Sơn (Đông Sơn Bronze Drum)
 * circular plaza medallion texture (albedo + normal + roughness) using pure Uint8Array DataTextures.
 */
export function createDongSonBronzeTextures(
  size = 512,
  renderer?: THREE.WebGLRenderer
): {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
} {
  const colorData = new Uint8Array(size * size * 4);
  const heightBuf = new Float32Array(size * size);
  const roughData = new Uint8Array(size * size * 4);

  const clampB = (v: number) => (v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0);

  for (let py = 0; py < size; py++) {
    const ny = (py / size - 0.5) * 2.0;
    for (let px = 0; px < size; px++) {
      const nx = (px / size - 0.5) * 2.0;
      const r = Math.hypot(nx, ny);
      const ang = Math.atan2(ny, nx);
      const idx = py * size + px;
      const cIdx = idx * 4;

      // Subtle brushed bronze / carved stone micro-grain
      const grain = Math.sin(nx * 97.0 + ny * 53.0) * Math.cos(nx * 41.0 - ny * 89.0) * 0.5 + 0.5;

      // FIX HV01-1: Concentric Ngọc Lũ Heger I bronze drum bands (authentic proportions per ref 38)
      let relief = 0.22 + grain * 0.04;
      let isGoldBronze = false;

      if (r < 0.23) {
        // Prominent 14-pointed central Sun Star (r = 0.23) with raised center boss (r = 0.065) & peacock-feather fillers
        if (r < 0.065) {
          relief = 0.94 - r * 1.4;
          isGoldBronze = true;
        } else {
          const sector = ((((ang / (Math.PI * 2)) % 1) + 1) % 1) * 14.0;
          const frac = Math.abs((sector % 1.0) - 0.5) * 2.0; // 0 at gap center, 1 at ray tip
          const starHalfWidth = Math.max(0.0, (0.228 - r) * 4.8);
          if (frac > 1.0 - Math.min(0.96, starHalfWidth)) {
            relief = 0.92 - r * 0.9;
            isGoldBronze = true;
          } else {
            // Inter-ray triangular peacock-feather (lông công) chevrons + dotted eye
            const eyeDist = Math.hypot((frac - 0.0) * 0.06, r - 0.165);
            const feather =
              eyeDist < 0.014 || (r > 0.095 && r < 0.215 && frac < 0.52 - (r - 0.095) * 2.2)
                ? 0.72
                : 0.22;
            relief = feather;
            isGoldBronze = feather > 0.5;
          }
        }
      } else if (r < 0.30) {
        // Band 1: Double-ring, comb-teeth & 42 tangent-linked dotted circles
        const bandT = (r - 0.23) / 0.07;
        const border = bandT < 0.15 || bandT > 0.85;
        const cellAngle = (Math.PI * 2.0) / 42.0;
        const localA = ((((ang % cellAngle) + cellAngle) % cellAngle) - cellAngle * 0.5) * 0.265;
        const localR = r - 0.265;
        const dCircle = Math.hypot(localA, localR);
        const isCircle = Math.abs(dCircle - 0.018) < 0.004 || dCircle < 0.0055;
        relief = border ? 0.86 : isCircle ? 0.78 : 0.24;
        isGoldBronze = relief > 0.52;
      } else if (r < 0.45) {
        // Band 2: Stilt houses with boat-shaped roofs, feathered dancers & rice pounders
        const bandT = (r - 0.30) / 0.15;
        const border = bandT < 0.08 || bandT > 0.92;
        const u = ((((ang / (Math.PI * 2)) % 1) + 1) % 1) * 12.0;
        const slot = u % 1.0;
        const idxSlot = Math.floor(u);
        if (border) {
          relief = 0.85;
          isGoldBronze = true;
        } else if (idxSlot % 6 === 0) {
          const houseW = Math.abs(slot - 0.5) < 0.34;
          const roofCurve = Math.abs(bandT - (0.58 + Math.pow((slot - 0.5) * 2.2, 2.0) * 0.16)) < 0.09;
          const pillars = Math.abs(slot - 0.32) < 0.05 || Math.abs(slot - 0.68) < 0.05;
          const motif = houseW && (roofCurve || (pillars && bandT < 0.58));
          relief = motif ? 0.82 : 0.23;
          isGoldBronze = motif;
        } else {
          const body = Math.abs(slot - 0.5) < 0.11 && bandT > 0.20 && bandT < 0.72;
          const plume = bandT >= 0.72 && bandT < 0.88 && Math.abs(slot - (0.5 + (bandT - 0.72) * 0.9)) < 0.10;
          const arms = bandT > 0.44 && bandT < 0.56 && Math.abs(slot - 0.5) < 0.28;
          relief = body || plume || arms ? 0.78 : 0.23;
          isGoldBronze = relief > 0.52;
        }
      } else if (r < 0.57) {
        // Band 3 (NEW): 10 Stylized Deer alternating with 10 Standing Lạc Birds
        const bandT = (r - 0.45) / 0.12;
        const border = bandT < 0.10 || bandT > 0.90;
        const u = ((((ang / (Math.PI * 2)) % 1) + 1) % 1) * 20.0;
        const slot = u % 1.0;
        const isDeer = Math.floor(u) % 2 === 0;
        if (border) {
          relief = 0.84;
          isGoldBronze = true;
        } else if (isDeer) {
          const torso = Math.abs(slot - 0.5) < 0.22 && Math.abs(bandT - 0.48) < 0.11;
          const legs = (Math.abs(slot - 0.34) < 0.05 || Math.abs(slot - 0.66) < 0.05) && bandT > 0.16 && bandT < 0.46;
          const neckHead = Math.abs(slot - 0.72) < 0.07 && bandT > 0.48 && bandT < 0.78;
          const antlers = slot > 0.55 && slot < 0.82 && Math.abs(bandT - 0.80) < 0.05;
          relief = torso || legs || neckHead || antlers ? 0.80 : 0.23;
          isGoldBronze = relief > 0.52;
        } else {
          const body = Math.abs(slot - 0.50) < 0.14 && Math.abs(bandT - 0.48) < 0.10;
          const beak = slot > 0.62 && slot < 0.86 && Math.abs(bandT - 0.56) < 0.05;
          const legs = Math.abs(slot - 0.48) < 0.04 && bandT > 0.18 && bandT < 0.42;
          relief = body || beak || legs ? 0.78 : 0.23;
          isGoldBronze = relief > 0.52;
        }
      } else if (r < 0.75) {
        // Band 4: 36 Crisp Counter-Clockwise Flying Lạc Birds (chim Lạc mỏ dài cánh mảnh)
        const bandT = (r - 0.57) / 0.18;
        const border = bandT < 0.08 || bandT > 0.92;
        const u = ((((ang / (Math.PI * 2)) % 1) + 1) % 1) * 36.0;
        const slot = u % 1.0;
        const torso = Math.abs(slot - 0.50) < 0.15 && Math.abs(bandT - 0.48) < 0.10;
        const beak =
          slot > 0.60 &&
          slot < 0.94 &&
          Math.abs(bandT - (0.50 + (slot - 0.60) * 0.14)) < (0.96 - slot) * 0.14;
        const crest =
          slot > 0.14 &&
          slot < 0.46 &&
          Math.abs(bandT - (0.58 + (0.46 - slot) * 0.52)) < 0.05;
        const wingUp = Math.abs(slot - 0.46) < 0.08 && bandT > 0.54 && bandT < 0.86;
        const wingDown = Math.abs(slot - 0.52) < 0.08 && bandT > 0.14 && bandT < 0.42;
        const tail = slot > 0.10 && slot < 0.36 && Math.abs(bandT - 0.36) < 0.055;
        relief = border ? 0.86 : torso || beak || crest || wingUp || wingDown || tail ? 0.86 : 0.22;
        isGoldBronze = relief > 0.52;
      } else if (r < 0.89) {
        // Band 5: Sawtooth triangles, comb hatches & concentric dotted rings
        const bandT = (r - 0.75) / 0.14;
        const border = bandT < 0.10 || bandT > 0.90;
        const teeth = Math.abs(((ang * 64.0) / Math.PI) % 2.0 - 1.0) > 0.50;
        const hatches = Math.sin(ang * 96.0) > 0.15;
        relief = border ? 0.86 : bandT < 0.5 ? (teeth ? 0.74 : 0.24) : hatches ? 0.72 : 0.24;
        isGoldBronze = relief > 0.52;
      } else if (r < 0.96) {
        // Band 6: Solid burnished bronze outer lip
        relief = 0.88;
        isGoldBronze = true;
      } else {
        relief = 0.20;
      }

      heightBuf[idx] = relief;

      if (r > 0.95) {
        // Stone border
        colorData[cIdx] = clampB(156 + grain * 18);
        colorData[cIdx + 1] = clampB(148 + grain * 16);
        colorData[cIdx + 2] = clampB(134 + grain * 14);
        roughData[cIdx] = 205;
      } else if (isGoldBronze) {
        // Polished fresh Đông Sơn bronze highlights (#A9773A)
        colorData[cIdx] = clampB(172 + relief * 48 + grain * 12);
        colorData[cIdx + 1] = clampB(120 + relief * 40 + grain * 10);
        colorData[cIdx + 2] = clampB(56 + relief * 18);
        roughData[cIdx] = clampB(86 - relief * 24);
      } else {
        // Verdigris-patina dark bronze recess (#4F6B5A)
        colorData[cIdx] = clampB(68 + relief * 22 + grain * 10);
        colorData[cIdx + 1] = clampB(96 + relief * 24 + grain * 12);
        colorData[cIdx + 2] = clampB(78 + relief * 18 + grain * 8);
        roughData[cIdx] = 158;
      }
      colorData[cIdx + 3] = 255;
      roughData[cIdx + 1] = roughData[cIdx];
      roughData[cIdx + 2] = roughData[cIdx];
      roughData[cIdx + 3] = 255;
    }
  }

  // Sobel normal map from heightBuf
  const normData = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    const py0 = (py - 1 + size) % size;
    const py1 = (py + 1) % size;
    for (let px = 0; px < size; px++) {
      const px0 = (px - 1 + size) % size;
      const px1 = (px + 1) % size;
      const dx = (heightBuf[py * size + px1] - heightBuf[py * size + px0]) * 5.2;
      const dy = (heightBuf[py1 * size + px] - heightBuf[py0 * size + px]) * 5.2;
      const invLen = 1.0 / Math.hypot(dx, dy, 1.0);
      const cIdx = (py * size + px) * 4;
      normData[cIdx] = clampB((-dx * invLen * 0.5 + 0.5) * 255);
      normData[cIdx + 1] = clampB((-dy * invLen * 0.5 + 0.5) * 255);
      normData[cIdx + 2] = clampB((invLen * 0.5 + 0.5) * 255);
      normData[cIdx + 3] = 255;
    }
  }

  const maxAniso =
    renderer && (renderer as any).capabilities?.getMaxAnisotropy
      ? Math.min(8, (renderer as any).capabilities.getMaxAnisotropy())
      : 1;

  const map = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.needsUpdate = true;

  const normalMap = new THREE.DataTexture(normData, size, size, THREE.RGBAFormat);
  normalMap.anisotropy = maxAniso;
  normalMap.generateMipmaps = true;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  roughnessMap.anisotropy = maxAniso;
  roughnessMap.generateMipmaps = true;
  roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
  roughnessMap.needsUpdate = true;

  return { map, normalMap, roughnessMap };
}

/**
 * Generates brushed champagne-gold anodized PBR normal & roughness maps for Cầu Vàng (Golden Bridge).
 */
export function createGoldenBridgeMetalPbrTextures(
  size = 256,
  renderer?: THREE.WebGLRenderer
): {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
} {
  const colorData = new Uint8Array(size * size * 4);
  const normData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const clampB = (v: number) => (v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const panelSeam = Math.abs((v * 4.0) % 1.0 - 0.5) > 0.485 ? 1.0 : 0.0;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const brush =
        Math.sin(u * 190.0 + Math.sin(v * 23.0) * 1.5) * 0.5 +
        Math.cos(v * 42.0 + u * 11.0) * 0.25;
      const seamX = Math.abs((u * 4.0) % 1.0 - 0.5) > 0.488 ? 1.0 : 0.0;
      const seam = Math.max(panelSeam, seamX);

      const idx = (y * size + x) * 4;
      const shade = 1.0 - seam * 0.22 + brush * 0.04;
      colorData[idx] = clampB(234 * shade);
      colorData[idx + 1] = clampB(184 * shade);
      colorData[idx + 2] = clampB(72 * shade);
      colorData[idx + 3] = 255;

      const nx = brush * 0.14 + seamX * 0.28;
      const ny = seam * 0.34;
      const inv = 1.0 / Math.hypot(nx, ny, 1.0);
      normData[idx] = clampB((-nx * inv * 0.5 + 0.5) * 255);
      normData[idx + 1] = clampB((-ny * inv * 0.5 + 0.5) * 255);
      normData[idx + 2] = clampB((inv * 0.5 + 0.5) * 255);
      normData[idx + 3] = 255;

      const rough = clampB((0.22 + Math.abs(brush) * 0.08 + seam * 0.28) * 255);
      roughData[idx] = rough;
      roughData[idx + 1] = rough;
      roughData[idx + 2] = rough;
      roughData[idx + 3] = 255;
    }
  }

  const maxAniso =
    renderer && (renderer as any).capabilities?.getMaxAnisotropy
      ? Math.min(8, (renderer as any).capabilities.getMaxAnisotropy())
      : 1;

  const makeTex = (data: Uint8Array, srgb: boolean) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 2);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.needsUpdate = true;
    return tex;
  };

  return {
    map: makeTex(colorData, true),
    normalMap: makeTex(normData, false),
    roughnessMap: makeTex(roughData, false)
  };
}

/**
 * Generates scarlet-crimson bamboo-battened Đại Việt war-junk sail texture
 * bearing the royal-blue circular crest with golden sun/moon wings (Ref 15: Bạch Đằng Armada).
 */
export function createRedEmblemSailTexture(size = 256, renderer?: THREE.WebGLRenderer): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const clampB = (v: number) => (v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0);

  for (let py = 0; py < size; py++) {
    const v = py / size;
    const battenDist = Math.abs(((v * 9.0) % 1.0) - 0.5);
    const isBatten = battenDist > 0.445;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const dx = u - 0.5;
      const dy = v - 0.62;
      const dist = Math.hypot(dx, dy);
      const isOuterGoldHalo = Math.abs(dist - 0.165) < 0.018;
      const isBlueCrest = dist < 0.15;
      const isCrescentGold =
        isBlueCrest &&
        Math.hypot(dx, dy - 0.01) < 0.095 &&
        Math.hypot(dx, dy + 0.026) > 0.072;
      const isWingFlare =
        isBlueCrest &&
        Math.abs(dx) > 0.045 &&
        Math.abs(dx) < 0.125 &&
        Math.abs(dy - Math.abs(dx) * 0.55) < 0.022;
      const isCenterStar = isBlueCrest && Math.hypot(dx, dy - 0.045) < 0.032;

      const weave = 0.93 + 0.07 * Math.sin(u * 135.0) * Math.cos(v * 135.0);
      const idx = (py * size + px) * 4;
      if (isBatten) {
        data[idx] = 66;
        data[idx + 1] = 30;
        data[idx + 2] = 18;
      } else if (isOuterGoldHalo || isCrescentGold || isWingFlare || isCenterStar) {
        data[idx] = clampB(224 * weave);
        data[idx + 1] = clampB(174 * weave);
        data[idx + 2] = clampB(62 * weave);
      } else if (isBlueCrest) {
        data[idx] = clampB(26 * weave);
        data[idx + 1] = clampB(64 * weave);
        data[idx + 2] = clampB(168 * weave);
      } else {
        const sunBleach = 0.92 + 0.10 * Math.sin(u * Math.PI);
        data[idx] = clampB(204 * sunBleach * weave);
        data[idx + 1] = clampB(58 * sunBleach * weave);
        data[idx + 2] = clampB(40 * sunBleach * weave);
      }
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if (renderer && (renderer as any).capabilities?.getMaxAnisotropy) {
    tex.anisotropy = Math.min(8, (renderer as any).capabilities.getMaxAnisotropy());
  }
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates traditional ochre ribbed canvas sail texture (*cánh dơi* bat-wing sail)
 * with horizontal bamboo batten ribs and weathered linen grain for Hạ Long junk boats.
 */
export function createBatWingSailTexture(size = 256, renderer?: THREE.WebGLRenderer): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const clampB = (v: number) => (v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    // 8 bamboo batten ribs across vertical sail span
    const battenDist = Math.abs(((v * 8.0) % 1.0) - 0.5);
    const isBatten = battenDist > 0.45;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const weave =
        Math.sin(u * 140.0) * 0.04 +
        Math.cos(v * 140.0) * 0.04 +
        Math.sin(u * 17.0 + v * 13.0) * 0.06;
      const sunBleach = 0.92 + 0.14 * Math.sin(u * Math.PI) * (1.0 - v * 0.35);

      const idx = (y * size + x) * 4;
      if (isBatten) {
        data[idx] = clampB(96 + weave * 80);
        data[idx + 1] = clampB(54 + weave * 50);
        data[idx + 2] = clampB(26 + weave * 30);
      } else {
        data[idx] = clampB((188 * sunBleach + weave * 90));
        data[idx + 1] = clampB((102 * sunBleach + weave * 60));
        data[idx + 2] = clampB((44 * sunBleach + weave * 30));
      }
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if (renderer && (renderer as any).capabilities?.getMaxAnisotropy) {
    tex.anisotropy = Math.min(8, (renderer as any).capabilities.getMaxAnisotropy());
  }
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Golden-hour Vietnamese SkyDome shader with Physical Rayleigh + Mie atmospheric
 * scattering, deep cobalt zenith, warm amber-gold solar corona, and subtle
 * sunlit cirrus wisps behind the VolumetricCloudDome.
 */
export function createVietnamSkyMaterial(customUniforms?: Partial<{
  topColor: string | THREE.Color;
  bottomColor: string | THREE.Color;
  horizonColor: string | THREE.Color;
  sunDirection: [number, number, number] | THREE.Vector3;
  cloudSpeed: number;
  cloudCoverage: number;
}>): THREE.ShaderMaterial {
  let sunDir: THREE.Vector3;
  if (customUniforms?.sunDirection instanceof THREE.Vector3) {
    sunDir = customUniforms.sunDirection.clone().normalize();
  } else if (Array.isArray(customUniforms?.sunDirection)) {
    sunDir = new THREE.Vector3(
      customUniforms.sunDirection[0],
      customUniforms.sunDirection[1],
      customUniforms.sunDirection[2]
    ).normalize();
  } else {
    sunDir = new THREE.Vector3(62, 34, -85).normalize();
  }

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uTopColor: {
        value: customUniforms?.topColor instanceof THREE.Color
          ? customUniforms.topColor
          : new THREE.Color(customUniforms?.topColor ?? '#134294')
      },
      uBottomColor: {
        value: customUniforms?.bottomColor instanceof THREE.Color
          ? customUniforms.bottomColor
          : new THREE.Color(customUniforms?.bottomColor ?? '#d98a4b')
      },
      uHorizonColor: {
        value: customUniforms?.horizonColor instanceof THREE.Color
          ? customUniforms.horizonColor
          : new THREE.Color(customUniforms?.horizonColor ?? '#f2be7e')
      },
      uSunDirection: { value: sunDir },
      uCloudSpeed: { value: customUniforms?.cloudSpeed ?? 0.55 },
      uCloudCoverage: { value: customUniforms?.cloudCoverage ?? 0.48 },
      uBassEnergy: { value: 0.0 },
      uNightFactor: { value: 0.0 },
      uDuskFactor: { value: 0.25 }
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDirection;
      void main() {
        vWorldDirection = normalize(position);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDirection;
      uniform float uCloudSpeed;
      uniform float uCloudCoverage;
      uniform float uBassEnergy;
      uniform float uNightFactor;
      uniform float uDuskFactor;

      varying vec3 vWorldDirection;

      float vhHash3(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float vhNoise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(vhHash3(i + vec3(0,0,0)), vhHash3(i + vec3(1,0,0)), f.x),
              mix(vhHash3(i + vec3(0,1,0)), vhHash3(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(vhHash3(i + vec3(0,0,1)), vhHash3(i + vec3(1,0,1)), f.x),
              mix(vhHash3(i + vec3(0,1,1)), vhHash3(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float vhFbm3(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * vhNoise3(p);
          p = p * 2.04 + vec3(5.3, 9.7, 4.1);
          a *= 0.5;
        }
        return v;
      }

      float miePhaseHG(float cosTheta, float g) {
        float g2 = g * g;
        float denom = max(1.0 + g2 - 2.0 * g * cosTheta, 0.002);
        return (1.0 - g2) / (4.0 * 3.14159265 * pow(denom, 1.5));
      }

      void main() {
        vec3 dir = normalize(vWorldDirection);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 sunDir = normalize(uSunDirection);
        float sunDot = dot(dir, sunDir);
        float sunCos = max(sunDot, 0.0);

        // Physical Rayleigh optical air mass: deep cobalt zenith -> azure mid -> warm amber horizon
        float airMass = 1.0 / (h + 0.11);
        float rayleighWeight = exp(-airMass * 0.24);
        vec3 zenithCol = mix(uTopColor, vec3(0.035, 0.055, 0.13), uNightFactor);
        vec3 midCol = mix(uBottomColor, vec3(0.11, 0.14, 0.25), uNightFactor);
        vec3 horizCol = mix(uHorizonColor, vec3(0.18, 0.16, 0.24), uNightFactor);

        vec3 sky = mix(horizCol, midCol, smoothstep(0.0, 0.16, h));
        sky = mix(sky, zenithCol, smoothstep(0.08, 0.72, rayleighWeight));

        // Rayleigh directional scattering boost away from milky washout
        float rayleighPhase = 0.75 * (1.0 + sunDot * sunDot);
        sky *= mix(0.92, 1.10, clamp(rayleighPhase * 0.65, 0.0, 1.0));

        // Physical Henyey-Greenstein Mie forward scattering (warm amber-gold solar corona)
        float mieTight = miePhaseHG(sunDot, 0.78);
        float mieBroad = miePhaseHG(sunDot, 0.40);
        float horizonBand = exp(-abs(dir.y) * 6.5);
        vec2 dirXZ = normalize(dir.xz + vec2(1e-4));
        vec2 sunXZ = normalize(sunDir.xz + vec2(1e-4));
        float sunAzimuth = pow(max(dot(dirXZ, sunXZ) * 0.5 + 0.5, 0.0), 3.2);

        float dayVis = 1.0 - smoothstep(0.45, 0.95, uNightFactor);
        vec3 mieGlowCol = mix(vec3(1.0, 0.72, 0.34), vec3(1.0, 0.54, 0.24), uDuskFactor);
        sky += mieGlowCol * horizonBand * (0.08 + 0.36 * sunAzimuth) * dayVis;
        sky += mieGlowCol * (mieTight * 0.14 + mieBroad * 0.26) * (0.85 + 0.18 * uBassEnergy) * dayVis;

        // Multi-Layer Volumetric Cloud Banding & Forward-Scattering Silver Lining
        if (h > 0.03 && uCloudCoverage > 0.01) {
          float planeT = 1.0 / max(h, 0.08);
          vec2 skyXZ = dir.xz * min(planeT, 10.0);
          float drift = uTime * 0.006 * max(0.1, uCloudSpeed);
          vec2 cloudUv = skyXZ * 0.42 + vec2(drift, -drift * 0.55);

          // Octave 1: Low-altitude sweeping tropical sunset cumulus bands
          float nBase = vhFbm3(vec3(cloudUv * 0.95, 1.7));
          float nBillow = vhFbm3(vec3(cloudUv * 2.35 + vec2(3.1, 2.3), 3.2));
          float density = nBase * 0.65 + nBillow * 0.35;

          // Octave 2: Mid-altitude silky dragon-cloud streamers
          float nStreamer = sin(cloudUv.x * 1.8 + cloudUv.y * 0.7 + nBase * 2.4) * 0.5 + 0.5;
          density = mix(density, density * (0.8 + 0.4 * nStreamer), 0.5);

          float threshold = mix(0.62, 0.45, clamp(uCloudCoverage, 0.0, 1.0));
          float horizonFade = smoothstep(0.03, 0.14, h) * (1.0 - smoothstep(0.72, 0.96, h));
          float cloudAlpha = smoothstep(threshold, threshold + 0.20, density) * horizonFade;

          // Backlit silver lining rim glow around cloud edges when facing sun/dusk light
          float silverLining = pow(sunCos, 5.0) * (1.0 - smoothstep(threshold, threshold + 0.12, density)) * dayVis;
          float moonRim = pow(max(dot(dir, -sunDir), 0.0), 3.5) * (1.0 - smoothstep(threshold, threshold + 0.12, density)) * uNightFactor * 0.65;

          vec3 cirrusShadow = mix(vec3(0.40, 0.38, 0.52), vec3(0.08, 0.10, 0.18), uNightFactor);
          vec3 cirrusGold = mix(vec3(1.0, 0.78, 0.52), vec3(0.24, 0.28, 0.38), uNightFactor);
          vec3 cirrusCol = mix(cirrusShadow, cirrusGold, smoothstep(0.35, 0.78, density) * 0.7 + 0.3 * pow(sunCos, 2.0));
          cirrusCol += vec3(1.0, 0.88, 0.65) * silverLining * 1.6;
          cirrusCol += vec3(0.75, 0.85, 1.0) * moonRim * 0.9;

          sky = mix(sky, cirrusCol, clamp(cloudAlpha * 0.46, 0.0, 1.0));
        }

        // Crisp solar disc & radiant amber corona
        float sunDisc = smoothstep(0.9987, 0.9997, sunDot) * 2.4 * dayVis;
        float sunCorona = (pow(sunCos, 64.0) * 0.62 + pow(sunCos, 12.0) * 0.16) * dayVis;
        sky += vec3(1.0, 0.86, 0.56) * (sunDisc + sunCorona);

        // Delicate twilight/night stars when uNightFactor > 0.25
        if (uNightFactor > 0.25 && h > 0.05) {
          vec3 starCell = floor(dir * 260.0);
          float starSeed = vhHash3(starCell);
          if (starSeed > 0.992) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + starSeed * 90.0);
            float starMask = smoothstep(0.25, 0.85, uNightFactor) * smoothstep(0.05, 0.28, h);
            sky += vec3(0.92, 0.95, 1.0) * twinkle * starMask * 0.85;
          }
        }

        if (dir.y < 0.0) {
          sky = mix(sky, horizCol * 0.78, smoothstep(0.0, -0.25, dir.y));
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `
  });
}

/**
 * Multi-biome photorealistic terrain shader for Vietnam Heritage Sanctuary (2200m × 2200m, 1:1 human scale):
 * - Ceremonial carved Thanh Hóa sandstone promenade & Khuê Văn Các plaza (~1.5m paving slabs)
 * - Stepped Mù Cang Chải / Sapa terraced rice fields with mirror-water flooded steps & emerald/golden paddies
 * - Stratified limestone mountain cliffs, basalt crater rims & coastal ochre headlands
 * - Saigon Grand Heritage Park plazas, Củ Chi red laterite, Phú Quốc / Côn Đảo sandy beaches & seabed
 */
export function createVietnamTerrainMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSunDirection: { value: sunDir.clone().normalize() },
      uSunColor: { value: new THREE.Color(1.18, 0.90, 0.60) },
      uAmbientScale: { value: 1.0 },
      uWindSpeed: { value: 2.0 },
      uWindDirection: { value: new THREE.Vector2(0.85, 0.45).normalize() },
      uBassEnergy: { value: 0.0 },
      uCloudCoverage: { value: 0.48 },
      uMistIntensity: { value: 0.46 },
      uMistColor: { value: new THREE.Color('#f4c792') },
      fogColor: { value: new THREE.Color('#eab780') },
      fogDensity: { value: 0.000085 }
    },
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>

      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform float uAmbientScale;
      uniform float uWindSpeed;
      uniform vec2 uWindDirection;
      uniform float uBassEnergy;
      uniform float uCloudCoverage;
      uniform float uMistIntensity;
      uniform vec3 uMistColor;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      ${CLOUD_SHADOW_GLSL}

      float vtHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.56);
        return fract(p.x * p.y);
      }

      float vtNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(vtHash(i), vtHash(i + vec2(1.0, 0.0)), u.x),
          mix(vtHash(i + vec2(0.0, 1.0)), vtHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float vtFbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
        for (int i = 0; i < 4; i++) {
          v += a * vtNoise(p);
          p = rot * p * 2.06 + vec2(11.3, 17.7);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec2 xz = vWorldPos.xz;
        float y = vWorldPos.y;
        float slope = 1.0 - clamp(N.y, 0.0, 1.0);

        float fbmLarge = vtFbm(xz * 0.018);
        float fbmMid = vtFbm(xz * 0.14);
        float fbmFine = vtNoise(xz * 1.4);

        // 1. Base tropical emerald, lush velvet moss & warm red-ochre highland laterite
        vec3 lushEmerald = vec3(0.085, 0.245, 0.080);
        vec3 sunlitChartreuse = vec3(0.21, 0.35, 0.105);
        vec3 deepJungleMoss = vec3(0.055, 0.175, 0.070);
        vec3 tropicalLaterite = vec3(0.32, 0.16, 0.09);
        vec3 dryEarth = vec3(0.24, 0.17, 0.11);
        vec3 limestoneRock = vec3(0.33, 0.31, 0.28);

        vec3 albedo = mix(lushEmerald, sunlitChartreuse, smoothstep(0.30, 0.72, fbmLarge));
        albedo = mix(albedo, deepJungleMoss, smoothstep(0.42, 0.78, vtFbm(xz * 0.055 + 3.1)) * 0.45);
        float lateritePatch = smoothstep(0.56, 0.84, fbmMid) * smoothstep(2.5, 18.0, y);
        albedo = mix(albedo, mix(dryEarth, tropicalLaterite, fbmLarge), lateritePatch * 0.42);
        float roughness = 0.86;

        // 2. Stratified limestone cliff faces with lush tropical moss ledges on steep slopes & Bà Nà gorge
        float cliffMask = smoothstep(0.22, 0.50, slope);
        float strata = sin(y * 1.8 + fbmMid * 3.8 + fbmLarge * 2.2) * 0.5 + 0.5;
        vec3 rockCol = mix(limestoneRock * 0.68, limestoneRock * 1.18, strata);
        float mossCatch = smoothstep(0.48, 0.82, N.y + fbmFine * 0.24 + (fbmMid - 0.5) * 0.18);
        rockCol = mix(rockCol, vec3(0.09, 0.21, 0.075), mossCatch * 0.65);
        albedo = mix(albedo, rockCol, cliffMask);
        roughness = mix(roughness, 0.90, cliffMask);

        // 3. Mù Cang Chải / Sapa Terraced Rice Fields (x in [-320, -110], z in [-115, +12])
        float sapaX = smoothstep(-104.0, -122.0, xz.x) * (1.0 - smoothstep(-305.0, -342.0, xz.x));
        float sapaZ = smoothstep(-124.0, -100.0, xz.y) * (1.0 - smoothstep(-2.0, 16.0, xz.y));
        float hueExcl = smoothstep(50.0, 70.0, length(xz - vec2(-185.0, 42.0)));
        float mySonExcl = smoothstep(30.0, 46.0, length(xz - vec2(-320.0, -135.0)));
        float sapaMask = sapaX * sapaZ * hueExcl * mySonExcl;
        float sapaWaterMask = 0.0;
        if (sapaMask > 0.01) {
          float contour = 8.0 * sin(xz.y * 0.024 + 0.4) + 4.5 * cos(xz.y * 0.013 - 0.8);
          float distUp = clamp((-116.0 - xz.x) + contour * 0.65, 0.0, 162.0);
          float stepIdx = floor(distUp / 9.0);
          float frac = fract(distUp / 9.0);
          float isMirrorWaterStep = step(0.54, fract(stepIdx * 0.37));
          float isGoldenStep = step(0.55, fract(stepIdx * 0.61 + 0.2));

          // Rice paddy tread vs mossy earthen bund riser
          float treadMask = 1.0 - smoothstep(0.64, 0.78, frac);
          float bundRim = smoothstep(0.62, 0.72, frac) * (1.0 - smoothstep(0.78, 0.94, frac));
          float cropRows = 0.88 + 0.12 * sin(distUp * 7.5 + fbmMid * 2.5);

          vec3 riceGreen = mix(vec3(0.075, 0.26, 0.055), vec3(0.16, 0.36, 0.075), fbmMid) * cropRows;
          vec3 riceGold = mix(vec3(0.38, 0.30, 0.075), vec3(0.52, 0.39, 0.10), fbmMid) * cropRows;
          vec3 paddyCol = mix(riceGreen, riceGold, isGoldenStep);

          // Wind wave shimmer across rice paddies
          float windWave = sin(dot(xz, uWindDirection) * 0.30 - uTime * uWindSpeed * 1.4 + fbmMid * 3.0);
          paddyCol *= (0.92 + 0.12 * windWave);

          // Rich dark-jade flooded terrace water (mirrors sky only at grazing Fresnel angles)
          vec3 mirrorWater = mix(vec3(0.05, 0.13, 0.11), vec3(0.11, 0.18, 0.14), fbmMid);
          vec3 terraceSurf = mix(paddyCol, mirrorWater, isMirrorWaterStep * 0.86);
          vec3 riserEarth = mix(vec3(0.13, 0.10, 0.065), vec3(0.09, 0.18, 0.065), fbmMid);
          vec3 sapaCol = mix(riserEarth, terraceSurf, treadMask);
          sapaCol = mix(sapaCol, vec3(0.10, 0.15, 0.065), bundRim * 0.65);

          albedo = mix(albedo, sapaCol, sapaMask);
          sapaWaterMask = sapaMask * isMirrorWaterStep * treadMask;
          roughness = mix(roughness, mix(0.84, 0.12, isMirrorWaterStep * treadMask), sapaMask);
        }

        // 3b. Saigon Grand Heritage Park Lawn (z in [145, 318], x in [-260, +260]) & Củ Chi red laterite (-255, 270)
        float saigonX = 1.0 - smoothstep(252.0, 272.0, abs(xz.x));
        float saigonZ = smoothstep(140.0, 152.0, xz.y) * (1.0 - smoothstep(314.0, 328.0, xz.y));
        float saigonMask = saigonX * saigonZ * (1.0 - smoothstep(0.15, 0.35, slope));
        if (saigonMask > 0.01) {
          vec3 gardenLawn = mix(vec3(0.105, 0.285, 0.075), vec3(0.165, 0.345, 0.095), fbmLarge);
          albedo = mix(albedo, gardenLawn, saigonMask * 0.82);
        }
        float cuChiMask = 1.0 - smoothstep(20.0, 34.0, length(xz - vec2(-255.0, 270.0)));
        if (cuChiMask > 0.01) {
          vec3 laterite = mix(vec3(0.34, 0.19, 0.11), vec3(0.24, 0.15, 0.09), fbmMid);
          albedo = mix(albedo, laterite, cuChiMask * 0.78);
        }

        // 3c. Volcanic Basalt Rim (Biển hồ T'Nưng -455, 42) & Coastal Red-Ochre Headlands (Poshanư 435, 95 / Ponagar 265, 275)
        float bienHoDist = length(xz - vec2(-455.0, 42.0));
        if (bienHoDist < 78.0) {
          float basaltMask = smoothstep(40.0, 46.0, bienHoDist) * (1.0 - smoothstep(64.0, 76.0, bienHoDist));
          vec3 basaltCol = mix(vec3(0.15, 0.14, 0.14), vec3(0.22, 0.20, 0.18), fbmMid);
          albedo = mix(albedo, basaltCol, basaltMask * 0.62);
        }
        float ochreMask = max(
          1.0 - smoothstep(18.0, 40.0, length(xz - vec2(435.0, 95.0))),
          1.0 - smoothstep(18.0, 40.0, length(xz - vec2(265.0, 275.0)))
        );
        if (ochreMask > 0.01) {
          vec3 ochreRock = mix(vec3(0.42, 0.24, 0.14), vec3(0.32, 0.21, 0.13), fbmMid);
          albedo = mix(albedo, ochreRock, ochreMask * cliffMask * 0.75);
        }

        // 4. Ceremonial Thanh Hóa Sandstone Promenade, Heritage Courtyards & Saigon Plazas (~1.5m paving slabs)
        float spawnMask = 1.0 - smoothstep(14.5, 19.0, length(xz - vec2(0.0, 58.0)));
        float causeMask = (1.0 - smoothstep(9.0, 11.5, abs(xz.x))) *
                          smoothstep(-42.0, -34.0, xz.y) * (1.0 - smoothstep(48.0, 56.0, xz.y));
        float courtMask = (1.0 - smoothstep(23.5, 28.0, length(xz))) * smoothstep(0.15, 0.55, y);
        float lotusRimMask = (1.0 - smoothstep(19.5, 22.5, abs(xz.x + 48.0))) *
                             (1.0 - smoothstep(19.5, 22.5, abs(xz.y - 22.0))) * smoothstep(0.15, 0.55, y);
        float hoangThanhMask = (1.0 - smoothstep(40.0, 46.0, abs(xz.x))) *
                               smoothstep(-98.0, -92.0, xz.y) * (1.0 - smoothstep(-46.0, -38.0, xz.y));
        float hueCourtMask = (1.0 - smoothstep(42.0, 48.0, abs(xz.x + 185.0))) *
                             (1.0 - smoothstep(39.0, 45.0, abs(xz.y - 42.0))) * smoothstep(0.15, 0.55, y);
        float hoiAnMask = (1.0 - smoothstep(41.0, 47.0, abs(xz.x - 175.0))) *
                          (1.0 - smoothstep(34.0, 40.0, abs(xz.y - 45.0))) * smoothstep(0.15, 0.55, y);
        float cauRongBankMask = max(
          1.0 - smoothstep(11.0, 17.0, abs(xz.x - 228.0)),
          1.0 - smoothstep(11.0, 17.0, abs(xz.x - 442.0))
        ) * (1.0 - smoothstep(30.0, 38.0, abs(xz.y + 35.0))) * smoothstep(0.25, 0.70, y);

        float saigonAvenueMask = (1.0 - smoothstep(10.0, 14.0, abs(xz.x))) *
                                 smoothstep(162.0, 170.0, xz.y) * (1.0 - smoothstep(244.0, 254.0, xz.y));
        float saigonPlazaMask = max(
          max(
            1.0 - smoothstep(22.0, 30.0, length(xz - vec2(-108.0, 190.0))),
            1.0 - smoothstep(28.0, 38.0, length(xz - vec2(0.0, 250.0)))
          ),
          max(
            1.0 - smoothstep(22.0, 30.0, length(xz - vec2(108.0, 190.0))),
            saigonAvenueMask
          )
        );

        float stoneMask = max(
          max(max(spawnMask, causeMask), max(courtMask, lotusRimMask)),
          max(max(hoangThanhMask, hueCourtMask), max(max(hoiAnMask, cauRongBankMask), saigonPlazaMask))
        ) * (1.0 - smoothstep(0.18, 0.36, slope));

        // 4b. Outer Macro Cultural Sanctuary Ground & Paving Masks
        if (abs(xz.x) > 450.0 || xz.y < -268.0 || xz.y > 270.0) {
          float hueMacroMask = (1.0 - smoothstep(72.0, 96.0, abs(xz.x + 655.0))) *
                               (1.0 - smoothstep(88.0, 112.0, abs(xz.y - 80.0)));
          float hoiAnMacroMask = (1.0 - smoothstep(104.0, 128.0, abs(xz.x - 640.0))) *
                                 (1.0 - smoothstep(74.0, 96.0, abs(xz.y - 130.0)));
          float dongSonMacroMask = (1.0 - smoothstep(120.0, 152.0, abs(xz.x + 680.0))) *
                                   (1.0 - smoothstep(110.0, 140.0, abs(xz.y - 420.0)));
          float lotusEsplanade = smoothstep(50.0, 56.0, length(xz - vec2(0.0, -560.0))) *
                                 (1.0 - smoothstep(86.0, 98.0, length(xz - vec2(0.0, -560.0))));
          float memMacroMask = (1.0 - smoothstep(96.0, 126.0, abs(xz.x))) *
                               smoothstep(-344.0, -334.0, xz.y) * (1.0 - smoothstep(-282.0, -270.0, xz.y));
          float canyonFloorMask = (1.0 - smoothstep(80.0, 108.0, abs(xz.x + 560.0))) *
                                  smoothstep(-670.0, -640.0, xz.y) * (1.0 - smoothstep(-530.0, -508.0, xz.y));
          stoneMask = max(stoneMask, max(max(hueMacroMask, hoiAnMacroMask), max(dongSonMacroMask, max(lotusEsplanade, canyonFloorMask))) * (1.0 - smoothstep(0.18, 0.36, slope)));

          // Dark honed basalt promenade at HistoricalMemoryColonnadeMacro
          if (memMacroMask > 0.01) {
            vec3 basaltCol = mix(vec3(0.11, 0.10, 0.095), vec3(0.17, 0.145, 0.13), fbmMid);
            albedo = mix(albedo, basaltCol, memMacroMask * 0.90);
            roughness = mix(roughness, 0.28, memMacroMask);
          }

          // Tam Cốc golden paddy soil around (680, -320)
          float tamCocSoil = (1.0 - smoothstep(160.0, 195.0, abs(xz.x - 680.0))) *
                             (1.0 - smoothstep(105.0, 130.0, abs(xz.y + 315.0)));
          if (tamCocSoil > 0.01) {
            vec3 goldSoil = mix(vec3(0.28, 0.22, 0.10), vec3(0.42, 0.31, 0.12), fbmMid);
            albedo = mix(albedo, goldSoil, tamCocSoil * 0.72);
          }

          // Đường Lâm laterite & brick yard around (-640, -180)
          float duongLamMask = (1.0 - smoothstep(115.0, 145.0, abs(xz.x + 640.0))) *
                               (1.0 - smoothstep(95.0, 125.0, abs(xz.y + 180.0)));
          if (duongLamMask > 0.01) {
            vec3 lateriteYard = mix(vec3(0.35, 0.20, 0.13), vec3(0.26, 0.16, 0.10), fbmMid);
            albedo = mix(albedo, lateriteYard, duongLamMask * 0.78);
          }
        }

        if (stoneMask > 0.01) {
          vec2 tileUv = xz / 1.5;
          vec2 tileF = fract(tileUv);
          float joint = step(tileF.x, 0.045) + step(tileF.y, 0.045);
          float slabVar = vtHash(floor(tileUv));
          // Ceremonial warm sandstone runner along central axis (|x| < 3.6m)
          float runner = (1.0 - smoothstep(3.1, 3.6, abs(xz.x))) * causeMask;
          vec3 stoneCol = mix(vec3(0.45, 0.41, 0.36), vec3(0.57, 0.52, 0.44), slabVar);
          stoneCol = mix(stoneCol, vec3(0.62, 0.50, 0.35), runner * 0.55);
          vec3 jointCol = mix(vec3(0.22, 0.21, 0.18), vec3(0.16, 0.24, 0.13), smoothstep(0.45, 0.8, fbmMid) * 0.55);
          stoneCol = mix(stoneCol, jointCol, clamp(joint, 0.0, 1.0) * 0.65);
          stoneCol *= 0.94 + 0.10 * fbmFine;
          albedo = mix(albedo, stoneCol, stoneMask);
          roughness = mix(roughness, 0.60, stoneMask);
        }

        // 5. Southern Sandy-Beach Tint (z > 440 on y > -0.25, Phú Quốc & Côn Đảo coasts, excluding Mũi Cà Mau mangrove cape)
        if (xz.y > 440.0 && y > -0.25) {
          float beachZone = smoothstep(440.0, 452.0, xz.y) * smoothstep(24.0, 44.0, abs(xz.x));
          float beachElev = smoothstep(-0.2, 0.35, y) * (1.0 - smoothstep(2.2, 4.2, y));
          float sandMask = beachZone * beachElev;
          if (sandMask > 0.01) {
            float isPQ = 1.0 - smoothstep(75.0, 115.0, length(xz - vec2(-335.0, 495.0)));
            vec3 warmSand = mix(vec3(0.68, 0.59, 0.42), vec3(0.76, 0.68, 0.50), fbmFine);
            vec3 pqCreamSand = mix(vec3(0.88, 0.86, 0.80), vec3(0.94, 0.92, 0.86), fbmFine);
            vec3 beachSand = mix(warmSand, pqCreamSand, isPQ);
            albedo = mix(albedo, beachSand, sandMask * 0.94);
            roughness = mix(roughness, 0.78, sandMask);
          }
        }

        // 6. Shoreline wetness & underwater sandy-jade lake/sea bed
        float wetBand = 1.0 - smoothstep(-0.15, 0.38, y);
        albedo = mix(albedo, albedo * vec3(0.56, 0.54, 0.48), wetBand * 0.65);
        if (y < 0.0) {
          vec3 seabed = mix(vec3(0.14, 0.22, 0.19), vec3(0.26, 0.28, 0.22), fbmMid);
          albedo = mix(albedo, seabed, smoothstep(0.0, -0.5, y));
        }
        roughness = mix(roughness, 0.26, wetBand * 0.65);

        // Micro-bump perturbation
        vec3 perturbN = normalize(N + vec3((fbmFine - 0.5) * 0.16, 0.0, (vtNoise(xz * 1.6 + 7.3) - 0.5) * 0.16));

        // Cloud shadow modulation synced with VolumetricCloudDome
        float cloudSun = mix(0.66, 1.0, sampleCloudShadowAtXZ(xz.x, xz.y, uTime, uCloudCoverage, 0.65));

        // Golden-hour physically inspired lighting
        float NdotL = max(dot(perturbN, L), 0.0) * cloudSun;
        vec3 sunColor = uSunColor;
        vec3 skyAmbient = mix(vec3(0.16, 0.21, 0.27), vec3(0.30, 0.37, 0.48), clamp(N.y * 0.5 + 0.5, 0.0, 1.0)) * uAmbientScale;
        vec3 bounceLight = vec3(0.12, 0.13, 0.09) * max(0.0, -N.y * 0.5 + 0.5) * uAmbientScale;

        vec3 H = normalize(L + V);
        float shininess = mix(180.0, 12.0, roughness);
        float spec = pow(max(dot(perturbN, H), 0.0), shininess) * mix(0.85, 0.04, roughness) * cloudSun;

        // Specular golden sky reflection strictly on flooded Sapa water terraces (grazing Fresnel only)
        vec3 R = reflect(-V, perturbN);
        float skyFresnel = pow(1.0 - max(dot(perturbN, V), 0.0), 3.4);
        vec3 skyRefl = mix(vec3(0.95, 0.72, 0.42), vec3(0.26, 0.46, 0.74), clamp(R.y * 1.3, 0.0, 1.0));

        vec3 color = albedo * (skyAmbient + bounceLight + sunColor * NdotL * 1.15);
        color += sunColor * spec * (1.0 + uBassEnergy * 0.15);
        color = mix(color, skyRefl * 0.78, clamp(sapaWaterMask * (0.14 + 0.72 * skyFresnel), 0.0, 0.80));

        // Low translucent valley mist hugging low basins (Hạ Long, Sapa lower valleys, Mekong)
        // without flattening tall mountains or foreground courtyard monuments!
        float camDist = length(cameraPosition - vWorldPos);
        float basinHeight = exp(-max(0.0, y - 1.2) * 0.14);
        float mistWisp = 0.72 + 0.28 * vtFbm(xz * 0.025 + vec2(uTime * 0.02, -uTime * 0.015));
        float valleyMist = smoothstep(42.0, 260.0, camDist) * basinHeight * mistWisp * uMistIntensity;
        color = mix(color, uMistColor, clamp(valleyMist, 0.0, 0.62));

        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Vast Fresnel crystal water shader covering Hồ Linh Chiểu, Hoàn Kiếm, northern Hạ Long Bay (z < -265),
 * central crater lakes & estuaries (Biển Hồ T'Nưng, Suối Yến, Huế moat, Hoài, Hàn), Mekong Delta & Trà Sư,
 * and the Southern Pearl Sea (z > 445) at y = 0.0 with animated swells, golden-hour sky reflections, and foam.
 */
export function createVietnamBayWaterMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSunDirection: { value: sunDir.clone().normalize() },
      uSunColor: { value: new THREE.Color(1.4, 0.96, 0.54) },
      uHorizonColor: { value: new THREE.Color('#f2be7e') },
      uSkyTopColor: { value: new THREE.Color('#134294') },
      uMistIntensity: { value: 0.36 },
      uMistColor: { value: new THREE.Color('#f4c792') },
      uBassEnergy: { value: 0.0 },
      uTrebleEnergy: { value: 0.0 },
      fogColor: { value: new THREE.Color('#eab780') },
      fogDensity: { value: 0.000085 }
    },
    transparent: true,
    depthWrite: true,
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vWorldPos;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        // Animated ocean swell in open Northern Hạ Long Bay (z < -265) and Southern Pearl Sea (z > 445)
        float northBayAmp = smoothstep(-245.0, -295.0, worldPos.z);
        float southSeaAmp = smoothstep(438.0, 475.0, worldPos.z);
        float bayAmp = max(northBayAmp, southSeaAmp);
        float swell = sin(worldPos.x * 0.08 + uTime * 0.9) * cos(worldPos.z * 0.065 - uTime * 0.7) * 0.075 * bayAmp;
        worldPos.y += swell;
        vWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSkyTopColor;
      uniform float uMistIntensity;
      uniform vec3 uMistColor;
      uniform float uBassEnergy;
      uniform float uTrebleEnergy;

      varying vec3 vWorldPos;

      float vwHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.56);
        return fract(p.x * p.y);
      }

      float vwNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(vwHash(i), vwHash(i + vec2(1.0, 0.0)), u.x),
          mix(vwHash(i + vec2(0.0, 1.0)), vwHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 xz = vWorldPos.xz;
        float t = uTime;

        // Multi-directional ripple normal
        float r1 = vwNoise(xz * 0.45 + vec2(t * 0.32, -t * 0.24));
        float r2 = vwNoise(xz * 1.15 + vec2(-t * 0.45, t * 0.36));
        float r3 = vwNoise(xz * 2.50 + vec2(t * 0.55, t * 0.42));
        float hC = r1 * 0.55 + r2 * 0.30 + r3 * 0.15;

        float eps = 0.25;
        float hX = vwNoise((xz + vec2(eps, 0.0)) * 0.45 + vec2(t * 0.32, -t * 0.24)) * 0.55
                 + vwNoise((xz + vec2(eps, 0.0)) * 1.15 + vec2(-t * 0.45, t * 0.36)) * 0.30;
        float hZ = vwNoise((xz + vec2(0.0, eps)) * 0.45 + vec2(t * 0.32, -t * 0.24)) * 0.55
                 + vwNoise((xz + vec2(0.0, eps)) * 1.15 + vec2(-t * 0.45, t * 0.36)) * 0.30;

        float rippleAmp = 0.24 + uBassEnergy * 0.08;
        vec3 N = normalize(vec3((hC - hX) * rippleAmp / eps, 1.0, (hC - hZ) * rippleAmp / eps));
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDirection);

        // Distinguish Northern Hạ Long Bay, Southern Pearl Sea, Mekong/Trà Sư, Biển Hồ T'Nưng & Central Lakes/Estuaries
        float isNorthBay = smoothstep(-245.0, -280.0, xz.y);
        float isSouthSea = smoothstep(438.0, 465.0, xz.y);
        float isMekong = smoothstep(325.0, 345.0, xz.y) * (1.0 - smoothstep(425.0, 445.0, xz.y));
        float isCraterLake = 1.0 - smoothstep(38.0, 50.0, length(xz - vec2(-455.0, 42.0)));
        float isEstuary = 1.0 - smoothstep(70.0, 105.0, length(xz - vec2(335.0, -35.0)));
        float isHoiAnCanal = (1.0 - smoothstep(10.0, 18.0, abs(xz.x - 175.0))) *
                             (1.0 - smoothstep(32.0, 42.0, abs(xz.y - 45.0)));
        float isCaiRang = (1.0 - smoothstep(75.0, 115.0, abs(xz.x + 115.0))) *
                          (1.0 - smoothstep(32.0, 48.0, abs(xz.y - 368.0)));
        float isTraSu = 1.0 - smoothstep(48.0, 72.0, length(xz - vec2(-245.0, 395.0)));
        float isCaMau = (1.0 - smoothstep(48.0, 82.0, abs(xz.x))) *
                        smoothstep(436.0, 452.0, xz.y) * (1.0 - smoothstep(520.0, 550.0, xz.y));
        float isPQBay = 1.0 - smoothstep(60.0, 120.0, length(xz - vec2(-335.0, 445.0)));
        float isOpenSea = max(isNorthBay, isSouthSea);

        vec3 lakeColor = vec3(0.045, 0.23, 0.19);
        vec3 bayColor = vec3(0.028, 0.19, 0.22);
        vec3 southSeaColor = vec3(0.024, 0.23, 0.27);
        vec3 pqTurquoise = vec3(0.18, 0.64, 0.60);
        vec3 mekongColor = vec3(0.085, 0.21, 0.155);
        vec3 caiRangAlluvial = vec3(0.38, 0.27, 0.17);
        vec3 traSuTeaPeat = vec3(0.10, 0.085, 0.055);
        vec3 caMauAlluvial = vec3(0.32, 0.27, 0.19);
        vec3 craterColor = vec3(0.020, 0.17, 0.23);

        vec3 deepBody = mix(lakeColor, bayColor, isNorthBay);
        deepBody = mix(deepBody, mekongColor, isMekong * 0.88);
        deepBody = mix(deepBody, caiRangAlluvial, isCaiRang * 0.92);
        deepBody = mix(deepBody, traSuTeaPeat, isTraSu * 0.94);
        deepBody = mix(deepBody, southSeaColor, isSouthSea);
        deepBody = mix(deepBody, caMauAlluvial, isCaMau * 0.88);
        deepBody = mix(deepBody, pqTurquoise, isPQBay * 0.86);
        deepBody = mix(deepBody, craterColor, isCraterLake);
        deepBody = mix(deepBody, vec3(0.035, 0.21, 0.21), isEstuary * 0.65);

        // Schlick Fresnel reflection of golden-hour sky
        float cosTheta = max(dot(N, V), 0.0);
        float fresnel = 0.03 + 0.97 * pow(1.0 - cosTheta, 4.2);

        vec3 R = reflect(-V, N);
        vec3 skyRefl = mix(uHorizonColor * 0.90, uSkyTopColor * 0.85, clamp(R.y * 1.6, 0.0, 1.0));
        // Golden solar reflection ribbon
        float sunReflAngle = max(dot(R, L), 0.0);
        vec3 sunGlint = uSunColor * pow(sunReflAngle, 140.0) * (1.35 + uTrebleEnergy * 0.4);
        vec3 sunBroad = uSunColor * 0.65 * pow(sunReflAngle, 18.0) * 0.28;

        vec3 waterCol = mix(deepBody, skyRefl, clamp(fresnel * 0.88, 0.0, 0.92)) + sunGlint + sunBroad;

        // Warm silk lantern reflection shimmer on Hội An Hoài River canal
        if (isHoiAnCanal > 0.01) {
          float lanternShimmer = pow(0.5 + 0.5 * sin(xz.y * 0.9 + r2 * 5.0 - t * 1.4), 3.0);
          waterCol += vec3(1.0, 0.56, 0.22) * lanternShimmer * isHoiAnCanal * 0.34;
        }

        // Subtle shoreline / caustic sparkle along open bay & ocean edges
        float foamNoise = smoothstep(0.68, 0.84, r2 * 0.6 + r3 * 0.4);
        waterCol += vec3(0.28, 0.32, 0.30) * foamNoise * 0.14 * isOpenSea;

        // Low sea/lake mist over distant waters
        float camDist = length(cameraPosition - vWorldPos);
        float seaMist = smoothstep(70.0, 320.0, camDist) * (0.7 + 0.3 * r1) * uMistIntensity;
        waterCol = mix(waterCol, uMistColor, clamp(seaMist, 0.0, 0.45));

        float alpha = mix(0.84, 0.95, clamp(fresnel + isOpenSea * 0.25, 0.0, 1.0));
        gl_FragColor = vec4(waterCol, alpha);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Animated flapping white egrets (*Đàn cò trắng*) gliding over Vietnam's rice fields & bay.
 */
export function createEgretMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSunDirection: { value: sunDir.clone().normalize() },
      fogColor: { value: new THREE.Color('#f4d6b0') },
      fogDensity: { value: 0.00016 }
    },
    side: THREE.DoubleSide,
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float span = abs(uv.x - 0.5) * 2.0; // 0 at body, 1 at wingtips

        vec3 anchor = vec3(0.0);
        #ifdef USE_INSTANCING
        anchor = vec3(instanceMatrix[3].xyz);
        #endif
        float phase = fract(sin(dot(anchor.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.28318;
        float flap = sin(uTime * 5.8 + phase);
        pos.y += flap * pow(span, 1.35) * 0.34;

        #ifdef USE_INSTANCING
        vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
        vNormal = normalize((instanceMatrix * vec4(normal, 0.0)).xyz);
        #else
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        #endif

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vec3 N = normalize(vNormal);
        float NdotL = dot(N, normalize(uSunDirection)) * 0.5 + 0.5;
        vec3 plumage = mix(vec3(0.76, 0.78, 0.82), vec3(1.0, 0.97, 0.90), NdotL);
        gl_FragColor = vec4(plumage, 1.0);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Drifting golden incense & lantern light motes material with audio-reactive radiance.
 */
export function createVietnamGoldenMotesMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uRadiance: { value: 1.0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aPhase;
      attribute float aSize;
      varying float vAlpha;

      void main() {
        vec3 pos = position;
        pos.y += mod(uTime * 0.45 + aPhase * 2.0, 6.0) - 2.5;
        pos.x += sin(uTime * 0.6 + aPhase * 6.28) * 0.85;
        pos.z += cos(uTime * 0.5 + aPhase * 5.1) * 0.85;

        float twinkle = 0.45 + 0.55 * sin(uTime * 2.2 + aPhase * 12.0);
        vAlpha = twinkle;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (220.0 / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRadiance;
      varying float vAlpha;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float glow = exp(-d * d * 18.0);
        vec3 col = vec3(1.0, 0.78, 0.34) * uRadiance;
        gl_FragColor = vec4(col, glow * vAlpha * 0.82);
      }
    `
  });
}
