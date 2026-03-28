import type { ShaderPreset } from '../engine/types'

export function exportAsReact(
  preset: ShaderPreset,
  parameters: Record<string, unknown>,
): string {
  const propsInterface = preset.parameters.map((p) => {
    if (p.type === 'color') return `  ${p.uniform}?: [number, number, number]`
    if (p.type === 'bool') return `  ${p.uniform}?: boolean`
    return `  ${p.uniform}?: number`
  }).join('\n')

  const defaultValues = preset.parameters.map((p) => {
    const value = parameters[p.uniform] ?? p.default
    if (p.type === 'color') {
      const c = value as [number, number, number]
      return `    ${p.uniform} = [${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)}]`
    }
    if (p.type === 'bool') return `    ${p.uniform} = ${value}`
    return `    ${p.uniform} = ${value}`
  }).join(',\n')

  const uniformSetters = preset.parameters.map((p) => {
    return `      setUniform('${p.uniform}', ${p.uniform});`
  }).join('\n')

  const componentName = preset.name.replace(/[^a-zA-Z0-9]/g, '') + 'Shader'

  return `import { useEffect, useRef } from 'react'

interface ${componentName}Props {
${propsInterface}
  className?: string
  style?: React.CSSProperties
}

const VERT = \`#version 300 es
out vec2 vUv;
void main() {
  vUv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}\`

const FRAG = \`${preset.fragmentShader.replace(/`/g, '\\`')}\`

export function ${componentName}({
${defaultValues},
    className,
    style,
}: ${componentName}Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const progRef = useRef<WebGLProgram | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2')
    if (!gl) return
    glRef.current = gl

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, src)
      gl!.compileShader(s)
      return s
    }

    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    progRef.current = prog

    const vao = gl.createVertexArray()

    function setUniform(name: string, value: number | boolean | number[]) {
      const loc = gl!.getUniformLocation(prog, name)
      if (!loc) return
      if (typeof value === 'boolean') gl!.uniform1i(loc, value ? 1 : 0)
      else if (typeof value === 'number') gl!.uniform1f(loc, value)
      else if (value.length === 2) gl!.uniform2fv(loc, value)
      else if (value.length === 3) gl!.uniform3fv(loc, value)
    }

    const start = performance.now() / 1000
    let frame = 0
    let raf: number

    function resize() {
      const dpr = window.devicePixelRatio
      canvas!.width = canvas!.clientWidth * dpr
      canvas!.height = canvas!.clientHeight * dpr
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    function loop() {
      gl!.useProgram(prog)
      gl!.bindVertexArray(vao)

${uniformSetters}

      const t = performance.now() / 1000 - start
      setUniform('u_time', t)
      setUniform('u_resolution', [canvas!.width, canvas!.height])
      setUniform('u_frame', frame++)
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      gl!.deleteProgram(prog)
    }
  }, [${preset.parameters.map(p => p.uniform).join(', ')}])

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} />
}
`
}
