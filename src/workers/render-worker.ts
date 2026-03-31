/**
 * OffscreenCanvas render worker for jank-free video export.
 *
 * Approach:
 * - Creates an OffscreenCanvas with its own WebGL2 context
 * - Receives shader source + uniforms from main thread
 * - Renders frames at fixed intervals (not tied to rAF)
 * - Posts ImageBitmap frames back to main thread via transferToImageBitmap()
 * - Main thread draws them onto a visible canvas with MediaRecorder capturing the stream
 */

// Minimal WebGL2 renderer for OffscreenCanvas (no DOM dependencies)
const FULLSCREEN_VERT = `#version 300 es
out vec2 vUv;
void main() {
  vUv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}
`

interface InitMessage {
  type: 'init'
  width: number
  height: number
  shaderSource: string
  uniforms: Record<string, number | boolean | number[]>
}

interface RenderVideoMessage {
  type: 'render-video'
  duration: number
  fps: number
}

type WorkerMessage = InitMessage | RenderVideoMessage

let gl: WebGL2RenderingContext | null = null
let program: WebGLProgram | null = null
let vao: WebGLVertexArrayObject | null = null
let canvas: OffscreenCanvas | null = null
let storedUniforms: Record<string, number | boolean | number[]> = {}

function compileShader(glCtx: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = glCtx.createShader(type)
  if (!shader) return null
  glCtx.shaderSource(shader, source)
  glCtx.compileShader(shader)
  if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
    console.error('Worker shader compile error:', glCtx.getShaderInfoLog(shader))
    return null
  }
  return shader
}

function setUniform(glCtx: WebGL2RenderingContext, prog: WebGLProgram, name: string, value: number | boolean | number[]) {
  const loc = glCtx.getUniformLocation(prog, name)
  if (!loc) return
  if (typeof value === 'boolean') {
    glCtx.uniform1i(loc, value ? 1 : 0)
  } else if (typeof value === 'number') {
    glCtx.uniform1f(loc, value)
  } else if (Array.isArray(value)) {
    if (value.length === 2) glCtx.uniform2fv(loc, value)
    else if (value.length === 3) glCtx.uniform3fv(loc, value)
    else if (value.length === 4) glCtx.uniform4fv(loc, value)
  }
}

function init(msg: InitMessage): boolean {
  canvas = new OffscreenCanvas(msg.width, msg.height)
  const ctx = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false })
  if (!ctx) {
    self.postMessage({ type: 'error', message: 'WebGL2 not available in worker' })
    return false
  }
  gl = ctx

  gl.clearColor(0, 0, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.viewport(0, 0, msg.width, msg.height)

  vao = gl.createVertexArray()

  const vs = compileShader(gl, gl.VERTEX_SHADER, FULLSCREEN_VERT)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, msg.shaderSource)
  if (!vs || !fs) {
    self.postMessage({ type: 'error', message: 'Shader compilation failed in worker' })
    return false
  }

  program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    self.postMessage({ type: 'error', message: 'Shader link failed: ' + gl.getProgramInfoLog(program) })
    return false
  }

  gl.deleteShader(vs)
  gl.deleteShader(fs)

  storedUniforms = msg.uniforms
  self.postMessage({ type: 'ready' })
  return true
}

function renderFrame(time: number, width: number, height: number) {
  if (!gl || !program || !vao) return

  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(program)
  gl.bindVertexArray(vao)

  // Set custom uniforms
  for (const [name, value] of Object.entries(storedUniforms)) {
    setUniform(gl, program, name, value)
  }

  // Built-in uniforms
  setUniform(gl, program, 'u_time', time)
  setUniform(gl, program, 'u_resolution', [width, height])
  setUniform(gl, program, 'u_mouse', [0.5, 0.5])
  setUniform(gl, program, 'u_frame', Math.floor(time * 60))

  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function renderVideo(msg: RenderVideoMessage) {
  if (!gl || !program || !canvas) {
    self.postMessage({ type: 'error', message: 'Worker not initialized' })
    return
  }

  const { duration, fps } = msg
  const totalFrames = Math.ceil(duration * fps)
  const frameDuration = 1 / fps
  const width = canvas.width
  const height = canvas.height

  for (let i = 0; i < totalFrames; i++) {
    const time = i * frameDuration
    renderFrame(time, width, height)

    // Transfer the rendered frame as ImageBitmap (zero-copy)
    const bitmap = canvas.transferToImageBitmap()
    self.postMessage(
      { type: 'frame', bitmap, progress: (i + 1) / totalFrames },
      // @ts-expect-error transferable ImageBitmap
      [bitmap],
    )
  }

  self.postMessage({ type: 'done' })
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data
  switch (msg.type) {
    case 'init':
      init(msg)
      break
    case 'render-video':
      renderVideo(msg)
      break
  }
}
