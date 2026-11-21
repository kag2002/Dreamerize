import * as THREE from 'three';

/**
 * Strict Multi-Angle & Micro-Motif QC Inspector Agent (`VietnamMultiAngleQcAgent`).
 *
 * Programmatically audits 3D heritage landmark groups from 10 distinct viewpoints:
 * - 8 Compass Azimuth Angles: 0° (+Z Front), 45° (NE Oblique), 90° (+X Right), 135° (SE),
 *   180° (-Z Rear), 225° (SW), 270° (-X Left), 315° (NW Oblique)
 * - Bird's-Eye Top-Down (+Y) & Low-Angle Hero Soffit/Undercut (-Y)
 * - Macro Close-Up (< 0.55m fine edge length) Filigree & Ornament Density Scan
 * - 3-Tier Vertical Stratification (Base 0..25%, Body 25..75%, Crown/Finial 75..100%)
 * - Polychrome Material & Vertex-Color Swatch Diversity
 */

export interface LandmarkMultiAngleQcMetrics {
  groupName: string;
  boundingBoxSize: THREE.Vector3;
  totalVertices: number;
  totalTriangles: number;
  microMotifTriangles: number;
  ultraFineMotifTriangles: number;
  azimuthNormalCounts: number[]; // 8 compass octants (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
  topDownNormalCount: number;
  lowHeroSoffitNormalCount: number;
  verticalTierVertexCounts: [number, number, number]; // [base 0..25%, mid 25..75%, crown 75..100%]
  quadrantVertexCounts: [number, number, number, number]; // [NE (+X,+Z), NW (-X,+Z), SE (+X,-Z), SW (-X,-Z)]
  distinctColorSwatches: number;
  passed: boolean;
  failures: string[];
}

export interface MultiAngleQcRequirements {
  minSpanXZ?: number;
  minSpanY?: number;
  minNormalsPerAzimuth?: number;
  minTopNormals?: number;
  minLowHeroNormals?: number;
  minMicroMotifTriangles?: number;
  minUltraFineTriangles?: number;
  minColorSwatches?: number;
  minVerticesPerQuadrant?: number;
}

const DEFAULT_QC_REQUIREMENTS: Required<MultiAngleQcRequirements> = {
  minSpanXZ: 8.0,
  minSpanY: 6.5,
  minNormalsPerAzimuth: 28,
  minTopNormals: 45,
  minLowHeroNormals: 18,
  minMicroMotifTriangles: 220,
  minUltraFineTriangles: 75,
  minColorSwatches: 5,
  minVerticesPerQuadrant: 15
};

export class VietnamMultiAngleQcAgent {
  /**
   * Audits a single landmark group from all 8 compass azimuths, bird's-eye top-down,
   * low-angle hero, vertical stratification tiers, and macro close-up micro-motif thresholds.
   */
  public static inspectLandmarkGroup(
    root: THREE.Object3D,
    groupName: string,
    reqs?: MultiAngleQcRequirements
  ): LandmarkMultiAngleQcMetrics {
    const cfg = { ...DEFAULT_QC_REQUIREMENTS, ...(reqs ?? {}) };
    const failures: string[] = [];

    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      const inst = obj as THREE.InstancedMesh;
      if (inst.isInstancedMesh && inst.count > 0) {
        inst.computeBoundingBox();
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    const azimuthNormalCounts = [0, 0, 0, 0, 0, 0, 0, 0];
    let topDownNormalCount = 0;
    let lowHeroSoffitNormalCount = 0;
    let totalVertices = 0;
    let totalTriangles = 0;
    let microMotifTriangles = 0;
    let ultraFineMotifTriangles = 0;
    const verticalTierVertexCounts: [number, number, number] = [0, 0, 0];
    const quadrantVertexCounts: [number, number, number, number] = [0, 0, 0, 0];
    const sampledXZ: Array<[number, number]> = [];
    let sumX = 0;
    let sumZ = 0;
    const colorSwatchSet = new Set<string>();

    const minY = box.min.y;
    const spanY = Math.max(0.001, size.y);

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    const nWorld = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3();
    const instMat = new THREE.Matrix4();

    // 8 compass azimuth unit directions in XZ plane
    const azimuthDirs: Array<[number, number]> = [
      [0, 1], // 0° Front (+Z)
      [Math.SQRT1_2, Math.SQRT1_2], // 45° NE
      [1, 0], // 90° East (+X)
      [Math.SQRT1_2, -Math.SQRT1_2], // 135° SE
      [0, -1], // 180° Rear (-Z)
      [-Math.SQRT1_2, -Math.SQRT1_2], // 225° SW
      [-1, 0], // 270° West (-X)
      [-Math.SQRT1_2, Math.SQRT1_2] // 315° NW
    ];

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;

      const geo = mesh.geometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute | undefined;
      if (!posAttr || posAttr.count === 0) return;

      const normAttr = geo.attributes.normal as THREE.BufferAttribute | undefined;
      const colAttr = geo.attributes.color as THREE.BufferAttribute | undefined;
      const isInstanced = (mesh as THREE.InstancedMesh).isInstancedMesh;
      const instanceCount = isInstanced ? Math.max(1, (mesh as THREE.InstancedMesh).count) : 1;

      totalVertices += posAttr.count * instanceCount;

      // Record material color swatch
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial | undefined;
        if (std?.color) {
          const r = Math.round(std.color.r * 10);
          const g = Math.round(std.color.g * 10);
          const b = Math.round(std.color.b * 10);
          colorSwatchSet.add(`mat:${r},${g},${b}`);
        } else if (m) {
          colorSwatchSet.add(`shader:${m.type}`);
        }
      }

      // Sample vertex colors if present
      if (colAttr) {
        const step = Math.max(1, Math.floor(colAttr.count / 48));
        for (let i = 0; i < colAttr.count; i += step) {
          const r = Math.round(colAttr.getX(i) * 8);
          const g = Math.round(colAttr.getY(i) * 8);
          const b = Math.round(colAttr.getZ(i) * 8);
          colorSwatchSet.add(`vc:${r},${g},${b}`);
        }
      }

      normalMatrix.getNormalMatrix(mesh.matrixWorld);

      // Sample normals & vertical height stratification
      const vStep = Math.max(1, Math.floor(posAttr.count / 600));
      for (let i = 0; i < posAttr.count; i += vStep) {
        vA.fromBufferAttribute(posAttr, i);
        if (isInstanced && (mesh as THREE.InstancedMesh).count > 0) {
          (mesh as THREE.InstancedMesh).getMatrixAt(i % (mesh as THREE.InstancedMesh).count, instMat);
          vA.applyMatrix4(instMat);
        }
        vA.applyMatrix4(mesh.matrixWorld);
        if (!Number.isFinite(vA.x) || !Number.isFinite(vA.y) || !Number.isFinite(vA.z)) {
          failures.push(`${groupName}: non-finite vertex position in ${mesh.name || 'mesh'}`);
          break;
        }
        const relY = (vA.y - minY) / spanY;
        if (relY < 0.25) verticalTierVertexCounts[0]++;
        else if (relY < 0.75) verticalTierVertexCounts[1]++;
        else verticalTierVertexCounts[2]++;

        sampledXZ.push([vA.x, vA.z]);
        sumX += vA.x;
        sumZ += vA.z;

        if (normAttr) {
          nWorld.fromBufferAttribute(normAttr, i).applyMatrix3(normalMatrix).normalize();
          if (nWorld.y > 0.42) topDownNormalCount++;
          if (nWorld.y < -0.32) lowHeroSoffitNormalCount++;
          for (let a = 0; a < 8; a++) {
            const dot = nWorld.x * azimuthDirs[a][0] + nWorld.z * azimuthDirs[a][1];
            if (dot > 0.48) azimuthNormalCounts[a]++;
          }
        }
      }

      // Inspect triangle edge lengths for macro close-up micro-motif filigree density
      const indexAttr = geo.index;
      const triCount = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(posAttr.count / 3);
      totalTriangles += triCount * instanceCount;

      const triStep = Math.max(1, Math.floor(triCount / 800));
      for (let t = 0; t < triCount; t += triStep) {
        const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
        const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
        const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;
        vA.fromBufferAttribute(posAttr, i0);
        vB.fromBufferAttribute(posAttr, i1);
        vC.fromBufferAttribute(posAttr, i2);
        const e1 = vA.distanceTo(vB);
        const e2 = vB.distanceTo(vC);
        const e3 = vC.distanceTo(vA);
        const maxEdge = Math.max(e1, e2, e3);
        if (maxEdge > 0.001 && maxEdge < 0.58) {
          microMotifTriangles += triStep;
          if (maxEdge < 0.26) {
            ultraFineMotifTriangles += triStep;
          }
        }
      }
    });

    if (sampledXZ.length > 0) {
      const centroidX = sumX / sampledXZ.length;
      const centroidZ = sumZ / sampledXZ.length;
      for (const [sx, sz] of sampledXZ) {
        const qIdx = (sx >= centroidX ? 0 : 1) + (sz >= centroidZ ? 0 : 2);
        quadrantVertexCounts[qIdx]++;
      }
    }

    if (size.x < cfg.minSpanXZ) {
      failures.push(`${groupName}: X span ${size.x.toFixed(2)}m < ${cfg.minSpanXZ}m`);
    }
    if (size.y < cfg.minSpanY) {
      failures.push(`${groupName}: Y span ${size.y.toFixed(2)}m < ${cfg.minSpanY}m`);
    }
    if (size.z < cfg.minSpanXZ) {
      failures.push(`${groupName}: Z span ${size.z.toFixed(2)}m < ${cfg.minSpanXZ}m`);
    }

    const azimuthLabels = ['0°(+Z)', '45°(NE)', '90°(+X)', '135°(SE)', '180°(-Z)', '225°(SW)', '270°(-X)', '315°(NW)'];
    for (let a = 0; a < 8; a++) {
      if (azimuthNormalCounts[a] < cfg.minNormalsPerAzimuth) {
        failures.push(
          `${groupName}: Azimuth ${azimuthLabels[a]} normal density ${azimuthNormalCounts[a]} < ${cfg.minNormalsPerAzimuth}`
        );
      }
    }

    if (topDownNormalCount < cfg.minTopNormals) {
      failures.push(`${groupName}: Bird's-Eye (+Y) normal count ${topDownNormalCount} < ${cfg.minTopNormals}`);
    }
    if (lowHeroSoffitNormalCount < cfg.minLowHeroNormals) {
      failures.push(`${groupName}: Low-Hero (-Y soffit) normal count ${lowHeroSoffitNormalCount} < ${cfg.minLowHeroNormals}`);
    }
    if (microMotifTriangles < cfg.minMicroMotifTriangles) {
      failures.push(
        `${groupName}: Micro-motif triangles (<0.58m edge) ${microMotifTriangles} < ${cfg.minMicroMotifTriangles}`
      );
    }
    if (ultraFineMotifTriangles < cfg.minUltraFineTriangles) {
      failures.push(
        `${groupName}: Ultra-fine filigree triangles (<0.26m edge) ${ultraFineMotifTriangles} < ${cfg.minUltraFineTriangles}`
      );
    }
    if (
      verticalTierVertexCounts[0] < 10 ||
      verticalTierVertexCounts[1] < 10 ||
      verticalTierVertexCounts[2] < 5
    ) {
      failures.push(
        `${groupName}: Unbalanced vertical tiers [base=${verticalTierVertexCounts[0]}, mid=${verticalTierVertexCounts[1]}, crown=${verticalTierVertexCounts[2]}]`
      );
    }
    if (colorSwatchSet.size < cfg.minColorSwatches) {
      failures.push(
        `${groupName}: Polychrome color/material swatches ${colorSwatchSet.size} < ${cfg.minColorSwatches}`
      );
    }
    const qLabels = ['NE(+X,+Z)', 'NW(-X,+Z)', 'SE(+X,-Z)', 'SW(-X,-Z)'];
    for (let q = 0; q < 4; q++) {
      if (quadrantVertexCounts[q] < cfg.minVerticesPerQuadrant) {
        failures.push(
          `${groupName}: Spatial quadrant ${qLabels[q]} sparse (${quadrantVertexCounts[q]} < ${cfg.minVerticesPerQuadrant})`
        );
      }
    }

    return {
      groupName,
      boundingBoxSize: size,
      totalVertices,
      totalTriangles,
      microMotifTriangles,
      ultraFineMotifTriangles,
      azimuthNormalCounts,
      topDownNormalCount,
      lowHeroSoffitNormalCount,
      verticalTierVertexCounts,
      quadrantVertexCounts,
      distinctColorSwatches: colorSwatchSet.size,
      passed: failures.length === 0,
      failures
    };
  }

  /**
   * Batch-audits an array of landmark group names in the given scene.
   */
  public static auditSceneLandmarks(
    scene: THREE.Scene,
    groupNames: string[],
    reqs?: MultiAngleQcRequirements
  ): LandmarkMultiAngleQcMetrics[] {
    return groupNames.map((name) => {
      const obj = scene.getObjectByName(name);
      if (!obj) {
        return {
          groupName: name,
          boundingBoxSize: new THREE.Vector3(),
          totalVertices: 0,
          totalTriangles: 0,
          microMotifTriangles: 0,
          ultraFineMotifTriangles: 0,
          azimuthNormalCounts: [0, 0, 0, 0, 0, 0, 0, 0],
          topDownNormalCount: 0,
          lowHeroSoffitNormalCount: 0,
          verticalTierVertexCounts: [0, 0, 0],
          quadrantVertexCounts: [0, 0, 0, 0],
          distinctColorSwatches: 0,
          passed: false,
          failures: [`Missing landmark group in scene: ${name}`]
        };
      }
      return VietnamMultiAngleQcAgent.inspectLandmarkGroup(obj, name, reqs);
    });
  }
}
