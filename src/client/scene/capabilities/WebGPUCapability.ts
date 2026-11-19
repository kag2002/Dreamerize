export interface WebGPUAdapterInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}

export interface GraphicsCapabilities {
  webgpuSupported: boolean;
  webgpuAdapterInfo: WebGPUAdapterInfo | null;
  webgl2Supported: boolean;
  webglRenderer: string | null;
  webglVendor: string | null;
  maxTextureSize: number;
  preferredBackend: 'webgpu' | 'webgl2' | 'none';
  decoders: {
    draco: boolean;
    ktx2: boolean;
    meshopt: boolean;
    gaussianSplatting: boolean;
  };
}

/**
 * Safely probes browser/runtime graphics capabilities (WebGPU adapter, WebGL2 context,
 * unmasked GPU renderer info, and 3D asset decoder readiness).
 */
export async function detectGraphicsCapabilities(): Promise<GraphicsCapabilities> {
  let webgpuSupported = false;
  let webgpuAdapterInfo: WebGPUAdapterInfo | null = null;

  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav && nav.gpu && typeof nav.gpu.requestAdapter === 'function') {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) {
        webgpuSupported = true;
        const info = adapter.info ?? (typeof adapter.requestAdapterInfo === 'function' ? await adapter.requestAdapterInfo().catch(() => null) : null);
        if (info && typeof info === 'object') {
          webgpuAdapterInfo = {
            vendor: info.vendor || undefined,
            architecture: info.architecture || undefined,
            device: info.device || undefined,
            description: info.description || undefined
          };
        }
      }
    }
  } catch {
    webgpuSupported = false;
    webgpuAdapterInfo = null;
  }

  let webgl2Supported = false;
  let webglRenderer: string | null = null;
  let webglVendor: string | null = null;
  let maxTextureSize = 0;

  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (gl) {
        webgl2Supported = true;
        maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || null;
          webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || null;
        } else {
          webglRenderer = gl.getParameter(gl.RENDERER) || null;
          webglVendor = gl.getParameter(gl.VENDOR) || null;
        }

        const loseCtx = gl.getExtension('WEBGL_lose_context');
        if (loseCtx && typeof loseCtx.loseContext === 'function') {
          loseCtx.loseContext();
        }
      }
    }
  } catch {
    webgl2Supported = false;
  }

  const preferredBackend: GraphicsCapabilities['preferredBackend'] = webgpuSupported
    ? 'webgpu'
    : webgl2Supported
      ? 'webgl2'
      : 'none';

  return {
    webgpuSupported,
    webgpuAdapterInfo,
    webgl2Supported,
    webglRenderer,
    webglVendor,
    maxTextureSize,
    preferredBackend,
    decoders: {
      draco: true,
      ktx2: true,
      meshopt: true,
      gaussianSplatting: true
    }
  };
}
