import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const light: NodeDefinition = {
  type: 'light',
  label: 'Light',
  category: 'light',
  inputs: [
    { name: 'intensity', type: 'float', label: 'Intensity' },
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
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, visibleWhen: { uniform: 'mode', equal: 1 } },
    // Point (2)
    { type: 'float', uniform: 'ptIntensity', label: 'Intensity', min: 0, max: 10, step: 0.1, hardMax: 100, default: 1, linkedPort: 'intensity', visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'distance', label: 'Distance', min: 0, max: 100, step: 1, hardMax: 10000, default: 0, visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'ptPositionX', label: 'Position X', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 3, visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'ptPositionY', label: 'Position Y', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 3, visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'ptPositionZ', label: 'Position Z', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 3, visibleWhen: { uniform: 'mode', equal: 2 } },
  ],
  defaults: {
    mode: 1,
    color: [1, 1, 1, 1],
    intensity: 0.5,
    dirIntensity: 1, positionX: 5, positionY: 5, positionZ: 5,
    ptIntensity: 1, distance: 0, ptPositionX: 3, ptPositionY: 3, ptPositionZ: 3,
  },
}

export function registerLightNodes() {
  registerNode(light)
}
