import type { ShaderPreset } from '../engine/types'
import fragmentShader from '../shaders/presets/organic-blob.frag'

export const organicBlobPreset: ShaderPreset = {
  id: 'organic-blob',
  name: 'Organic Blob',
  description: 'Morphing metaball shapes with smooth organic edges',
  category: 'organic',
  fragmentShader,
  parameters: [
    { type: 'color', uniform: 'u_color1', label: 'Color 1', group: 'Colors', default: [0.34, 0.34, 1.0] },
    { type: 'color', uniform: 'u_color2', label: 'Color 2', group: 'Colors', default: [1.0, 0.3, 0.6] },
    { type: 'color', uniform: 'u_bgColor', label: 'Background', group: 'Colors', default: [0.98, 0.98, 1.0] },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_blobCount', label: 'Blob Count', group: 'Shape', min: 2, max: 6, step: 1, default: 4 },
    { type: 'float', uniform: 'u_smoothness', label: 'Smoothness', group: 'Shape', min: 0.05, max: 1, step: 0.01, default: 0.3 },
    { type: 'float', uniform: 'u_pulseSpeed', label: 'Pulse Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 1.5 },
    { type: 'float', uniform: 'u_size', label: 'Size', group: 'Shape', min: 0.2, max: 3, step: 0.01, default: 1.0 },
  ],
}
