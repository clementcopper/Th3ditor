import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const input: NodeDefinition = {
  type: 'input',
  label: 'Input',
  category: 'input',
  inputs: [],
  outputs: [
    { name: 'x', type: 'float', label: 'X', visibleWhen: { uniform: 'mode', equal: 0 } },
    { name: 'y', type: 'float', label: 'Y', visibleWhen: { uniform: 'mode', equal: 0 } },
    { name: 'normalizedX', type: 'float', label: 'Norm X', visibleWhen: { uniform: 'mode', equal: 0 } },
    { name: 'normalizedY', type: 'float', label: 'Norm Y', visibleWhen: { uniform: 'mode', equal: 0 } },
    { name: 'width', type: 'float', label: 'Width', visibleWhen: { uniform: 'mode', equal: 1 } },
    { name: 'height', type: 'float', label: 'Height', visibleWhen: { uniform: 'mode', equal: 1 } },
  ],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0,
      options: [
        { label: 'Mouse', value: '0' },
        { label: 'Screen Size', value: '1' },
      ],
    },
  ],
  defaults: { mode: 0 },
}

export function registerInputNodes() {
  registerNode(input)
}
