import type { ShaderPreset } from '../engine/types'
import fragmentShader from '../shaders/presets/flow-field.frag'

export const flowFieldPreset: ShaderPreset = {
  id: 'flow-field',
  name: 'Flow Field',
  description: 'Curl noise-based flow lines with layered depth',
  category: 'noise',
  fragmentShader,
  parameters: [
    { type: 'color', uniform: 'u_lineColor', label: 'Line Color', group: 'Colors', default: [0.4, 0.7, 1.0] },
    { type: 'color', uniform: 'u_bgColor', label: 'Background', group: 'Colors', default: [0.02, 0.02, 0.08] },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_noiseScale', label: 'Noise Scale', group: 'Shape', min: 0.5, max: 5, step: 0.1, default: 2.0 },
    { type: 'float', uniform: 'u_flowSpeed', label: 'Flow Speed', group: 'Shape', min: 0.1, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_density', label: 'Density', group: 'Shape', min: 0.1, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_curl', label: 'Curl Amount', group: 'Shape', min: 0.1, max: 3, step: 0.01, default: 1.0 },
  ],
}
