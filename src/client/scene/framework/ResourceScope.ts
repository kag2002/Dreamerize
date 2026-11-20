import * as THREE from 'three';
import type { ResourceScopeLike } from './types';

export interface ResourceScopeOptions {
  protectedMaterials?: ReadonlySet<THREE.Material>;
  protectedGeometries?: ReadonlySet<THREE.BufferGeometry>;
}

/**
 * Tracks all GPU geometries, materials, textures, scene objects, and cleanup callbacks
 * belonging to a single loaded zone or world scope so unloading or disposing leaks zero GPU memory.
 */
export class ResourceScope implements ResourceScopeLike {
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private readonly objects = new Set<THREE.Object3D>();
  private readonly disposables = new Set<() => void>();
  private readonly protectedMaterials?: ReadonlySet<THREE.Material>;
  private readonly protectedGeometries?: ReadonlySet<THREE.BufferGeometry>;

  constructor(options?: ResourceScopeOptions | ReadonlySet<THREE.Material>) {
    if (options instanceof Set) {
      this.protectedMaterials = options;
    } else if (options) {
      const opts = options as ResourceScopeOptions;
      this.protectedMaterials = opts.protectedMaterials;
      this.protectedGeometries = opts.protectedGeometries;
    }
  }

  private isProtectedMaterial(mat: THREE.Material): boolean {
    return Boolean(mat.userData?.sharedProtected || this.protectedMaterials?.has(mat));
  }

  public trackObject<T extends THREE.Object3D>(obj: T): T {
    this.objects.add(obj);
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (
        mesh.geometry &&
        typeof mesh.geometry.dispose === 'function' &&
        !this.protectedGeometries?.has(mesh.geometry)
      ) {
        this.geometries.add(mesh.geometry);
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          for (const mat of mesh.material) {
            if (mat && !this.isProtectedMaterial(mat)) {
              this.materials.add(mat);
            }
          }
        } else if (!this.isProtectedMaterial(mesh.material)) {
          this.materials.add(mesh.material);
        }
      }
    });
    return obj;
  }

  public trackGeometry<T extends THREE.BufferGeometry>(geo: T): T {
    if (!this.protectedGeometries?.has(geo)) {
      this.geometries.add(geo);
    }
    return geo;
  }

  public trackMaterial<T extends THREE.Material>(mat: T): T {
    if (!this.isProtectedMaterial(mat)) {
      this.materials.add(mat);
    }
    return mat;
  }

  public trackTexture<T extends THREE.Texture>(tex: T): T {
    this.textures.add(tex);
    return tex;
  }

  public trackDisposable(fn: () => void): void {
    this.disposables.add(fn);
  }

  public getCounts(): {
    geometries: number;
    materials: number;
    textures: number;
    objects: number;
  } {
    return {
      geometries: this.geometries.size,
      materials: this.materials.size,
      textures: this.textures.size,
      objects: this.objects.size
    };
  }

  public dispose(): void {
    for (const obj of this.objects) {
      obj.traverse((child) => {
        const inst = child as THREE.InstancedMesh;
        if (inst.isInstancedMesh) {
          const im = inst.instanceMatrix as unknown as { dispose?: () => void };
          if (im && typeof im.dispose === 'function') im.dispose();
          const ic = inst.instanceColor as unknown as { dispose?: () => void };
          if (ic && typeof ic.dispose === 'function') ic.dispose();
          const dispInst = (inst as unknown as { dispose?: () => void }).dispose;
          if (typeof dispInst === 'function') dispInst.call(inst);
        }
      });
      if (obj.parent) {
        obj.parent.remove(obj);
      }
    }
    this.objects.clear();

    for (const geo of this.geometries) {
      geo.dispose();
    }
    this.geometries.clear();

    for (const tex of this.textures) {
      tex.dispose();
    }
    this.textures.clear();

    for (const mat of this.materials) {
      mat.dispose();
    }
    this.materials.clear();

    for (const fn of this.disposables) {
      try {
        fn();
      } catch {
        // Ignore cleanup callback errors on teardown
      }
    }
    this.disposables.clear();
  }
}
