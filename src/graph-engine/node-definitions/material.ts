import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const standard: NodeDefinition = {
  type: 'material/standard',
  label: 'Standard Material',
  category: 'material',
  inputs: [
    { name: 'metalness', type: 'float', label: 'Metalness' },
    { name: 'roughness', type: 'float', label: 'Roughness' },
  ],
  outputs: [{ name: 'material', type: 'material', label: 'Material' }],
  properties: [
    { type: 'color', uniform: 'color', label: 'Color', default: [0.24, 0.52, 0.88, 1] },
    { type: 'float', uniform: 'metalness', label: 'Metalness', min: 0, max: 1, step: 0.01, default: 0.1 },
    { type: 'float', uniform: 'roughness', label: 'Roughness', min: 0, max: 1, step: 0.01, default: 0.5 },
    { type: 'bool', uniform: 'wireframe', label: 'Wireframe', default: false },
  ],
  defaults: { color: [0.24, 0.52, 0.88, 1], metalness: 0.1, roughness: 0.5, wireframe: false },
}

export function registerMaterialNodes() {
  registerNode(standard)
}
