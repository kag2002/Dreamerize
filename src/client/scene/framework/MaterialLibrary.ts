import * as THREE from 'three';
import type { MaterialLibraryLike } from './types';

export interface MaterialDedupeResult {
  beforeCount: number;
  afterCount: number;
  savedCount: number;
}

const DEFAULT_ON_BEFORE_COMPILE = THREE.Material.prototype.onBeforeCompile;
const DEFAULT_CUSTOM_PROGRAM_KEY = THREE.Material.prototype.customProgramCacheKey;

function texUuid(tex: THREE.Texture | null | undefined): string {
  return tex ? tex.uuid : '';
}

/**
 * Computes a strict equivalence key for unmodified MeshStandardMaterial / MeshBasicMaterial
 * instances so identical duplicate materials created across builders can safely share one instance.
 */
export function computeMaterialKey(mat: THREE.Material): string | null {
  if (!mat) return null;
  if (mat.type !== 'MeshStandardMaterial' && mat.type !== 'MeshBasicMaterial') {
    return null;
  }
  if (mat.userData?.noDedupe === true) {
    return null;
  }
  if (
    Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile') &&
    mat.onBeforeCompile !== DEFAULT_ON_BEFORE_COMPILE
  ) {
    return null;
  }
  if (
    Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') &&
    mat.customProgramCacheKey !== DEFAULT_CUSTOM_PROGRAM_KEY
  ) {
    return null;
  }

  const m = mat as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
  const ns = m.normalScale;
  return [
    m.type,
    m.color ? m.color.getHexString() : '',
    m.emissive ? m.emissive.getHexString() : '',
    typeof m.emissiveIntensity === 'number' ? m.emissiveIntensity.toFixed(2) : '',
    typeof m.roughness === 'number' ? m.roughness.toFixed(2) : '',
    typeof m.metalness === 'number' ? m.metalness.toFixed(2) : '',
    m.opacity.toFixed(4),
    m.transparent ? 1 : 0,
    m.alphaTest.toFixed(4),
    m.depthWrite ? 1 : 0,
    m.depthTest ? 1 : 0,
    m.side,
    m.vertexColors ? 1 : 0,
    (m as { flatShading?: boolean }).flatShading ? 1 : 0,
    m.wireframe ? 1 : 0,
    m.fog ? 1 : 0,
    typeof m.envMapIntensity === 'number' ? m.envMapIntensity.toFixed(4) : '',
    m.blending,
    m.polygonOffset ? 1 : 0,
    m.polygonOffsetFactor,
    m.polygonOffsetUnits,
    texUuid(m.map),
    texUuid(m.normalMap),
    texUuid(m.roughnessMap),
    texUuid(m.metalnessMap),
    texUuid(m.aoMap),
    typeof m.aoMapIntensity === 'number' ? m.aoMapIntensity.toFixed(4) : '',
    texUuid(m.alphaMap),
    texUuid(m.emissiveMap),
    texUuid(m.bumpMap),
    typeof m.bumpScale === 'number' ? m.bumpScale.toFixed(4) : '',
    ns ? `${ns.x.toFixed(4)},${ns.y.toFixed(4)}` : ''
  ].join('|');
}

/**
 * Deduplicates equivalent static MeshStandardMaterial / MeshBasicMaterial instances across a scene graph
 * while leaving dynamically mutated runtime materials (`protectedMaterials`) untouched and optionally
 * seeding canonical shared materials (`canonicalSeeds`) that static duplicates merge into.
 */
export function dedupeSceneMaterials(
  root: THREE.Object3D,
  protectedMaterials: Set<THREE.Material>,
  extraMaterials?: THREE.Material[],
  canonicalSeeds?: Iterable<THREE.Material>
): MaterialDedupeResult {
  const beforeMaterials = new Set<THREE.Material>();
  const canonicalByKey = new Map<string, THREE.Material>();
  const seedSet = new Set<THREE.Material>();
  const replacedSet = new Set<THREE.Material>();
  const meshes: THREE.Mesh[] = [];

  if (canonicalSeeds) {
    for (const seed of canonicalSeeds) {
      if (!seed || protectedMaterials.has(seed)) continue;
      seedSet.add(seed);
      const key = computeMaterialKey(seed);
      if (key && !canonicalByKey.has(key)) {
        canonicalByKey.set(key, seed);
      }
    }
  }

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    meshes.push(mesh);
    if (Array.isArray(mesh.material)) {
      for (const m of mesh.material) {
        if (m) beforeMaterials.add(m);
      }
    } else {
      beforeMaterials.add(mesh.material);
    }
  });

  const resolveCanonical = (mat: THREE.Material): THREE.Material => {
    if (protectedMaterials.has(mat) || mat.userData?.noDedupe === true) return mat;
    const key = computeMaterialKey(mat);
    if (!key) return mat;
    const existing = canonicalByKey.get(key);
    if (existing) {
      if (existing !== mat) {
        replacedSet.add(mat);
      }
      return existing;
    }
    canonicalByKey.set(key, mat);
    return mat;
  };

  for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) {
      let changed = false;
      const next = mesh.material.map((m) => {
        if (!m) return m;
        const resolved = resolveCanonical(m);
        if (resolved !== m) changed = true;
        return resolved;
      });
      if (changed) {
        mesh.material = next;
      }
    } else {
      const resolved = resolveCanonical(mesh.material);
      if (resolved !== mesh.material) {
        mesh.material = resolved;
      }
    }
  }

  const afterMaterials = new Set<THREE.Material>();
  for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) {
      for (const m of mesh.material) {
        if (m) afterMaterials.add(m);
      }
    } else if (mesh.material) {
      afterMaterials.add(mesh.material);
    }
  }

  for (const dup of replacedSet) {
    if (!afterMaterials.has(dup) && !protectedMaterials.has(dup) && !seedSet.has(dup)) {
      dup.dispose();
    }
  }

  if (extraMaterials && replacedSet.size > 0) {
    for (let i = extraMaterials.length - 1; i >= 0; i--) {
      if (replacedSet.has(extraMaterials[i]) && !afterMaterials.has(extraMaterials[i])) {
        extraMaterials.splice(i, 1);
      }
    }
  }

  return {
    beforeCount: beforeMaterials.size,
    afterCount: afterMaterials.size,
    savedCount: Math.max(0, beforeMaterials.size - afterMaterials.size)
  };
}

/**
 * Bakes static, untextured, non-emissive solid-color MeshStandardMaterials into geometry vertex colors
 * (when safe for single-use geometries) and collapses equivalent quantized roughness/metalness variants
 * into shared vertex-colored materials from `materialLib`.
 */
export function consolidateSolidMaterialsToVertexColors<TShared = Record<string, THREE.Material>>(
  root: THREE.Object3D,
  protectedMaterials: Set<THREE.Material>,
  materialLib: MaterialLibraryLike<TShared>,
  extraMaterials?: THREE.Material[]
): MaterialDedupeResult {
  const beforeMaterials = new Set<THREE.Material>();
  const meshes: THREE.Mesh[] = [];
  const geoRefs = new Map<THREE.BufferGeometry, number>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material || !mesh.geometry) return;
    meshes.push(mesh);
    geoRefs.set(mesh.geometry, (geoRefs.get(mesh.geometry) ?? 0) + 1);
    if (Array.isArray(mesh.material)) {
      for (const m of mesh.material) {
        if (m) beforeMaterials.add(m);
      }
    } else {
      beforeMaterials.add(mesh.material);
    }
  });

  const replacedSet = new Set<THREE.Material>();

  for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) continue;
    const mat = mesh.material;
    if (!mat || mat.type !== 'MeshStandardMaterial') continue;
    const m = mat as THREE.MeshStandardMaterial;

    if (
      protectedMaterials.has(m) ||
      m.userData?.noDedupe === true ||
      m.userData?.sharedProtected === true ||
      !computeMaterialKey(m)
    ) {
      continue;
    }

    if (
      m.map ||
      m.normalMap ||
      m.roughnessMap ||
      m.metalnessMap ||
      m.aoMap ||
      m.alphaMap ||
      m.emissiveMap ||
      m.bumpMap
    ) {
      continue;
    }

    if (
      m.emissive.getHex() !== 0 ||
      m.transparent ||
      m.opacity < 1 ||
      m.alphaTest > 0 ||
      m.wireframe
    ) {
      continue;
    }

    const needsBake = !m.vertexColors || m.color.getHex() !== 0xffffff;
    if (needsBake) {
      if (
        (geoRefs.get(mesh.geometry) ?? 0) > 1 ||
        !mesh.geometry.attributes?.position ||
        (!m.vertexColors && Boolean(mesh.geometry.attributes.color))
      ) {
        continue;
      }

      if (!m.vertexColors) {
        const pos = mesh.geometry.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        const r = m.color.r;
        const g = m.color.g;
        const b = m.color.b;
        for (let i = 0; i < pos.count; i++) {
          const base = i * 3;
          colors[base] = r;
          colors[base + 1] = g;
          colors[base + 2] = b;
        }
        mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      } else {
        const colAttr = mesh.geometry.attributes.color as THREE.BufferAttribute;
        const r = m.color.r;
        const g = m.color.g;
        const b = m.color.b;
        for (let i = 0; i < colAttr.count; i++) {
          colAttr.setXYZ(i, colAttr.getX(i) * r, colAttr.getY(i) * g, colAttr.getZ(i) * b);
        }
        colAttr.needsUpdate = true;
      }
    }

    const qR = Math.min(1, Math.max(0, Math.round(m.roughness / 0.15) * 0.15));
    const qM = Math.min(1, Math.max(0, Math.round(m.metalness / 0.15) * 0.15));
    const canonical = materialLib.getOrCreateStandard({
      color: '#ffffff',
      vertexColors: true,
      roughness: qR,
      metalness: qM,
      side: m.side,
      flatShading: m.flatShading,
      fog: m.fog,
      blending: m.blending,
      polygonOffset: m.polygonOffset,
      polygonOffsetFactor: m.polygonOffsetFactor,
      polygonOffsetUnits: m.polygonOffsetUnits
    });

    if (canonical !== m) {
      replacedSet.add(m);
      mesh.material = canonical;
    }
  }

  const afterMaterials = new Set<THREE.Material>();
  for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) {
      for (const m of mesh.material) {
        if (m) afterMaterials.add(m);
      }
    } else if (mesh.material) {
      afterMaterials.add(mesh.material);
    }
  }

  for (const dup of replacedSet) {
    if (!afterMaterials.has(dup) && !protectedMaterials.has(dup) && !dup.userData?.sharedProtected) {
      dup.dispose();
    }
  }

  if (extraMaterials && replacedSet.size > 0) {
    for (let i = extraMaterials.length - 1; i >= 0; i--) {
      if (replacedSet.has(extraMaterials[i]) && !afterMaterials.has(extraMaterials[i])) {
        extraMaterials.splice(i, 1);
      }
    }
  }

  return {
    beforeCount: beforeMaterials.size,
    afterCount: afterMaterials.size,
    savedCount: Math.max(0, beforeMaterials.size - afterMaterials.size)
  };
}

/**
 * Shared material cache for modular worlds and zones to obtain cached StandardMaterials by parameter signature.
 */
export class MaterialLibrary<TShared = Record<string, THREE.Material>>
  implements MaterialLibraryLike<TShared>
{
  public readonly shared: TShared;
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();

  constructor(shared: TShared = {} as TShared) {
    this.shared = shared;
  }

  public getOrCreateStandard(
    params: THREE.MeshStandardMaterialParameters
  ): THREE.MeshStandardMaterial {
    const tmp = new THREE.MeshStandardMaterial(params);
    tmp.userData.sharedProtected = true;
    const key = computeMaterialKey(tmp);
    if (key) {
      const existing = this.cache.get(key);
      if (existing) {
        tmp.dispose();
        return existing;
      }
      this.cache.set(key, tmp);
    }
    return tmp;
  }

  public getCachedMaterials(): Iterable<THREE.MeshStandardMaterial> {
    return this.cache.values();
  }

  public dispose(): void {
    for (const mat of this.cache.values()) {
      mat.dispose();
    }
    this.cache.clear();
  }
}
