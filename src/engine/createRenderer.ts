import type { IShaderRenderer } from './IShaderRenderer'
import { ShaderRenderer } from './ShaderRenderer'
import { WebGPURenderer } from './WebGPURenderer'

export type RendererBackend = 'webgpu' | 'webgl2'

export interface CreateRendererResult {
  renderer: IShaderRenderer
  backend: RendererBackend
}

/**
 * Create a shader renderer, preferring WebGPU with WebGL2 fallback.
 * Returns the renderer and which backend was used.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options: { pixelRatio?: number } = {},
): Promise<CreateRendererResult> {
  // Try WebGPU first
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const renderer = await WebGPURenderer.create(canvas, options)
      return { renderer, backend: 'webgpu' }
    } catch (e) {
      console.warn('WebGPU init failed, falling back to WebGL2:', e)
    }
  }

  // Fallback to WebGL2
  const renderer = new ShaderRenderer(canvas, options)
  return { renderer, backend: 'webgl2' }
}
