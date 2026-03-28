import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { ShaderRenderer } from '../../engine/ShaderRenderer'
import { useShaderStore } from '../../store/shader-store'

export const ShaderCanvas = forwardRef<HTMLCanvasElement, { className?: string }>(function ShaderCanvas({ className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ShaderRenderer | null>(null)

  useImperativeHandle(ref, () => canvasRef.current!, [])
  const activePreset = useShaderStore((s) => s.activePreset)
  const parameters = useShaderStore((s) => s.parameters)

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new ShaderRenderer(canvas)
    rendererRef.current = renderer

    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
  }, [])

  // Load shader when preset changes
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

    const error = renderer.loadShader(activePreset.fragmentShader)
    if (error) {
      console.error('Shader compile error:', error)
    }
    renderer.play()
  }, [activePreset])

  // Update uniforms when parameters change
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

    for (const param of activePreset.parameters) {
      const value = parameters[param.uniform]
      if (param.type === 'color' && Array.isArray(value)) {
        // Send RGB as vec3 to shader, alpha as separate float
        const rgb: [number, number, number] = [value[0] as number, value[1] as number, value[2] as number]
        renderer.setUniform(param.uniform, rgb)
        // Always send alpha — default to 1.0 if vec3
        const alpha = value.length === 4 ? value[3] as number : 1.0
        renderer.setUniform(param.uniform + '_alpha', alpha)
      } else {
        renderer.setUniform(param.uniform, value as number | [number, number] | [number, number, number])
      }
    }
  }, [parameters, activePreset])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
})
