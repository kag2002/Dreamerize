import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { ThreeResourceDisposer } from '../../src/client/scene/ThreeResourceDisposer';

describe('ThreeResourceDisposer', () => {
  it('disposes geometries, materials, and detaches children in hierarchy', () => {
    const root = new THREE.Group();
    const childGroup = new THREE.Group();
    root.add(childGroup);

    const geo1 = new THREE.BoxGeometry(1, 1, 1);
    const mat1 = new THREE.MeshBasicMaterial();
    const mesh1 = new THREE.Mesh(geo1, mat1);
    childGroup.add(mesh1);

    const geo2 = new THREE.SphereGeometry(2);
    const mat2 = new THREE.MeshStandardMaterial();
    const mesh2 = new THREE.Mesh(geo2, mat2);
    root.add(mesh2);

    const spyGeo1 = vi.spyOn(geo1, 'dispose');
    const spyMat1 = vi.spyOn(mat1, 'dispose');
    const spyGeo2 = vi.spyOn(geo2, 'dispose');
    const spyMat2 = vi.spyOn(mat2, 'dispose');

    ThreeResourceDisposer.disposeHierarchy(root);

    expect(spyGeo1).toHaveBeenCalledTimes(1);
    expect(spyMat1).toHaveBeenCalledTimes(1);
    expect(spyGeo2).toHaveBeenCalledTimes(1);
    expect(spyMat2).toHaveBeenCalledTimes(1);
    expect(root.children.length).toBe(0);
  });

  it('disposes multi-material arrays', () => {
    const root = new THREE.Group();
    const geo = new THREE.BoxGeometry();
    const matA = new THREE.MeshBasicMaterial();
    const matB = new THREE.MeshBasicMaterial();

    const spyMatA = vi.spyOn(matA, 'dispose');
    const spyMatB = vi.spyOn(matB, 'dispose');

    const mesh = new THREE.Mesh(geo, [matA, matB]);
    root.add(mesh);

    ThreeResourceDisposer.disposeHierarchy(root);

    expect(spyMatA).toHaveBeenCalledTimes(1);
    expect(spyMatB).toHaveBeenCalledTimes(1);
  });

  it('disposes textures attached to material properties', () => {
    const mat = new THREE.MeshStandardMaterial();
    const texture = new THREE.Texture();
    const spyTex = vi.spyOn(texture, 'dispose');

    mat.map = texture;
    const spyMat = vi.spyOn(mat, 'dispose');

    ThreeResourceDisposer.disposeMaterial(mat);

    expect(spyTex).toHaveBeenCalledTimes(1);
    expect(spyMat).toHaveBeenCalledTimes(1);
  });

  it('disposes textures in ShaderMaterial uniforms (single and arrays)', () => {
    const singleTex = new THREE.Texture();
    const arrayTex1 = new THREE.Texture();
    const arrayTex2 = new THREE.Texture();

    const spySingle = vi.spyOn(singleTex, 'dispose');
    const spyArray1 = vi.spyOn(arrayTex1, 'dispose');
    const spyArray2 = vi.spyOn(arrayTex2, 'dispose');

    const shaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uSingle: { value: singleTex },
        uList: { value: [arrayTex1, arrayTex2] },
        uScalar: { value: 42 }
      },
      vertexShader: 'void main() { gl_Position = vec4(0.0); }',
      fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }'
    });

    const spyMat = vi.spyOn(shaderMat, 'dispose');

    ThreeResourceDisposer.disposeMaterial(shaderMat);

    expect(spySingle).toHaveBeenCalledTimes(1);
    expect(spyArray1).toHaveBeenCalledTimes(1);
    expect(spyArray2).toHaveBeenCalledTimes(1);
    expect(spyMat).toHaveBeenCalledTimes(1);
  });

  it('disposes InstancedMesh buffers', () => {
    const root = new THREE.Group();
    const geo = new THREE.BoxGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const instMesh = new THREE.InstancedMesh(geo, mat, 10);

    const spyMatrixDispose = vi.fn();
    (instMesh.instanceMatrix as any).dispose = spyMatrixDispose;

    const spyColorDispose = vi.fn();
    instMesh.instanceColor = { dispose: spyColorDispose } as any;

    root.add(instMesh);

    ThreeResourceDisposer.disposeHierarchy(root);

    expect(spyMatrixDispose).toHaveBeenCalledTimes(1);
    expect(spyColorDispose).toHaveBeenCalledTimes(1);
  });

  it('disposes WebGLRenderer, renderLists, forces context loss, and removes DOM element', () => {
    const parent = {
      removeChild: vi.fn()
    };
    const domElement = {
      parentElement: parent
    };

    const mockRenderer = {
      domElement,
      dispose: vi.fn(),
      renderLists: {
        dispose: vi.fn()
      },
      forceContextLoss: vi.fn()
    } as unknown as THREE.WebGLRenderer;

    ThreeResourceDisposer.disposeRenderer(mockRenderer);

    expect(mockRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(mockRenderer.renderLists.dispose).toHaveBeenCalledTimes(1);
    expect(mockRenderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(parent.removeChild).toHaveBeenCalledWith(domElement);
  });

  it('gracefully handles null or undefined inputs without throwing', () => {
    expect(() => ThreeResourceDisposer.disposeHierarchy(null as any)).not.toThrow();
    expect(() => ThreeResourceDisposer.disposeMaterial(null as any)).not.toThrow();
    expect(() => ThreeResourceDisposer.disposeRenderer(null as any)).not.toThrow();
  });
});
