import type { UniformValue } from './types'
import type { IShaderRenderer } from './IShaderRenderer'

const FULLSCREEN_VERT_WGSL = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  var out: VertexOutput;
  let x = f32((vertex_index << 1u) & 2u);
  let y = f32(vertex_index & 2u);
  out.uv = vec2<f32>(x, y);
  out.position = vec4<f32>(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
  return out;
}
`

// Built-in uniforms: u_time, u_resolution, u_mouse, u_frame (16 floats = 64 bytes, aligned)
const BUILTIN_BUFFER_SIZE = 64

// Max custom uniforms: 128 floats = 512 bytes (plenty for any preset)
const CUSTOM_BUFFER_SIZE = 512

export class WebGPURenderer implements IShaderRenderer {
  private device: GPUDevice
  private context: GPUCanvasContext
  private format: GPUTextureFormat
  private pipeline: GPURenderPipeline | null = null
  private builtinBuffer: GPUBuffer
  private customBuffer: GPUBuffer
  private bindGroup: GPUBindGroup | null = null
  private bindGroupLayout: GPUBindGroupLayout

  private animationId: number | null = null
  private startTime = 0
  private pausedTime = 0
  private frameCount = 0
  private _playing = false

  private mouseX = 0
  private mouseY = 0
  private canvas: HTMLCanvasElement
  private options: { pixelRatio?: number }
  private resizeObserver: ResizeObserver

  // Map uniform name → { offset in bytes, type }
  private uniformLayout = new Map<string, { offset: number; size: number }>()
  private customData: Float32Array
  private pendingUniforms = new Map<string, UniformValue>()

  private constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    options: { pixelRatio?: number } = {},
  ) {
    this.canvas = canvas
    this.device = device
    this.context = context
    this.format = format
    this.options = options

    // Create uniform buffers
    this.builtinBuffer = device.createBuffer({
      size: BUILTIN_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.customBuffer = device.createBuffer({
      size: CUSTOM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.customData = new Float32Array(CUSTOM_BUFFER_SIZE / 4)

    // Bind group layout: group(0) binding(0) = builtins, binding(1) = custom uniforms
    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    })

    this.bindGroup = device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.builtinBuffer } },
        { binding: 1, resource: { buffer: this.customBuffer } },
      ],
    })

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas)
    this.handleResize()

    canvas.addEventListener('mousemove', this.handleMouseMove)
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: { pixelRatio?: number } = {},
  ): Promise<WebGPURenderer> {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) throw new Error('WebGPU adapter not available')

    const device = await adapter.requestDevice()
    const context = canvas.getContext('webgpu')!
    const format = navigator.gpu.getPreferredCanvasFormat()

    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    })

    return new WebGPURenderer(canvas, device, context, format, options)
  }

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect()
    this.mouseX = (e.clientX - rect.left) / rect.width
    // We flip frag_coord.y in shaders to match GLSL bottom-up convention,
    // so mouse Y must also be flipped (1.0 - y) to stay consistent
    this.mouseY = 1.0 - (e.clientY - rect.top) / rect.height
  }

  private handleResize() {
    const dpr = this.options.pixelRatio ?? window.devicePixelRatio
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width * dpr))
    const h = Math.max(1, Math.floor(rect.height * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  loadShader(source: string): string | null {
    // Parse uniform declarations from WGSL source to build layout
    this.buildUniformLayout(source)

    // Wrap the fragment source with the builtin struct and custom uniform struct
    const fullSource = this.buildFullShader(source)

    try {
      const shaderModule = this.device.createShaderModule({ code: fullSource })

      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      })

      this.pipeline = this.device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: this.device.createShaderModule({ code: FULLSCREEN_VERT_WGSL }),
          entryPoint: 'vs_main',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: this.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          }],
        },
        primitive: { topology: 'triangle-list' },
      })

      // Re-apply pending uniforms
      for (const [name, value] of this.pendingUniforms) {
        this.setUniform(name, value)
      }

      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  private buildUniformLayout(source: string) {
    // Reset layout and data
    this.uniformLayout.clear()
    this.customData.fill(0)

    // Extract uniform names from the source by looking for u_ prefixed identifiers
    // We assign them sequential vec4-aligned slots in the custom buffer
    const uniformRegex = /\bu_([\w]+)\b/g
    const seen = new Set<string>()
    const builtins = new Set(['u_time', 'u_resolution', 'u_mouse', 'u_frame'])
    let offset = 0
    let match: RegExpExecArray | null

    while ((match = uniformRegex.exec(source)) !== null) {
      const name = 'u_' + match[1]
      if (builtins.has(name) || seen.has(name)) continue
      seen.add(name)

      // Determine size from name conventions:
      // _alpha suffix = float (1), Color/vec3 = 3 floats padded to 4, default = 1 float
      let size = 1
      if (name.endsWith('_alpha')) {
        size = 1
      } else if (source.includes(`vec3<f32>`) && this.isVec3Uniform(name, source)) {
        size = 3 // stored as vec4 for alignment
      }

      if (size === 3) {
        // Align to 16 bytes for vec3/vec4
        const alignedOffset = Math.ceil(offset / 4) * 4
        this.uniformLayout.set(name, { offset: alignedOffset, size: 4 }) // padded to vec4
        offset = alignedOffset + 4
      } else {
        this.uniformLayout.set(name, { offset, size: 1 })
        offset += 1
      }
    }
  }

  private isVec3Uniform(name: string, _source: string): boolean {
    // Color uniforms are vec3 (padded to vec4 for alignment)
    return name.match(/color|Color/) !== null && !name.endsWith('_alpha')
  }

  private buildFullShader(userFragment: string): string {
    // Build the custom uniforms struct
    const entries: string[] = []
    const seen = new Set<string>()

    for (const [name, layout] of this.uniformLayout) {
      if (seen.has(name)) continue
      seen.add(name)
      if (layout.size === 4) {
        entries.push(`  ${name}: vec4<f32>,`) // vec3 padded to vec4
      } else {
        entries.push(`  ${name}: f32,`)
      }
    }

    // Pad to 16-byte alignment
    const totalFloats = Array.from(this.uniformLayout.values()).reduce((sum, l) => {
      const end = l.offset + (l.size === 4 ? 4 : 1)
      return Math.max(sum, end)
    }, 0)
    const paddingNeeded = (4 - (totalFloats % 4)) % 4
    for (let i = 0; i < paddingNeeded; i++) {
      entries.push(`  _pad${i}: f32,`)
    }

    // If no custom uniforms, add a dummy to avoid empty struct
    if (entries.length === 0) {
      entries.push('  _dummy: f32,')
    }

    const builtinStruct = `
struct Builtins {
  u_time: f32,
  _pad0: f32,
  u_resolution: vec2<f32>,
  u_mouse: vec2<f32>,
  u_frame: f32,
  _pad1: f32,
};

@group(0) @binding(0) var<uniform> builtins: Builtins;
`

    const customStruct = `
struct CustomUniforms {
${entries.join('\n')}
};

@group(0) @binding(1) var<uniform> customs: CustomUniforms;
`

    // Replace uniform references in the user shader:
    // - Built-in uniforms → builtins.X
    // - Custom uniforms → customs.X (with .xyz for vec3 colors)
    let processed = userFragment

    // Remove any existing struct/binding declarations the user might have
    // (the user shader should only contain functions and the fs_main entry point)

    return builtinStruct + customStruct + processed
  }

  setUniform(name: string, value: UniformValue) {
    this.pendingUniforms.set(name, value)

    const layout = this.uniformLayout.get(name)
    if (!layout) return

    if (typeof value === 'boolean') {
      this.customData[layout.offset] = value ? 1.0 : 0.0
    } else if (typeof value === 'number') {
      this.customData[layout.offset] = value
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        this.customData[layout.offset + i] = value[i]
      }
    }

    this.device.queue.writeBuffer(this.customBuffer, 0, this.customData as unknown as ArrayBuffer)
  }

  play() {
    if (this._playing) return
    this._playing = true
    this.startTime = performance.now() / 1000 - this.pausedTime
    this.renderLoop()
  }

  pause() {
    this._playing = false
    this.pausedTime = performance.now() / 1000 - this.startTime
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  renderCurrentFrame() {
    this.handleResize()
    this.renderFrame(this.pausedTime)
  }

  get playing() {
    return this._playing
  }

  renderFrame(time: number) {
    if (!this.pipeline) return

    // Update builtin uniforms
    const builtinData = new Float32Array([
      time,                      // u_time
      0,                         // _pad0
      this.canvas.width,         // u_resolution.x
      this.canvas.height,        // u_resolution.y
      this.mouseX,               // u_mouse.x
      this.mouseY,               // u_mouse.y
      this.frameCount,           // u_frame
      0,                         // _pad1
    ])
    this.device.queue.writeBuffer(this.builtinBuffer, 0, builtinData as unknown as ArrayBuffer)

    const commandEncoder = this.device.createCommandEncoder()
    const textureView = this.context.getCurrentTexture().createView()

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    })

    renderPass.setPipeline(this.pipeline)
    renderPass.setBindGroup(0, this.bindGroup!)
    renderPass.draw(3)
    renderPass.end()

    this.device.queue.submit([commandEncoder.finish()])
    this.frameCount++
  }

  private renderLoop = () => {
    if (!this._playing) return
    this.handleResize()
    const time = performance.now() / 1000 - this.startTime
    this.renderFrame(time)
    this.animationId = requestAnimationFrame(this.renderLoop)
  }

  dispose() {
    this.pause()
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('mousemove', this.handleMouseMove)
    this.builtinBuffer.destroy()
    this.customBuffer.destroy()
    this.pipeline = null
  }
}
