import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react'
import type { IShaderRenderer } from '../../engine/IShaderRenderer'
import { createRenderer, type RendererBackend } from '../../engine/createRenderer'
import { useShaderStore, QUALITY_DPR } from '../../store/shader-store'
import { validateWgsl } from '../../wasm/shadertool-wasm'

export const ShaderCanvas = forwardRef<HTMLCanvasElement, { className?: string }>(function ShaderCanvas({ className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<IShaderRenderer | null>(null)
  const backendRef = useRef<RendererBackend>('webgl2')
  const [ready, setReady] = useState(false)

  useImperativeHandle(ref, () => canvasRef.current!, [])
  const activePreset = useShaderStore((s) => s.activePreset)
  const parameters = useShaderStore((s) => s.parameters)
  const renderQuality = useShaderStore((s) => s.renderQuality)
  const isPlaying = useShaderStore((s) => s.isPlaying)

  // Initialize renderer (recreate when quality changes)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let disposed = false

    setReady(false)
    createRenderer(canvas, { pixelRatio: QUALITY_DPR[renderQuality] }).then(({ renderer, backend }) => {
      if (disposed) {
        renderer.dispose()
        return
      }
      rendererRef.current = renderer
      backendRef.current = backend
      setReady(true)
    })

    return () => {
      disposed = true
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [renderQuality])

  // Load shader when preset changes or renderer becomes ready
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) return

    // Use WGSL for WebGPU backend, GLSL for WebGL2
    const source = backendRef.current === 'webgpu' && activePreset.fragmentShaderWGSL
      ? activePreset.fragmentShaderWGSL
      : activePreset.fragmentShader

    // Run naga WGSL validation in parallel (better error messages if WASM is available)
    if (backendRef.current === 'webgpu' && activePreset.fragmentShaderWGSL) {
      validateWgsl(source).then(result => {
        if (result && !result.valid) {
          console.warn('naga WGSL validation errors:', result.errors)
        }
      })
    }

    const error = renderer.loadShader(source)
    if (error) {
      console.error('Shader compile error:', error)
    }

    if (useShaderStore.getState().isPlaying) {
      renderer.play()
    } else {
      renderer.renderCurrentFrame()
    }
  }, [activePreset, ready])

  // Play/pause control
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) return

    if (isPlaying) {
      renderer.play()
    } else {
      renderer.pause()
      renderer.renderCurrentFrame()
    }
  }, [isPlaying, ready])

  // Update uniforms when parameters change
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) return

    for (const param of activePreset.parameters) {
      const value = parameters[param.uniform]
      if (param.type === 'color' && Array.isArray(value)) {
        const rgb: [number, number, number] = [value[0] as number, value[1] as number, value[2] as number]
        renderer.setUniform(param.uniform, rgb)
        const alpha = value.length === 4 ? value[3] as number : 1.0
        renderer.setUniform(param.uniform + '_alpha', alpha)
      } else {
        renderer.setUniform(param.uniform, value as number | [number, number] | [number, number, number])
      }
    }

    // Re-render current frame if paused so parameter changes are visible
    if (!useShaderStore.getState().isPlaying) {
      rendererRef.current?.renderCurrentFrame()
    }
  }, [parameters, activePreset, ready])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
})
