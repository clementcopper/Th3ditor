import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const sceneOutput: NodeDefinition = {
  type: 'scene/output',
  label: 'Scene Output',
  category: 'scene',
  inputs: [
    { name: 'mesh', type: 'mesh', label: 'Mesh' },
    { name: 'light', type: 'light', label: 'Light' },
    { name: 'camera', type: 'camera', label: 'Camera' },
  ],
  outputs: [],
  properties: [],
  defaults: {},
}

export function registerSceneNodes() {
  registerNode(sceneOutput)
}
