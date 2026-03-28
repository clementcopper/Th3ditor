import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { ShaderRenderer } from '../../engine/ShaderRenderer'
import { useShaderStore, QUALITY_DPR } from '../../store/shader-store'

export const ShaderCanvas = forwardRef<HTMLCanvasElement, { className?: string }>(function ShaderCanvas({ className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ShaderRenderer | null>(null)

  useImperativeHandle(ref, () => canvasRef.current!, [])
  const activePreset = useShaderStore((s) => s.activePreset)
  const parameters = useShaderStore((s) => s.parameters)
  const renderQuality = useShaderStore((s) => s.renderQuality)
  const isPlaying = useShaderStore((s) => s.isPlaying)

  // Initialize renderer (recreate when quality changes)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new ShaderRenderer(canvas, { pixelRatio: QUALITY_DPR[renderQuality] })
    rendererRef.current = renderer

    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
  }, [renderQuality])

  // Load shader when preset changes
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

    const error = renderer.loadShader(activePreset.fragmentShader)
    if (error) {
      console.error('Shader compile error:', error)
    }

    if (useShaderStore.getState().isPlaying) {
      renderer.play()
    } else {
      renderer.renderCurrentFrame()
    }
  }, [activePreset, renderQuality])

  // Play/pause control
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

    if (isPlaying) {
      renderer.play()
    } else {
      renderer.pause()
      renderer.renderCurrentFrame()
    }
  }, [isPlaying, renderQuality])

  // Update uniforms when parameters change
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

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
  }, [parameters, activePreset, renderQuality])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
})
