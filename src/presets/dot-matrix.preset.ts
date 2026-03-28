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
    { type: 'color', uniform: 'u_highlightColor', label: 'Highlight', group: 'Colors', default: [0.5, 0.9, 1.0] },
    { type: 'color', uniform: 'u_bgColor', label: 'Background', group: 'Colors', default: [0.98, 0.98, 1.0] },
    {
      type: 'select', uniform: 'u_modulationType', label: 'Modulation', group: 'Shape',
      default: 0,
      options: [
        { label: 'Noise', value: '0' },
        { label: 'Radial', value: '1' },
        { label: 'Wave', value: '2' },
        { label: 'Checker', value: '3' },
        { label: 'Spiral', value: '4' },
        { label: 'Scanline', value: '5' },
        { label: 'Gradient', value: '6' },
        { label: 'Pulse', value: '7' },
      ],
    },
    {
      type: 'select', uniform: 'u_dotShape', label: 'Dot Shape', group: 'Shape',
      default: 0,
      options: [
        { label: 'Circle', value: '0' },
        { label: 'Square', value: '1' },
        { label: 'Diamond', value: '2' },
      ],
    },
    { type: 'float', uniform: 'u_gridSize', label: 'Grid Size', group: 'Shape', min: 5, max: 50, step: 1, default: 20 },
    { type: 'float', uniform: 'u_dotMin', label: 'Dot Min Size', group: 'Shape', min: 0, max: 1, step: 0.01, default: 0.1 },
    { type: 'float', uniform: 'u_dotMax', label: 'Dot Max Size', group: 'Shape', min: 0.1, max: 1, step: 0.01, default: 0.9 },
    { type: 'float', uniform: 'u_spacing', label: 'Spacing', group: 'Shape', min: 0.3, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_frequency', label: 'Frequency', group: 'Shape', min: 0.5, max: 10, step: 0.1, default: 3 },
    { type: 'float', uniform: 'u_rotation', label: 'Rotation', group: 'Shape', min: 0, max: 360, step: 1, default: 0, suffix: '°' },
    {
      type: 'select', uniform: 'u_interactMode', label: 'Mode', group: 'Interaction',
      default: 0,
      options: [
        { label: 'None', value: '0' },
        { label: 'Attractor', value: '1' },
        { label: 'Repel', value: '2' },
        { label: 'Magnet', value: '3' },
        { label: 'Spotlight', value: '4' },
      ],
    },
    { type: 'float', uniform: 'u_interactStrength', label: 'Strength', group: 'Interaction', min: 0, max: 3, step: 0.01, default: 1.0, visibleWhen: { uniform: 'u_interactMode', notEqual: 0 } },
    { type: 'float', uniform: 'u_interactRadius', label: 'Radius', group: 'Interaction', min: 0.05, max: 2, step: 0.01, default: 0.5, visibleWhen: { uniform: 'u_interactMode', notEqual: 0 } },
    { type: 'float', uniform: 'u_interactFalloff', label: 'Falloff', group: 'Interaction', min: 0.1, max: 5, step: 0.1, default: 1.0, visibleWhen: { uniform: 'u_interactMode', notEqual: 0 } },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 0.8 },
  ],
}
