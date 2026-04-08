import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const camera: NodeDefinition = {
  type: 'camera',
  label: 'Camera',
  category: 'camera',
  inputs: [],
  outputs: [{ name: 'camera', type: 'camera', label: 'Camera' }],
  properties: [
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -50, max: 50, step: 0.5, hardMin: -1000, hardMax: 1000, default: 0 },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -50, max: 50, step: 0.5, hardMin: -1000, hardMax: 1000, default: 5 },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -50, max: 50, step: 0.5, hardMin: -1000, hardMax: 1000, default: 10 },
    { type: 'float', uniform: 'fov', label: 'FOV', min: 10, max: 120, step: 1, default: 50, suffix: '°' },
  ],
  defaults: {
    positionX: 0,
    positionY: 5,
    positionZ: 10,
    fov: 50,
  },
}

export function registerCameraNodes() {
  registerNode(camera)
}
