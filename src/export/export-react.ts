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
  const hasWGSL = !!preset.fragmentShaderWGSL

  // Build WebGPU custom uniform writes
  let webgpuCustomWrites = ''
  if (hasWGSL) {
    const lines: string[] = []
    let offset = 0
    for (const p of preset.parameters) {
      if (p.type === 'color') {
        const align16 = Math.ceil((offset + 1) / 16) * 16
        offset = align16
        lines.push(`        customs[${offset / 4}] = ${p.uniform}[0]; customs[${offset / 4 + 1}] = ${p.uniform}[1]; customs[${offset / 4 + 2}] = ${p.uniform}[2]; customs[${offset / 4 + 3}] = 1.0; // ${p.uniform}`)
        offset += 16
      } else if (p.type === 'bool') {
        lines.push(`        customs[${offset / 4}] = ${p.uniform} ? 1.0 : 0.0; // ${p.uniform}`)
        offset += 4
      } else {
        lines.push(`        customs[${offset / 4}] = ${p.uniform}; // ${p.uniform}`)
        offset += 4
      }
    }
    webgpuCustomWrites = lines.join('\n')
  }
  const customBufferSize = hasWGSL ? Math.max(Math.ceil(preset.parameters.length * 16 / 16) * 16, 64) : 0

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
${hasWGSL ? `
const WGSL = \`${preset.fragmentShaderWGSL!.replace(/`/g, '\\`')}\`
` : ''}
export function ${componentName}({
${defaultValues},
    className,
    style,
}: ${componentName}Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let raf: number
    let disposed = false
    const ro = new ResizeObserver(() => resize?.())
    let resize: (() => void) | null = null

    let mx = 0, my = 0
    const onMouse = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      mx = (e.clientX - r.left) / r.width
      my = 1.0 - (e.clientY - r.top) / r.height
    }
    canvas.addEventListener('mousemove', onMouse)
${hasWGSL ? `
    // Try WebGPU first, fall back to WebGL2
    async function initWebGPU(): Promise<boolean> {
      if (!navigator.gpu) return false
      try {
        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter || disposed) return false
        const device = await adapter.requestDevice()
        if (disposed) return false

        const ctx = canvas.getContext('webgpu') as GPUCanvasContext
        const format = navigator.gpu.getPreferredCanvasFormat()
        ctx.configure({ device, format, alphaMode: 'premultiplied' })

        const builtinBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
        const builtinData = new Float32Array(16)
        const customBuf = device.createBuffer({ size: ${customBufferSize}, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
        const customs = new Float32Array(${customBufferSize / 4})

        const fullShader = \`
struct Builtins { u_time: f32, _pad0: f32, u_resolution: vec2<f32>, u_mouse: vec2<f32>, u_frame: f32, _pad1: f32 };
@group(0) @binding(0) var<uniform> builtins: Builtins;
\` + WGSL

        const module = device.createShaderModule({ code: fullShader })
        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module, entryPoint: 'vs_main' },
          fragment: {
            module, entryPoint: 'fs_main',
            targets: [{ format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } }],
          },
          primitive: { topology: 'triangle-list' },
        })

        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: builtinBuf } },
            { binding: 1, resource: { buffer: customBuf } },
          ],
        })

        resize = () => {
          const dpr = window.devicePixelRatio
          canvas.width = canvas.clientWidth * dpr
          canvas.height = canvas.clientHeight * dpr
        }
        ro.observe(canvas)
        resize()

        const start = performance.now() / 1000
        let frame = 0
        function loop() {
          const t = performance.now() / 1000 - start
          builtinData[0] = t; builtinData[2] = canvas.width; builtinData[3] = canvas.height
          builtinData[4] = mx; builtinData[5] = my; builtinData[6] = frame++
          device.queue.writeBuffer(builtinBuf, 0, builtinData)

${webgpuCustomWrites}
          device.queue.writeBuffer(customBuf, 0, customs)

          const encoder = device.createCommandEncoder()
          const pass = encoder.beginRenderPass({
            colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
          })
          pass.setPipeline(pipeline)
          pass.setBindGroup(0, bindGroup)
          pass.draw(3)
          pass.end()
          device.queue.submit([encoder.finish()])
          raf = requestAnimationFrame(loop)
        }
        loop()
        return true
      } catch { return false }
    }

    function initWebGL2() {` : `
    function init() {`}
      const gl = canvas.getContext('webgl2')
      if (!gl) return

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

      const vao = gl.createVertexArray()

      function setUniform(name: string, value: number | boolean | number[]) {
        const loc = gl!.getUniformLocation(prog, name)
        if (!loc) return
        if (typeof value === 'boolean') gl!.uniform1i(loc, value ? 1 : 0)
        else if (typeof value === 'number') gl!.uniform1f(loc, value)
        else if (value.length === 2) gl!.uniform2fv(loc, value)
        else if (value.length === 3) gl!.uniform3fv(loc, value)
      }

      resize = () => {
        const dpr = window.devicePixelRatio
        canvas.width = canvas.clientWidth * dpr
        canvas.height = canvas.clientHeight * dpr
        gl!.viewport(0, 0, canvas.width, canvas.height)
      }
      ro.observe(canvas)
      resize()

      const start = performance.now() / 1000
      let frame = 0
      function loop() {
        gl!.useProgram(prog)
        gl!.bindVertexArray(vao)

${uniformSetters}

        const t = performance.now() / 1000 - start
        setUniform('u_time', t)
        setUniform('u_resolution', [canvas!.width, canvas!.height])
        setUniform('u_mouse', [mx, my])
        setUniform('u_frame', frame++)
        gl!.drawArrays(gl!.TRIANGLES, 0, 3)
        raf = requestAnimationFrame(loop)
      }
      loop()
    }
${hasWGSL ? `
    initWebGPU().then(ok => { if (!ok && !disposed) initWebGL2() })` : `
    init()`}

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMouse)
    }
  }, [${preset.parameters.map(p => p.uniform).join(', ')}])

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} />
}
`
}
