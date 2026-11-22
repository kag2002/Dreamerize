import type { QualitySettings, QualityTier } from './types';

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    shadowMapSize: 1024,
    shadowDistance: 110,
    shadowFrustumHalfSize: 90,
    shadowUpdateIntervalFrames: 4,
    drawDistance: 750,
    maxActivePointLights: 2,
    foliageDensityScale: 0.35,
    foliageFadeStart: 85,
    foliageFadeEnd: 140,
    zoneLoadRadius: 320,
    zoneUnloadRadius: 410,
    maxLoadedZones: 4,
    dprCap: 1.0
  },
  medium: {
    tier: 'medium',
    shadowMapSize: 1536,
    shadowDistance: 165,
    shadowFrustumHalfSize: 120,
    shadowUpdateIntervalFrames: 3,
    drawDistance: 1250,
    maxActivePointLights: 3,
    foliageDensityScale: 0.65,
    foliageFadeStart: 120,
    foliageFadeEnd: 190,
    zoneLoadRadius: 400,
    zoneUnloadRadius: 490,
    maxLoadedZones: 6,
    dprCap: 1.5
  },
  high: {
    tier: 'high',
    shadowMapSize: 2048,
    shadowDistance: 210,
    shadowFrustumHalfSize: 125,
    shadowUpdateIntervalFrames: 2,
    drawDistance: 2200,
    maxActivePointLights: 4,
    foliageDensityScale: 1.0,
    foliageFadeStart: 155,
    foliageFadeEnd: 240,
    zoneLoadRadius: 460,
    zoneUnloadRadius: 550,
    maxLoadedZones: 10,
    dprCap: 2.0
  },
  ultra: {
    tier: 'ultra',
    shadowMapSize: 4096,
    shadowDistance: 280,
    shadowFrustumHalfSize: 175,
    shadowUpdateIntervalFrames: 1,
    drawDistance: 4200,
    maxActivePointLights: 6,
    foliageDensityScale: 1.0,
    foliageFadeStart: 220,
    foliageFadeEnd: 330,
    zoneLoadRadius: 560,
    zoneUnloadRadius: 660,
    maxLoadedZones: Infinity,
    dprCap: 2.0
  }
};

/**
 * Selects a sensible default quality tier based on runtime environment and hardware hints.
 * Returns 'high' in headless/SSR Node contexts so automated tests verify full fidelity unless overridden.
 */
export function detectDefaultQualityTier(): QualityTier {
  if (typeof navigator === 'undefined') {
    return 'high';
  }
  const ua = navigator.userAgent ?? '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const cores =
    typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 8;
  if (isMobile && cores <= 4) {
    return 'low';
  }
  if (isMobile || cores <= 4) {
    return 'medium';
  }
  return 'high';
}
