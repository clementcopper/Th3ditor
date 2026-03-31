import type { ShaderPreset } from '../engine/types'

export type ShaderLanguage = 'glsl' | 'wgsl'

export function exportAsGLSL(
  preset: ShaderPreset,
  parameters: Record<string, unknown>,
  language: ShaderLanguage = 'glsl',
): { source: string; manifest: string; glsl?: string } {
  const uniformManifest = preset.parameters.map((p) => ({
    name: p.uniform,
    type: p.type === 'color' ? 'vec3' : p.type === 'vec2' ? 'vec2' : p.type === 'bool' ? 'bool' : 'float',
    label: p.label,
    value: parameters[p.uniform] ?? p.default,
    min: p.min,
    max: p.max,
  }))

  const isWGSL = language === 'wgsl' && !!preset.fragmentShaderWGSL
  const source = isWGSL ? preset.fragmentShaderWGSL! : preset.fragmentShader

  const manifest = JSON.stringify(
    {
      name: preset.name,
      description: preset.description,
      language: isWGSL ? 'wgsl' : 'glsl',
      builtinUniforms: isWGSL
        ? ['builtins.u_time (f32)', 'builtins.u_resolution (vec2<f32>)', 'builtins.u_mouse (vec2<f32>)', 'builtins.u_frame (f32)']
        : ['u_time (float)', 'u_resolution (vec2)', 'u_mouse (vec2)', 'u_frame (int)'],
      uniforms: uniformManifest,
    },
    null,
    2,
  )

  return {
    source,
    manifest,
    // Keep backwards-compatible `glsl` field
    glsl: isWGSL ? undefined : source,
  }
}
