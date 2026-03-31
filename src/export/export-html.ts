import type { ShaderPreset } from '../engine/types'

function buildUniformSetters(preset: ShaderPreset, parameters: Record<string, unknown>): string {
  return preset.parameters.map((p) => {
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
}

function buildWebGPUUniformLayout(preset: ShaderPreset, parameters: Record<string, unknown>): string {
  // Build a Float32Array layout matching WebGPURenderer's buildUniformLayout
  // Builtins: u_time(0), u_resolution(4,8), u_mouse(12,16), u_frame(20) — 64 bytes
  // Customs: each uniform gets 4-byte aligned offset, colors get 16-byte (vec4) alignment
  const entries: string[] = []
  let offset = 0
  for (const p of preset.parameters) {
    const value = parameters[p.uniform] ?? p.default
    if (p.type === 'color') {
      // Align to 16 bytes for vec4
      const align16 = Math.ceil((offset + 1) / 16) * 16
      offset = align16
      const c = value as [number, number, number]
      entries.push(`    // ${p.uniform} @ offset ${offset}`)
      entries.push(`    customs[${offset / 4}] = ${c[0].toFixed(4)};`)
      entries.push(`    customs[${offset / 4 + 1}] = ${c[1].toFixed(4)};`)
      entries.push(`    customs[${offset / 4 + 2}] = ${c[2].toFixed(4)};`)
      entries.push(`    customs[${offset / 4 + 3}] = 1.0;`)
      offset += 16
    } else if (p.type === 'bool') {
      entries.push(`    customs[${offset / 4}] = ${value ? '1.0' : '0.0'}; // ${p.uniform}`)
      offset += 4
    } else {
      entries.push(`    customs[${offset / 4}] = ${value}; // ${p.uniform}`)
      offset += 4
    }
  }
  return entries.join('\n')
}

function generateWebGL2Template(preset: ShaderPreset, uniforms: string): string {
  return `
  // --- WebGL2 path ---
  const gl = canvas.getContext('webgl2');
  const vao = gl.createVertexArray();

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }

  const VERT = \\\`#version 300 es
  out vec2 vUv;
  void main() {
    vUv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
  }\\\`;
  const FRAG = \\\`${preset.fragmentShader.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\\\`;

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
  })();`
}

export function exportAsHTML(
  preset: ShaderPreset,
  parameters: Record<string, unknown>,
): string {
  const uniforms = buildUniformSetters(preset, parameters)
  const hasWGSL = !!preset.fragmentShaderWGSL
  const customUniformLayout = hasWGSL ? buildWebGPUUniformLayout(preset, parameters) : ''
  const customBufferSize = hasWGSL ? Math.ceil(preset.parameters.length * 16 / 16) * 16 : 0

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
  const canvas = document.getElementById('c');
  let mx = 0, my = 0;
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width;
    my = 1.0 - (e.clientY - r.top) / r.height;
  });
${hasWGSL ? `
  // --- WebGPU + WebGL2 dual-path ---
  const WGSL = \`${preset.fragmentShaderWGSL!.replace(/`/g, '\\`')}\`;

  async function initWebGPU() {
    if (!navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();

    const ctx = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'premultiplied' });

    // Builtins buffer: u_time(0), pad(4), u_resolution(8,12), u_mouse(16,20), u_frame(24), pad(28), pad(32-60) = 64 bytes
    const builtinBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const builtinData = new Float32Array(16);

    // Custom uniforms buffer
    const customSize = ${Math.max(customBufferSize, 64)};
    const customBuf = device.createBuffer({ size: customSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const customs = new Float32Array(customSize / 4);
${customUniformLayout}
    device.queue.writeBuffer(customBuf, 0, customs);

    const fullShader = \`
struct Builtins {
  u_time: f32,
  _pad0: f32,
  u_resolution: vec2<f32>,
  u_mouse: vec2<f32>,
  u_frame: f32,
  _pad1: f32,
};
@group(0) @binding(0) var<uniform> builtins: Builtins;

\` + WGSL;

    const module = device.createShaderModule({ code: fullShader });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main',
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: builtinBuf } },
        { binding: 1, resource: { buffer: customBuf } },
      ],
    });

    function resize() {
      const dpr = window.devicePixelRatio;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    }
    window.addEventListener('resize', resize);
    resize();

    const start = performance.now() / 1000;
    let frame = 0;
    (function loop() {
      const t = performance.now() / 1000 - start;
      builtinData[0] = t;
      builtinData[2] = canvas.width;
      builtinData[3] = canvas.height;
      builtinData[4] = mx;
      builtinData[5] = my;
      builtinData[6] = frame++;
      device.queue.writeBuffer(builtinBuf, 0, builtinData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: ctx.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      requestAnimationFrame(loop);
    })();
    return true;
  }

  initWebGPU().then(ok => {
    if (ok) return;
    // WebGL2 fallback
    ${generateWebGL2Template(preset, uniforms).split('\n').join('\n    ')}
  });` : `${generateWebGL2Template(preset, uniforms)}`}
  </script>
</body>
</html>`
}
