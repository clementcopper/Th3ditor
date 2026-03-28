import type { ShaderPreset } from '../engine/types'
import fragmentShader from '../shaders/presets/wave-interference.frag'

export const waveInterferencePreset: ShaderPreset = {
  id: 'wave-interference',
  name: 'Wave Interference',
  description: 'Overlapping concentric waves creating moire patterns',
  category: 'geometric',
  fragmentShader,
  parameters: [
    { type: 'color', uniform: 'u_color1', label: 'Color 1', group: 'Colors', default: [0.2, 0.4, 1.0] },
    { type: 'color', uniform: 'u_color2', label: 'Color 2', group: 'Colors', default: [1.0, 0.3, 0.5] },
    { type: 'color', uniform: 'u_bgColor', label: 'Background', group: 'Colors', default: [0.02, 0.02, 0.06] },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_waveCount', label: 'Wave Sources', group: 'Shape', min: 2, max: 8, step: 1, default: 4 },
    { type: 'float', uniform: 'u_frequency', label: 'Frequency', group: 'Shape', min: 5, max: 60, step: 1, default: 25 },
    { type: 'float', uniform: 'u_amplitude', label: 'Amplitude', group: 'Shape', min: 0.1, max: 2, step: 0.01, default: 1.0 },
  ],
}
