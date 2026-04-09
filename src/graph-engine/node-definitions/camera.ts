import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const camera: NodeDefinition = {
  type: 'camera',
  label: 'Camera',
  category: 'camera',
  inputs: [
    { name: 'positionX',    type: 'float', label: 'Position X' },
    { name: 'positionY',    type: 'float', label: 'Position Y' },
    { name: 'positionZ',    type: 'float', label: 'Position Z' },
    { name: 'rotationX',    type: 'float', label: 'Rotation X' },
    { name: 'rotationY',    type: 'float', label: 'Rotation Y' },
    { name: 'rotationZ',    type: 'float', label: 'Rotation Z' },
    { name: 'fov',          type: 'float', label: 'FOV' },
    { name: 'path',         type: 'path',  label: 'Path' },
    { name: 'pathProgress', type: 'float', label: 'Progress' },
  ],
  outputs: [{ name: 'camera', type: 'camera', label: 'Camera' }],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0,
      options: [
        { label: 'Free',   value: '0' },
        { label: 'Target', value: '1' },
      ],
    },
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -50, max: 50, step: 0.5, hardMin: -1000, hardMax: 1000, default: 0,  linkedPort: 'positionX', visibleWhen: { portDisconnected: 'path' } },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -50, max: 50, step: 0.5, hardMin: -1000, hardMax: 1000, default: 5,  linkedPort: 'positionY', visibleWhen: { portDisconnected: 'path' } },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -50, max: 50, step: 0.5, hardMin: -1000, hardMax: 1000, default: 10, linkedPort: 'positionZ', visibleWhen: { portDisconnected: 'path' } },
    { type: 'float', uniform: 'rotationX', label: 'Rotation X', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPort: 'rotationX', visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'float', uniform: 'rotationY', label: 'Rotation Y', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPort: 'rotationY', visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'float', uniform: 'rotationZ', label: 'Rotation Z', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPort: 'rotationZ', visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'float', uniform: 'fov',       label: 'FOV',        min: 10,  max: 120,  step: 1, default: 50, suffix: '°', linkedPort: 'fov' },
    { type: 'noderef', uniform: 'targetNodeId', label: 'Target', default: '', categories: ['object'], visibleWhen: { uniform: 'mode', equal: 1 } },
    // Path constraint (always available via port — slider shows fallback value)
    { type: 'float', uniform: 'pathProgress', label: 'Progress', min: 0, max: 1, step: 0.001, default: 0, linkedPort: 'pathProgress' },
    { type: 'bool',  uniform: 'pathLookAhead', label: 'Look Ahead', default: true, visibleWhen: { uniform: 'mode', equal: 0 } },
  ],
  defaults: {
    mode: 0,
    positionX: 0, positionY: 5, positionZ: 10,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    fov: 50,
    pathProgress: 0, pathLookAhead: true,
  },
}

export function registerCameraNodes() {
  registerNode(camera)
}
