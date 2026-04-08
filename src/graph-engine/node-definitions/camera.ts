import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const camera: NodeDefinition = {
  type: 'camera',
  label: 'Camera',
  category: 'camera',
  inputs: [
    { name: 'positionX', type: 'float', label: 'Position X' },
    { name: 'positionY', type: 'float', label: 'Position Y' },
    { name: 'positionZ', type: 'float', label: 'Position Z' },
    { name: 'rotationX', type: 'float', label: 'Rotation X' },
    { name: 'rotationY', type: 'float', label: 'Rotation Y' },
    { name: 'rotationZ', type: 'float', label: 'Rotation Z' },
    { name: 'fov', type: 'float', label: 'FOV' },
  ],
  outputs: [{ name: 'camera', type: 'camera', label: 'Camera' }],
  properties: [
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -50, max: 50, step: 0.5, hardMin: -1000, hardMax: 1000, default: 0, linkedPort: 'positionX' },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -50, max: 50, step: 0.5, hardMin: -1000, hardMax: 1000, default: 5, linkedPort: 'positionY' },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -50, max: 50, step: 0.5, hardMin: -1000, hardMax: 1000, default: 10, linkedPort: 'positionZ' },
    { type: 'float', uniform: 'rotationX', label: 'Rotation X', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPort: 'rotationX' },
    { type: 'float', uniform: 'rotationY', label: 'Rotation Y', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPort: 'rotationY' },
    { type: 'float', uniform: 'rotationZ', label: 'Rotation Z', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPort: 'rotationZ' },
    { type: 'float', uniform: 'fov', label: 'FOV', min: 10, max: 120, step: 1, default: 50, suffix: '°', linkedPort: 'fov' },
  ],
  defaults: {
    positionX: 0,
    positionY: 5,
    positionZ: 10,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    fov: 50,
  },
}

export function registerCameraNodes() {
  registerNode(camera)
}
