import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createAncientStoneLanternParts,
  createArtDecoReliefParts,
  createBambooBriseSoleilParts,
  createBasReliefPanelParts,
  createBoatEyeParts,
  createCuaVongParts,
  createDoorStudGridParts,
  createKhauCutGableParts,
  createLotusPetalRingParts,
  createLouverShutterParts,
  createMotifBandParts,
  createPhoenixFinialParts,
  createShouCharacterParts,
  createSunWindowParts,
  tagMotifIds
} from '../../src/client/scene/environments/vietnamMotifHelpers';
import { mergeNormalized } from '../../src/client/scene/environments/vietnamGeometryHelpers';
import { MultiAngleQcAgent } from '../../src/client/scene/framework/MultiAngleQcAgent';

function assertValidReliefParts(
  parts: THREE.BufferGeometry[],
  label: string,
  minDepthMeters = 0.015
): void {
  expect(parts.length, `${label} should emit >= 1 geometry part`).toBeGreaterThan(0);
  const merged = mergeNormalized(parts);
  const pos = merged.attributes.position as THREE.BufferAttribute;
  const norm = merged.attributes.normal as THREE.BufferAttribute;
  expect(pos.count, `${label} should have vertices`).toBeGreaterThanOrEqual(12);
  expect(norm.count, `${label} should have normals`).toBe(pos.count);
  for (let i = 0; i < pos.array.length; i++) {
    expect(Number.isFinite(pos.array[i]), `${label} non-finite vertex`).toBe(true);
  }
  merged.computeBoundingBox();
  const size = new THREE.Vector3();
  merged.boundingBox!.getSize(size);
  const minAxis = Math.min(size.x, size.y, size.z);
  expect(
    minAxis,
    `${label} relief depth (${minAxis.toFixed(4)}m) must be >= ${minDepthMeters}m (no flat stickers)`
  ).toBeGreaterThanOrEqual(minDepthMeters);
  merged.dispose();
}

describe('Vietnam Heritage Motif Library (HV-A01..HV-NEW-*) & Motif QC', () => {
  it('generates finite 3D relief geometry with depth >= 1.5cm for all P0/P1/P2 motif helpers', () => {
    assertValidReliefParts(createMotifBandParts('hoi_van', 0, 0, 4, 0, 1, 0.16, 0.05), 'HV-D01 hoi_van');
    assertValidReliefParts(createMotifBandParts('cuc_day', 0, 0, 4, 0, 1, 0.16, 0.05), 'HV-C07 cuc_day');
    assertValidReliefParts(createMotifBandParts('song_nuoc', 0, 0, 4, 0, 1, 0.16, 0.05), 'HV-D06 song_nuoc');
    assertValidReliefParts(createMotifBandParts('day_la_cham', 0, 0, 4, 0, 1, 0.2, 0.06), 'HV-C10 day_la_cham');
    assertValidReliefParts(createShouCharacterParts(0, 1, 0, 0.28, 'tron', 0), 'HV-D02 shou_tron');
    assertValidReliefParts(createShouCharacterParts(0, 1, 0, 0.24, 'dai', 0.4), 'HV-D03 shou_dai');
    assertValidReliefParts(createLotusPetalRingParts(0, 0, 0, 0.5, 12, 2, true), 'HV-C01 lotus_ring_up');
    assertValidReliefParts(createLotusPetalRingParts(0, 0, 0, 0.45, 10, 1, false), 'HV-C02 lotus_plinth');
    assertValidReliefParts(createPhoenixFinialParts(0, 0, 0, 0, 1.0, 'single'), 'HV-B01 phoenix_single');
    assertValidReliefParts(createPhoenixFinialParts(0, 0, 0, 0, 0.85, 'quad_pillar'), 'HV-NEW-MB-01 quad_phoenix');
    assertValidReliefParts(createCuaVongParts(0, 3, 0, 3.4, 0.85, 0, 'long_phung'), 'HV-D12 cua_vong_long_phung');
    assertValidReliefParts(createCuaVongParts(0, 3, 0, 2.4, 0.6, 0.5, 'hoa_la'), 'HV-D12 cua_vong_hoa_la');
    assertValidReliefParts(createSunWindowParts(0, 5, 0, 0.62, 0), 'HV-D11 sun_window');
    assertValidReliefParts(createDoorStudGridParts(0, 2, 0, 1.5, 2.6, 5, 4, 0), 'HV-D14 door_studs');
    assertValidReliefParts(createBasReliefPanelParts(0, 2, 0, 2.0, 1.0, 0, 'tu_quy'), 'HV-C08 tu_quy');
    assertValidReliefParts(createBasReliefPanelParts(0, 2, 0, 2.0, 1.0, 0, 'cuu_dinh'), 'HV-E05 cuu_dinh');
    assertValidReliefParts(createBasReliefPanelParts(0, 2, 0, 1.0, 1.2, 0, 'apsara'), 'HV-F06 apsara');
    assertValidReliefParts(createBasReliefPanelParts(0, 2, 0, 3.2, 1.5, 0, 'bien_hoa'), 'HV-J06 bien_hoa');
    assertValidReliefParts(createBasReliefPanelParts(0, 2, 0, 2.8, 1.4, 0, 'lich_su'), 'HV-NEW-MB-10 lich_su');
    assertValidReliefParts(createLouverShutterParts(0, 2, 0, 0.65, 2.1, 0, 8), 'HV-H05 louver_shutter');
    assertValidReliefParts(createBambooBriseSoleilParts(0, 4, 0, 12.0, 3.1, 10, 0), 'HV-C15 brise_soleil');
    assertValidReliefParts(createKhauCutGableParts(0, 5, 0, 1.0, 0), 'HV-NEW-MB-06 khau_cut');
    assertValidReliefParts(createAncientStoneLanternParts(0, 0, 0, 1.0), 'HV-NEW-MB-12 stone_lantern');
    assertValidReliefParts(createBoatEyeParts(0, 0.5, 0, 1.0, 0), 'HV-NEW-MN-01 boat_eye');
    assertValidReliefParts(createArtDecoReliefParts(0, 3, 0, 2.0, 1.2, 0), 'HV-NEW-MT-10 art_deco');
  });

  it('enforces motifCoverage & requiredMotifs validation cleanly in MultiAngleQcAgent', () => {
    const group = new THREE.Group();
    group.name = 'SyntheticMotifPavilion';
    const mat = new THREE.MeshStandardMaterial({ color: '#c8a858' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 12), mat);
    group.add(mesh);
    tagMotifIds(group, ['HV-D01', 'HV-D02', 'HV-D12']);
    tagMotifIds(mesh, ['HV-D02', 'HV-C01']); // deduplicates HV-D02

    const passReport = MultiAngleQcAgent.inspectLandmarkGroup(group, 'SyntheticMotifPavilion', {
      minSpanXZ: 8,
      minSpanY: 8,
      minNormalsPerAzimuth: 1,
      minTopNormals: 1,
      minLowHeroNormals: 1,
      minMicroMotifTriangles: 0,
      minUltraFineTriangles: 0,
      minColorSwatches: 1,
      minVerticesPerQuadrant: 1,
      minMotifCoverage: 4,
      requiredMotifs: ['HV-D01', 'HV-D02', 'HV-D12', 'HV-C01']
    });
    expect(passReport.motifCoverageCount).toBe(4);
    expect(passReport.missingRequiredMotifs).toEqual([]);

    const failReport = MultiAngleQcAgent.inspectLandmarkGroup(group, 'SyntheticMotifPavilion', {
      minSpanXZ: 8,
      minSpanY: 8,
      minNormalsPerAzimuth: 1,
      minTopNormals: 1,
      minLowHeroNormals: 1,
      minMicroMotifTriangles: 0,
      minUltraFineTriangles: 0,
      minColorSwatches: 1,
      minVerticesPerQuadrant: 1,
      minMotifCoverage: 6,
      requiredMotifs: ['HV-D01', 'HV-A04']
    });
    expect(failReport.passed).toBe(false);
    expect(failReport.missingRequiredMotifs).toEqual(['HV-A04']);
    expect(failReport.failures.some((f) => f.includes('Motif coverage 4 < 6'))).toBe(true);
    expect(failReport.failures.some((f) => f.includes('Missing required motifs [HV-A04]'))).toBe(true);
    mesh.geometry.dispose();
    mat.dispose();
  });
});
