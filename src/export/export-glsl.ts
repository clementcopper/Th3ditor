import type { ShaderPreset } from '../engine/types'

export function exportAsGLSL(
  preset: ShaderPreset,
  parameters: Record<string, unknown>,
): { glsl: string; manifest: string } {
  const uniformManifest = preset.parameters.map((p) => ({
    name: p.uniform,
    type: p.type === 'color' ? 'vec3' : p.type === 'vec2' ? 'vec2' : p.type === 'bool' ? 'bool' : 'float',
    label: p.label,
    value: parameters[p.uniform] ?? p.default,
    min: p.min,
    max: p.max,
  }))

  return {
    glsl: preset.fragmentShader,
    manifest: JSON.stringify(
      {
        name: preset.name,
        description: preset.description,
        builtinUniforms: ['u_time (float)', 'u_resolution (vec2)', 'u_mouse (vec2)', 'u_frame (int)'],
        uniforms: uniformManifest,
      },
      null,
      2,
    ),
  }
}
