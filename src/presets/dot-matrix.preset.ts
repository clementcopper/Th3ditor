import type { ShaderPreset } from '../engine/types'
import fragmentShader from '../shaders/presets/dot-matrix.frag'

export const dotMatrixPreset: ShaderPreset = {
  id: 'dot-matrix',
  name: 'Dot Matrix',
  description: 'Halftone-style dot grid with size modulation',
  category: 'pointcloud',
  fragmentShader,
  parameters: [
    { type: 'color', uniform: 'u_dotColor', label: 'Dot Color', group: 'Colors', default: [0.34, 0.34, 1.0] },
    { type: 'color', uniform: 'u_bgColor', label: 'Background', group: 'Colors', default: [0.98, 0.98, 1.0] },
    {
      type: 'select', uniform: 'u_modulationType', label: 'Modulation', group: 'Shape',
      default: 0,
      options: [
        { label: 'Noise', value: '0' },
        { label: 'Radial', value: '1' },
        { label: 'Wave', value: '2' },
      ],
    },
    { type: 'float', uniform: 'u_gridSize', label: 'Grid Size', group: 'Shape', min: 5, max: 50, step: 1, default: 20 },
    { type: 'float', uniform: 'u_dotMin', label: 'Dot Min Size', group: 'Shape', min: 0, max: 1, step: 0.01, default: 0.1 },
    { type: 'float', uniform: 'u_dotMax', label: 'Dot Max Size', group: 'Shape', min: 0.1, max: 1, step: 0.01, default: 0.9 },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 0.8 },
  ],
}
