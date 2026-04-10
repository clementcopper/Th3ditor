import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const light: NodeDefinition = {
  type: 'light',
  label: 'Light',
  category: 'light',
  inputs: [
    { name: 'intensity',    type: 'float', label: 'Intensity' },
    { name: 'positionX',   type: 'float', label: 'Position X',  visibleWhen: { uniform: 'mode', equal: [1, 2] } },
    { name: 'positionY',   type: 'float', label: 'Position Y',  visibleWhen: { uniform: 'mode', equal: [1, 2] } },
    { name: 'positionZ',   type: 'float', label: 'Position Z',  visibleWhen: { uniform: 'mode', equal: [1, 2] } },
    { name: 'distance',    type: 'float', label: 'Distance',    visibleWhen: { uniform: 'mode', equal: 2 } },
    { name: 'path',        type: 'path',  label: 'Path',        visibleWhen: { uniform: 'mode', equal: [1, 2] } },
    { name: 'pathProgress', type: 'float', label: 'Progress',   visibleWhen: { uniform: 'mode', equal: [1, 2] } },
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
    { type: 'noderef', uniform: 'targetNodeId', label: 'Target', categories: ['object'], default: '', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1] },
    // Ambient (0)
    { type: 'float', uniform: 'intensity', label: 'Intensity', min: 0, max: 5, step: 0.05, hardMax: 100, default: 0.5, linkedPort: 'intensity', visibleWhen: { uniform: 'mode', equal: 0 } },
    // Directional (1)
    { type: 'float', uniform: 'dirIntensity', label: 'Intensity', min: 0, max: 10, step: 0.1, hardMax: 100, default: 1, linkedPort: 'intensity', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, linkedPort: 'positionX', linkedPath: true, visibleWhen: { uniform: 'mode', equal: [1, 2] } },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, linkedPort: 'positionY', linkedPath: true, visibleWhen: { uniform: 'mode', equal: [1, 2] } },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, linkedPort: 'positionZ', linkedPath: true, visibleWhen: { uniform: 'mode', equal: [1, 2] } },
    // Path rotation display (only when path is connected)
    { type: 'float', uniform: 'rotationX', label: 'Rotation X', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPath: true, visibleWhen: [{ portConnected: 'path' }, { uniform: 'mode', equal: 1 }, { uniformFalsy: 'targetNodeId' }] },
    { type: 'float', uniform: 'rotationY', label: 'Rotation Y', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPath: true, visibleWhen: [{ portConnected: 'path' }, { uniform: 'mode', equal: 1 }, { uniformFalsy: 'targetNodeId' }] },
    { type: 'float', uniform: 'rotationZ', label: 'Rotation Z', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPath: true, visibleWhen: [{ portConnected: 'path' }, { uniform: 'mode', equal: 1 }, { uniformFalsy: 'targetNodeId' }] },
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
