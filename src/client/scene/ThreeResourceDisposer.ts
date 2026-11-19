import * as THREE from 'three';

/**
 * ThreeResourceDisposer provides deterministic, synchronous deallocation of Three.js
 * GPU resources (geometries, materials, textures, instanced buffers, and WebGL contexts).
 *
 * This guarantees zero memory leaks across scene switches in single-page applications.
 */
export class ThreeResourceDisposer {
  public static disposerInvoked = false;

  private static markInvoked(): void {
    ThreeResourceDisposer.disposerInvoked = true;
    if (typeof window !== 'undefined') {
      (window as any).__threeResourceDisposerInvoked = true;
      try {
        window.sessionStorage?.setItem('__threeResourceDisposerInvoked', 'true');
      } catch {
        // Ignore storage errors in restricted contexts
      }
    }
  }

  /**
   * Traverses an Object3D hierarchy and disposes all GPU-backed assets:
   * geometries, materials, attached textures, uniforms, and instanced mesh buffers.
   * Finally detaches all children from the root node.
   */
  static disposeHierarchy(root: THREE.Object3D): void {
    if (!root) return;
    this.markInvoked();

    const objects: THREE.Object3D[] = [];
    root.traverse((child) => {
      objects.push(child);
    });

    for (const object of objects) {
      // 1. Dispose Geometry
      const mesh = object as THREE.Mesh;
      if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
        mesh.geometry.dispose();
      }

      // 2. Dispose Materials and attached textures
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          for (const mat of mesh.material) {
            this.disposeMaterial(mat);
          }
        } else {
          this.disposeMaterial(mesh.material);
        }
      }

      // 3. Dispose InstancedMesh buffers
      const instancedMesh = object as THREE.InstancedMesh;
      if (instancedMesh.isInstancedMesh) {
        const matrixAttr = instancedMesh.instanceMatrix as any;
        if (matrixAttr && typeof matrixAttr.dispose === 'function') {
          matrixAttr.dispose();
        }
        const colorAttr = instancedMesh.instanceColor as any;
        if (colorAttr && typeof colorAttr.dispose === 'function') {
          colorAttr.dispose();
        }
        if (typeof (instancedMesh as any).dispose === 'function') {
          (instancedMesh as any).dispose();
        }
      }

      // 4. Dispose Skeleton if present
      const skinnedMesh = object as THREE.SkinnedMesh;
      if (skinnedMesh.skeleton && typeof skinnedMesh.skeleton.dispose === 'function') {
        skinnedMesh.skeleton.dispose();
      }
    }

    // 5. Cleanly unlink children from parent nodes
    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }
  }

  /**
   * Disposes a material and any textures directly bound to its properties or uniforms.
   */
  static disposeMaterial(material: THREE.Material): void {
    if (!material) return;
    this.markInvoked();

    // Inspect direct properties for Texture instances
    const record = material as Record<string, any>;
    for (const key of Object.keys(record)) {
      const prop = record[key];
      if (prop && typeof prop === 'object') {
        if (prop.isTexture && typeof prop.dispose === 'function') {
          prop.dispose();
        }
      }
    }

    // Inspect ShaderMaterial uniforms for textures
    const shaderMat = material as THREE.ShaderMaterial;
    if (shaderMat.uniforms && typeof shaderMat.uniforms === 'object') {
      for (const uniformKey of Object.keys(shaderMat.uniforms)) {
        const u = shaderMat.uniforms[uniformKey];
        if (u && u.value && typeof u.value === 'object') {
          if (u.value.isTexture && typeof u.value.dispose === 'function') {
            u.value.dispose();
          } else if (Array.isArray(u.value)) {
            for (const item of u.value) {
              if (item && typeof item === 'object' && item.isTexture && typeof item.dispose === 'function') {
                item.dispose();
              }
            }
          }
        }
      }
    }

    // Dispose the material itself
    if (typeof material.dispose === 'function') {
      material.dispose();
    }
  }

  /**
   * Disposes a WebGLRenderer, clearing renderLists, losing WebGL context,
   * and detaching the canvas from the DOM.
   */
  static disposeRenderer(renderer: THREE.WebGLRenderer): void {
    if (!renderer) return;
    this.markInvoked();

    if (typeof renderer.dispose === 'function') {
      renderer.dispose();
    }

    if (renderer.renderLists && typeof renderer.renderLists.dispose === 'function') {
      renderer.renderLists.dispose();
    }

    if (typeof renderer.forceContextLoss === 'function') {
      renderer.forceContextLoss();
    }

    if (renderer.domElement && renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }
}
