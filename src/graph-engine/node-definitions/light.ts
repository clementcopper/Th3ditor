import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const ambientLight: NodeDefinition = {
  type: 'light/ambient',
  label: 'Ambient Light',
  category: 'light',
  inputs: [
    { name: 'intensity', type: 'float', label: 'Intensity' },
  ],
  outputs: [{ name: 'light', type: 'light', label: 'Light' }],
  properties: [
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1] },
    { type: 'float', uniform: 'intensity', label: 'Intensity', min: 0, max: 5, step: 0.05, default: 0.5 },
  ],
  defaults: { color: [1, 1, 1, 1], intensity: 0.5 },
}

const directionalLight: NodeDefinition = {
  type: 'light/directional',
  label: 'Directional Light',
  category: 'light',
  inputs: [
    { name: 'intensity', type: 'float', label: 'Intensity' },
  ],
  outputs: [{ name: 'light', type: 'light', label: 'Light' }],
  properties: [
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1] },
    { type: 'float', uniform: 'intensity', label: 'Intensity', min: 0, max: 10, step: 0.1, default: 1 },
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -20, max: 20, step: 0.5, default: 5 },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -20, max: 20, step: 0.5, default: 5 },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -20, max: 20, step: 0.5, default: 5 },
  ],
  defaults: { color: [1, 1, 1, 1], intensity: 1, positionX: 5, positionY: 5, positionZ: 5 },
}

const pointLight: NodeDefinition = {
  type: 'light/point',
  label: 'Point Light',
  category: 'light',
  inputs: [
    { name: 'intensity', type: 'float', label: 'Intensity' },
  ],
  outputs: [{ name: 'light', type: 'light', label: 'Light' }],
  properties: [
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1] },
    { type: 'float', uniform: 'intensity', label: 'Intensity', min: 0, max: 10, step: 0.1, default: 1 },
    { type: 'float', uniform: 'distance', label: 'Distance', min: 0, max: 100, step: 1, default: 0 },
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -20, max: 20, step: 0.5, default: 3 },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -20, max: 20, step: 0.5, default: 3 },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -20, max: 20, step: 0.5, default: 3 },
  ],
  defaults: { color: [1, 1, 1, 1], intensity: 1, distance: 0, positionX: 3, positionY: 3, positionZ: 3 },
}

export function registerLightNodes() {
  registerNode(ambientLight)
  registerNode(directionalLight)
  registerNode(pointLight)
}
