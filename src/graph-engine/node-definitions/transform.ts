import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const transform: NodeDefinition = {
  type: 'transform',
  label: 'Transform',
  category: 'transform',
  inputs: [
    { name: 'mesh', type: 'mesh', label: 'Mesh' },
    { name: 'x', type: 'float', label: 'X' },
    { name: 'y', type: 'float', label: 'Y' },
    { name: 'z', type: 'float', label: 'Z' },
  ],
  outputs: [{ name: 'mesh', type: 'mesh', label: 'Mesh' }],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0,
      options: [
        { label: 'Translate', value: '0' },
        { label: 'Rotate', value: '1' },
        { label: 'Scale', value: '2' },
      ],
    },
    // Translate (0)
    { type: 'float', uniform: 'tx', label: 'X', min: -10, max: 10, step: 0.1, hardMin: -10000, hardMax: 10000, default: 0, linkedPort: 'x', visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'float', uniform: 'ty', label: 'Y', min: -10, max: 10, step: 0.1, hardMin: -10000, hardMax: 10000, default: 0, linkedPort: 'y', visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'float', uniform: 'tz', label: 'Z', min: -10, max: 10, step: 0.1, hardMin: -10000, hardMax: 10000, default: 0, linkedPort: 'z', visibleWhen: { uniform: 'mode', equal: 0 } },
    // Rotate (1)
    { type: 'float', uniform: 'rx', label: 'X', min: -360, max: 360, step: 1, default: 0, suffix: '°', linkedPort: 'x', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'ry', label: 'Y', min: -360, max: 360, step: 1, default: 0, suffix: '°', linkedPort: 'y', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'rz', label: 'Z', min: -360, max: 360, step: 1, default: 0, suffix: '°', linkedPort: 'z', visibleWhen: { uniform: 'mode', equal: 1 } },
    // Scale (2)
    { type: 'float', uniform: 'sx', label: 'X', min: 0.01, max: 10, step: 0.1, hardMin: 0.001, hardMax: 1000, default: 1, linkedPort: 'x', visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'sy', label: 'Y', min: 0.01, max: 10, step: 0.1, hardMin: 0.001, hardMax: 1000, default: 1, linkedPort: 'y', visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'sz', label: 'Z', min: 0.01, max: 10, step: 0.1, hardMin: 0.001, hardMax: 1000, default: 1, linkedPort: 'z', visibleWhen: { uniform: 'mode', equal: 2 } },
  ],
  defaults: {
    mode: 0,
    tx: 0, ty: 0, tz: 0,
    rx: 0, ry: 0, rz: 0,
    sx: 1, sy: 1, sz: 1,
  },
}

export function registerTransformNodes() {
  registerNode(transform)
}
