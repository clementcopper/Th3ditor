import type { ShaderPreset } from '../engine/types'
import fragmentShader from '../shaders/presets/gradient-orb.frag'

export const gradientOrbPreset: ShaderPreset = {
  id: 'gradient-orb',
  name: 'Gradient Orb',
  description: 'Luminous floating sphere with gradient glow',
  category: 'gradient',
  fragmentShader,
  parameters: [
    { type: 'color', uniform: 'u_innerColor', label: 'Inner Color', group: 'Colors', default: [0.5, 0.4, 1.0] },
    { type: 'color', uniform: 'u_outerColor', label: 'Outer Color', group: 'Colors', default: [0.2, 0.6, 1.0] },
    { type: 'color', uniform: 'u_bgColor', label: 'Background', group: 'Colors', default: [0.02, 0.02, 0.08] },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_orbSize', label: 'Orb Size', group: 'Shape', min: 0.1, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_glowRadius', label: 'Glow Radius', group: 'Effects', min: 0.1, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_driftSpeed', label: 'Drift Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 1.0 },
  ],
}
