import type { ShaderPreset } from '../engine/types'
import fragmentShader from '../shaders/presets/aurora.frag'

export const auroraPreset: ShaderPreset = {
  id: 'aurora',
  name: 'Aurora Borealis',
  description: 'Northern lights ribbons with flowing motion',
  category: 'atmospheric',
  fragmentShader,
  parameters: [
    { type: 'color', uniform: 'u_color1', label: 'Color 1', group: 'Colors', default: [0.1, 0.9, 0.5] },
    { type: 'color', uniform: 'u_color2', label: 'Color 2', group: 'Colors', default: [0.2, 0.5, 1.0] },
    { type: 'color', uniform: 'u_color3', label: 'Color 3', group: 'Colors', default: [0.6, 0.2, 0.9] },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_ribbonCount', label: 'Ribbon Count', group: 'Shape', min: 1, max: 6, step: 1, default: 4 },
    { type: 'float', uniform: 'u_verticalDrift', label: 'Vertical Drift', group: 'Shape', min: 0, max: 2, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_brightness', label: 'Brightness', group: 'Effects', min: 0.1, max: 3, step: 0.01, default: 1.5 },
    { type: 'float', uniform: 'u_fadeEdges', label: 'Edge Fade', group: 'Effects', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
}
