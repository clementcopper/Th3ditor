import type { UniformValue } from './types'

const FULLSCREEN_VERT = `#version 300 es
out vec2 vUv;
void main() {
  vUv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}
`

export class ShaderRenderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private animationId: number | null = null
  private startTime = 0
  private pausedTime = 0
  private frameCount = 0
  private uniformLocations = new Map<string, WebGLUniformLocation | null>()
  private pendingUniforms = new Map<string, UniformValue>()
  private _playing = false
  private mouseX = 0
  private mouseY = 0
  private resizeObserver: ResizeObserver
  private canvas: HTMLCanvasElement
  private options: { pixelRatio?: number }

  constructor(
    canvas: HTMLCanvasElement,
    options: { pixelRatio?: number } = {},
  ) {
    this.canvas = canvas
    this.options = options
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false })
    if (!gl) throw new Error('WebGL2 not supported')
    this.gl = gl

    this.vao = gl.createVertexArray()

    // Transparent clear so CSS checkerboard shows through
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas)
    this.handleResize()

    canvas.addEventListener('mousemove', this.handleMouseMove)
  }

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect()
    this.mouseX = (e.clientX - rect.left) / rect.width
    this.mouseY = 1.0 - (e.clientY - rect.top) / rect.height
  }

  private handleResize() {
    const dpr = this.options.pixelRatio ?? window.devicePixelRatio
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.floor(rect.width * dpr)
    const h = Math.floor(rect.height * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
      this.gl.viewport(0, 0, w, h)
    }
  }

  loadShader(fragmentSource: string): string | null {
    const gl = this.gl

    const vertShader = this.compileShader(gl.VERTEX_SHADER, FULLSCREEN_VERT)
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource)
    if (!vertShader || !fragShader) {
      return gl.getShaderInfoLog(fragShader!) ?? 'Shader compilation failed'
    }

    const program = gl.createProgram()!
    gl.attachShader(program, vertShader)
    gl.attachShader(program, fragShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(program) ?? 'Link failed'
      gl.deleteProgram(program)
      gl.deleteShader(vertShader)
      gl.deleteShader(fragShader)
      return err
    }

    if (this.program) gl.deleteProgram(this.program)
    this.program = program
    this.uniformLocations.clear()

    gl.deleteShader(vertShader)
    gl.deleteShader(fragShader)

    // Re-apply pending uniforms
    for (const [name, value] of this.pendingUniforms) {
      this.setUniform(name, value)
    }

    return null
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader))
      return null
    }
    return shader
  }

  private getUniformLocation(name: string): WebGLUniformLocation | null {
    if (this.uniformLocations.has(name)) return this.uniformLocations.get(name)!
    const loc = this.gl.getUniformLocation(this.program!, name)
    this.uniformLocations.set(name, loc)
    return loc
  }

  setUniform(name: string, value: UniformValue) {
    this.pendingUniforms.set(name, value)
    if (!this.program) return

    const gl = this.gl
    gl.useProgram(this.program)
    const loc = this.getUniformLocation(name)
    if (!loc) return

    if (typeof value === 'boolean') {
      gl.uniform1i(loc, value ? 1 : 0)
    } else if (typeof value === 'number') {
      gl.uniform1f(loc, value)
    } else if (Array.isArray(value)) {
      if (value.length === 2) gl.uniform2fv(loc, value)
      else if (value.length === 3) gl.uniform3fv(loc, value)
      else if (value.length === 4) gl.uniform4fv(loc, value)
    }
  }

  play() {
    if (this._playing) return
    this._playing = true
    // Resume from where we paused
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

  /** Render a single frame at the current paused time — used to preview parameter changes while paused */
  renderCurrentFrame() {
    this.handleResize()
    this.renderFrame(this.pausedTime)
  }

  get playing() {
    return this._playing
  }

  renderFrame(time: number) {
    const gl = this.gl
    if (!this.program) return

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    // Built-in uniforms
    const timeLoc = this.getUniformLocation('u_time')
    if (timeLoc) gl.uniform1f(timeLoc, time)

    const resLoc = this.getUniformLocation('u_resolution')
    if (resLoc) gl.uniform2f(resLoc, this.canvas.width, this.canvas.height)

    const mouseLoc = this.getUniformLocation('u_mouse')
    if (mouseLoc) gl.uniform2f(mouseLoc, this.mouseX, this.mouseY)

    const frameLoc = this.getUniformLocation('u_frame')
    if (frameLoc) gl.uniform1i(frameLoc, this.frameCount)

    gl.drawArrays(gl.TRIANGLES, 0, 3)
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
    if (this.program) {
      this.gl.deleteProgram(this.program)
      this.program = null
    }
    if (this.vao) {
      this.gl.deleteVertexArray(this.vao)
      this.vao = null
    }
  }
}
