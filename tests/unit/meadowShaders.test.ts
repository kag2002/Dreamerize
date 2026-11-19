import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createGhibliCloudMaterial,
  ghibliCloudVertexShader,
  ghibliCloudFragmentShader
} from '../../src/client/scene/shaders/ghibliCloudShader';
import {
  createGrassSwayMaterial,
  createWildflowerMaterial,
  grassSwayVertexShader,
  grassSwayFragmentShader,
  wildflowerVertexShader,
  wildflowerFragmentShader
} from '../../src/client/scene/shaders/grassSwayShader';

describe('ghibliCloudShader', () => {
  it('constructs ShaderMaterial with cel shading and rim lighting uniforms', () => {
    const mat = createGhibliCloudMaterial();
    expect(mat).toBeInstanceOf(THREE.ShaderMaterial);

    const keys = Object.keys(mat.uniforms);
    expect(keys).toContain('uTime');
    expect(keys).toContain('uSunDirection');
    expect(keys).toContain('uTopColor');
    expect(keys).toContain('uMidColor');
    expect(keys).toContain('uShadowColor');
    expect(keys).toContain('uRimColor');
    expect(keys).toContain('uShadowThreshold');
    expect(keys).toContain('uHighlightThreshold');
    expect(keys).toContain('uBandSoftness');
    expect(keys).toContain('uRimPower');
    expect(keys).toContain('uRimIntensity');
    expect(keys).toContain('uCloudSpeed');
    expect(keys).toContain('uUndulationAmplitude');
    expect(keys).toContain('uUndulationFrequency');
    expect(keys).toContain('uDriftDirection');
  });

  it('matches Ghibli reference colors in default uniforms', () => {
    const mat = createGhibliCloudMaterial();
    const topHex = mat.uniforms.uTopColor.value.getHexString();
    const midHex = mat.uniforms.uMidColor.value.getHexString();
    const shadowHex = mat.uniforms.uShadowColor.value.getHexString();
    const rimHex = mat.uniforms.uRimColor.value.getHexString();

    expect(topHex).toBe('fffdf7');
    expect(midHex).toBe('b8d6f0');
    expect(shadowHex).toBe('8c99b8');
    expect(rimHex).toBe('fff8e7');
  });

  it('implements half-Lambertian diffuse remap in fragment shader', () => {
    expect(ghibliCloudFragmentShader).toContain('dot(N, L) * 0.5 + 0.5');
  });

  it('implements 3-tone stepped cel banding via smoothstep', () => {
    expect(ghibliCloudFragmentShader).toContain('smoothstep(uShadowThreshold');
    expect(ghibliCloudFragmentShader).toContain('smoothstep(uHighlightThreshold');
    expect(ghibliCloudFragmentShader).toContain('mix(uShadowColor, uMidColor');
    expect(ghibliCloudFragmentShader).toContain('mix(color, uTopColor');
  });

  it('implements silver lining rim lighting along viewing grazing edges', () => {
    expect(ghibliCloudFragmentShader).toContain('dot(N, V)');
    expect(ghibliCloudFragmentShader).toContain('pow(1.0 - NdotV, uRimPower)');
    expect(ghibliCloudFragmentShader).toContain('mix(color, uRimColor');
  });

  it('implements organic undulation and drift in vertex shader', () => {
    expect(ghibliCloudVertexShader).toContain('uUndulationAmplitude');
    expect(ghibliCloudVertexShader).toContain('uDriftDirection');
    expect(ghibliCloudVertexShader).toContain('position + normal * undulation');
  });

  it('integrates native Three.js fog chunks', () => {
    expect(ghibliCloudVertexShader).toContain('#include <fog_vertex>');
    expect(ghibliCloudFragmentShader).toContain('#include <fog_fragment>');
  });

  it('allows custom overrides of uniforms and colors', () => {
    const mat = createGhibliCloudMaterial({
      topColor: '#ffffff',
      shadowThreshold: 0.4,
      cloudSpeed: 1.2
    });
    expect(mat.uniforms.uTopColor.value.getHexString()).toBe('ffffff');
    expect(mat.uniforms.uShadowThreshold.value).toBe(0.4);
    expect(mat.uniforms.uCloudSpeed.value).toBe(1.2);
  });
});

describe('grassSwayShader', () => {
  it('constructs ShaderMaterial with double-sided rendering', () => {
    const mat = createGrassSwayMaterial();
    expect(mat).toBeInstanceOf(THREE.ShaderMaterial);
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('initializes required wind wave and height flex uniforms', () => {
    const mat = createGrassSwayMaterial();
    const keys = Object.keys(mat.uniforms);
    expect(keys).toContain('uTime');
    expect(keys).toContain('uWindSpeed');
    expect(keys).toContain('uWindDirection');
    expect(keys).toContain('uWindStrength');
    expect(keys).toContain('uGustiness');
    expect(keys).toContain('uBaseColor');
    expect(keys).toContain('uTipColor');
    expect(keys).toContain('uSunDirection');
  });

  it('contains quadratic height flex factor (uv.y * uv.y) in vertex shader', () => {
    const hasFlex = grassSwayVertexShader.includes('uv.y * uv.y') || grassSwayVertexShader.includes('pow(uv.y, 2.0)');
    expect(hasFlex).toBe(true);
  });

  it('implements propagating wave phase equation in vertex shader', () => {
    expect(grassSwayVertexShader).toContain('dot(worldPos.xz, windDir)');
  });

  it('integrates native Three.js fog chunks', () => {
    expect(grassSwayVertexShader).toContain('#include <fog_vertex>');
    expect(grassSwayFragmentShader).toContain('#include <fog_fragment>');
  });

  it('creates wildflower material with double-sided rendering and synchronized uniforms', () => {
    const flowerMat = createWildflowerMaterial({ windSpeed: 3.0 });
    expect(flowerMat).toBeInstanceOf(THREE.ShaderMaterial);
    expect(flowerMat.side).toBe(THREE.DoubleSide);
    expect(flowerMat.uniforms.uWindSpeed.value).toBe(3.0);
    expect(wildflowerVertexShader).toContain('dot(worldPos.xz, windDir)');
    expect(wildflowerVertexShader).toContain('#include <fog_vertex>');
    expect(wildflowerFragmentShader).toContain('#include <fog_fragment>');
  });
});
