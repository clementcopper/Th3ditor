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
      type: 'select', uniform: 'u_shapeType', label: 'Shape', group: 'Geometry',
      default: 0,
      options: [
        { label: 'Surface', value: '0' },
        { label: 'Sphere', value: '1' },
      ],
    },
    { type: 'float', uniform: 'u_scale', label: 'Size', group: 'Geometry', min: 0.2, max: 3, step: 0.01, default: 1.0 },
    { type: 'float', uniform: 'u_gridDensity', label: 'Grid Density', group: 'Geometry', min: 5, max: 30, step: 1, default: 15 },
    { type: 'float', uniform: 'u_dotSize', label: 'Dot Size', group: 'Geometry', min: 0.1, max: 3, step: 0.01, default: 1.0 },
    {
      type: 'select', uniform: 'u_deformType', label: 'Deformation', group: 'Geometry',
      default: 1,
      options: [
        { label: 'None', value: '0' },
        { label: 'Wave', value: '1' },
        { label: 'Terrain', value: '2' },
        { label: 'Twist', value: '3' },
      ],
    },
    { type: 'float', uniform: 'u_amplitude', label: 'Amplitude', group: 'Geometry', min: 0, max: 1.5, step: 0.01, default: 0.5 },
    { type: 'float', uniform: 'u_perspective', label: 'Zoom', group: 'Camera', min: 1, max: 5, step: 0.1, default: 2.5 },
    { type: 'float', uniform: 'u_posX', label: 'Position X', group: 'Camera', min: -2, max: 2, step: 0.01, default: 0 },
    { type: 'float', uniform: 'u_posY', label: 'Position Y', group: 'Camera', min: -2, max: 2, step: 0.01, default: 0 },
    { type: 'float', uniform: 'u_rotateX', label: 'Rotate X', group: 'Camera', min: -3.14, max: 3.14, step: 0.01, default: -0.3 },
    { type: 'float', uniform: 'u_rotateY', label: 'Rotate Y', group: 'Camera', min: -3.14, max: 3.14, step: 0.01, default: 0 },
    { type: 'float', uniform: 'u_speed', label: 'Speed', group: 'Animation', min: 0, max: 3, step: 0.01, default: 0.8 },
  ],
}
