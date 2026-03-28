import type { ShaderPreset } from '../engine/types'

export function exportAsHTML(
  preset: ShaderPreset,
  parameters: Record<string, unknown>,
): string {
  const uniforms = preset.parameters.map((p) => {
    const value = parameters[p.uniform] ?? p.default
    if (p.type === 'color') {
      const c = value as [number, number, number]
      return `  renderer.setUniform('${p.uniform}', [${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)}]);`
    }
    if (p.type === 'bool') {
      return `  renderer.setUniform('${p.uniform}', ${value ? 'true' : 'false'});`
    }
    return `  renderer.setUniform('${p.uniform}', ${value});`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${preset.name} — Shadertool Export</title>
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="c"></canvas>
  <script>
  const VERT = \`#version 300 es
  out vec2 vUv;
  void main() {
    vUv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
  }\`;

  const FRAG = \`${preset.fragmentShader.replace(/`/g, '\\`')}\`;

  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl2');
  const vao = gl.createVertexArray();

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const renderer = {
    setUniform(name, value) {
      const loc = gl.getUniformLocation(prog, name);
      if (!loc) return;
      if (typeof value === 'boolean') gl.uniform1i(loc, value ? 1 : 0);
      else if (typeof value === 'number') gl.uniform1f(loc, value);
      else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value);
        else if (value.length === 3) gl.uniform3fv(loc, value);
        else if (value.length === 4) gl.uniform4fv(loc, value);
      }
    }
  };

${uniforms}

  let mx = 0, my = 0;
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width;
    my = 1.0 - (e.clientY - r.top) / r.height;
  });

  function resize() {
    const dpr = window.devicePixelRatio;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  const start = performance.now() / 1000;
  let frame = 0;
  (function loop() {
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    const t = performance.now() / 1000 - start;
    const tLoc = gl.getUniformLocation(prog, 'u_time');
    if (tLoc) gl.uniform1f(tLoc, t);
    const rLoc = gl.getUniformLocation(prog, 'u_resolution');
    if (rLoc) gl.uniform2f(rLoc, canvas.width, canvas.height);
    const mLoc = gl.getUniformLocation(prog, 'u_mouse');
    if (mLoc) gl.uniform2f(mLoc, mx, my);
    const fLoc = gl.getUniformLocation(prog, 'u_frame');
    if (fLoc) gl.uniform1i(fLoc, frame++);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(loop);
  })();
  </script>
</body>
</html>`
}
