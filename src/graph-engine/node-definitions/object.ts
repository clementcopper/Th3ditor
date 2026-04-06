import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const mesh: NodeDefinition = {
  type: 'object/mesh',
  label: 'Mesh',
  category: 'object',
  inputs: [
    { name: 'geometry', type: 'geometry', label: 'Geometry' },
    { name: 'material', type: 'material', label: 'Material' },
  ],
  outputs: [{ name: 'mesh', type: 'mesh', label: 'Mesh' }],
  properties: [
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -50, max: 50, step: 0.1, default: 0 },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -50, max: 50, step: 0.1, default: 0 },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -50, max: 50, step: 0.1, default: 0 },
  ],
  defaults: { positionX: 0, positionY: 0, positionZ: 0 },
}

export function registerObjectNodes() {
  registerNode(mesh)
}
