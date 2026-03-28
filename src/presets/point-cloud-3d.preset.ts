import type { ShaderPreset } from '../engine/types'
import fragmentShader from '../shaders/presets/point-cloud-3d.frag'

export const pointCloud3DPreset: ShaderPreset = {
  id: 'point-cloud-3d',
  name: 'Point Cloud 3D',
  description: 'Dot raster that deforms into 3D surfaces — waves, spheres, terrain',
  category: 'pointcloud',
  fragmentShader,
  parameters: [
    { type: 'color', uniform: 'u_dotColor', label: 'Dot Color', group: 'Colors', default: [0.34, 0.34, 1.0] },
    { type: 'color', uniform: 'u_highlightColor', label: 'Highlight', group: 'Colors', default: [0.5, 0.9, 1.0] },
    { type: 'color', uniform: 'u_bgColor', label: 'Background', group: 'Colors', default: [0.04, 0.04, 0.1] },
    {
      type: 'select', uniform: 'u_deformType', label: 'Deformation', group: 'Shape',
      default: 0,
      options: [
        { label: 'Wave', value: '0' },
        { label: 'Sphere', value: '1' },
        { label: 'Terrain', value: '2' },
        { label: 'Twist', value: '3' },
      ],
    },
    { type: 'float', uniform: 'u_gridDensity', label: 'Grid Density', group: 'Shape', min: 5, max: 35, step: 1, default: 20 },
    { type: 'float', uniform: 'u_dotSize', label: 'Dot Size', group: 'Shape', min: 0.1, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_amplitude', label: 'Amplitude', group: 'Shape', min: 0, max: 1.5, step: 0.01, default: 0.5 },
    { type: 'float', uniform: 'u_perspective', label: 'Perspective', group: 'Camera', min: 1, max: 5, step: 0.1, default: 2.5 },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 0.8 },
    { type: 'float', uniform: 'u_rotationSpeed', label: 'Rotation Speed', group: 'Animation', min: 0, max: 2, step: 0.01, default: 0.5 },
  ],
}
