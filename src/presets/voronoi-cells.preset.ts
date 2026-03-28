import type { ShaderPreset } from '../engine/types'
import fragmentShader from '../shaders/presets/voronoi-cells.frag'

export const voronoiCellsPreset: ShaderPreset = {
  id: 'voronoi-cells',
  name: 'Voronoi Cells',
  description: 'Animated cellular patterns with edge detection',
  category: 'geometric',
  fragmentShader,
  parameters: [
    { type: 'color', uniform: 'u_cellColor', label: 'Cell Color', group: 'Colors', default: [0.34, 0.34, 1.0] },
    { type: 'color', uniform: 'u_edgeColor', label: 'Edge Color', group: 'Colors', default: [1.0, 1.0, 1.0] },
    { type: 'color', uniform: 'u_bgColor', label: 'Background', group: 'Colors', default: [0.05, 0.05, 0.15] },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 0.8 },
    { type: 'float', uniform: 'u_cellCount', label: 'Cell Count', group: 'Shape', min: 1, max: 15, step: 0.5, default: 5 },
    { type: 'float', uniform: 'u_edgeThickness', label: 'Edge Thickness', group: 'Shape', min: 0, max: 2, step: 0.01, default: 0.5 },
    { type: 'float', uniform: 'u_distortion', label: 'Color Variation', group: 'Effects', min: 0, max: 1, step: 0.01, default: 0.3 },
  ],
}
