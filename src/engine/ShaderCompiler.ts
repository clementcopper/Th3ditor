export function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown error'
    gl.deleteShader(shader)
    throw new Error(`Shader compilation error:\n${formatShaderError(log, source)}`)
  }

  return shader
}

export function linkProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown error'
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${log}`)
  }

  return program
}

function formatShaderError(log: string, source: string): string {
  const lines = source.split('\n')
  return log.replace(/ERROR:\s*\d+:(\d+)/g, (_match, lineNum) => {
    const line = parseInt(lineNum, 10)
    const context = lines.slice(Math.max(0, line - 3), line + 2)
      .map((l, i) => {
        const num = Math.max(1, line - 2) + i
        const marker = num === line ? '>>>' : '   '
        return `${marker} ${num}: ${l}`
      })
      .join('\n')
    return `ERROR at line ${line}:\n${context}`
  })
}
