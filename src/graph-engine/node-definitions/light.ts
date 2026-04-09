import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const light: NodeDefinition = {
  type: 'light',
  label: 'Light',
  category: 'light',
  inputs: [
    { name: 'intensity',    type: 'float', label: 'Intensity' },
    { name: 'positionX',   type: 'float', label: 'Position X' },
    { name: 'positionY',   type: 'float', label: 'Position Y' },
    { name: 'positionZ',   type: 'float', label: 'Position Z' },
    { name: 'distance',    type: 'float', label: 'Distance' },
    { name: 'path',        type: 'path',  label: 'Path' },
    { name: 'pathProgress', type: 'float', label: 'Progress' },
  ],
  outputs: [{ name: 'light', type: 'light', label: 'Light' }],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0,
      options: [
        { label: 'Ambient', value: '0' },
        { label: 'Directional', value: '1' },
        { label: 'Point', value: '2' },
      ],
    },
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1] },
    // Ambient (0)
    { type: 'float', uniform: 'intensity', label: 'Intensity', min: 0, max: 5, step: 0.05, hardMax: 100, default: 0.5, linkedPort: 'intensity', visibleWhen: { uniform: 'mode', equal: 0 } },
    // Directional (1)
    { type: 'float', uniform: 'dirIntensity', label: 'Intensity', min: 0, max: 10, step: 0.1, hardMax: 100, default: 1, linkedPort: 'intensity', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, linkedPort: 'positionX', visibleWhen: [{ uniform: 'mode', equal: [1, 2] }, { portDisconnected: 'path' }] },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, linkedPort: 'positionY', visibleWhen: [{ uniform: 'mode', equal: [1, 2] }, { portDisconnected: 'path' }] },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, linkedPort: 'positionZ', visibleWhen: [{ uniform: 'mode', equal: [1, 2] }, { portDisconnected: 'path' }] },
    { type: 'noderef', uniform: 'targetNodeId', label: 'Target', categories: ['object'], default: '', visibleWhen: { uniform: 'mode', equal: 1 } },
    // Point (2)
    { type: 'float', uniform: 'ptIntensity', label: 'Intensity', min: 0, max: 10, step: 0.1, hardMax: 100, default: 1, linkedPort: 'intensity', visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'distance', label: 'Distance', min: 0, max: 100, step: 1, hardMax: 10000, default: 0, linkedPort: 'distance', visibleWhen: { uniform: 'mode', equal: 2 } },
    // Path constraint via port (Directional + Point only)
    { type: 'float', uniform: 'pathProgress', label: 'Progress', min: 0, max: 1, step: 0.001, default: 0, linkedPort: 'pathProgress', visibleWhen: { uniform: 'mode', notEqual: 0 } },
  ],
  defaults: {
    mode: 1,
    color: [1, 1, 1, 1],
    intensity: 0.5,
    dirIntensity: 1, positionX: 5, positionY: 5, positionZ: 5,
    targetNodeId: '',
    ptIntensity: 1, distance: 0,
    pathProgress: 0,
  },
}

export function registerLightNodes() {
  registerNode(light)
}
