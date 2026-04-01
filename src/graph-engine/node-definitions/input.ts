import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const mouse: NodeDefinition = {
  type: 'input/mouse',
  label: 'Mouse',
  category: 'input',
  inputs: [],
  outputs: [
    { name: 'x', type: 'float', label: 'X' },
    { name: 'y', type: 'float', label: 'Y' },
    { name: 'normalizedX', type: 'float', label: 'Norm X' },
    { name: 'normalizedY', type: 'float', label: 'Norm Y' },
  ],
  properties: [],
  defaults: {},
}

const screenSize: NodeDefinition = {
  type: 'input/screen',
  label: 'Screen Size',
  category: 'input',
  inputs: [],
  outputs: [
    { name: 'width', type: 'float', label: 'Width' },
    { name: 'height', type: 'float', label: 'Height' },
  ],
  properties: [],
  defaults: {},
}

export function registerInputNodes() {
  registerNode(mouse)
  registerNode(screenSize)
}
