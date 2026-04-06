import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const time: NodeDefinition = {
  type: 'time',
  label: 'Time',
  category: 'time',
  inputs: [],
  outputs: [
    { name: 'elapsed', type: 'float', label: 'Elapsed', visibleWhen: { uniform: 'mode', equal: 0 } },
    { name: 'delta', type: 'float', label: 'Delta', visibleWhen: { uniform: 'mode', equal: 0 } },
    { name: 'value', type: 'float', label: 'Value', visibleWhen: { uniform: 'mode', equal: 1 } },
  ],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0,
      options: [
        { label: 'Time', value: '0' },
        { label: 'Sin(Time)', value: '1' },
      ],
    },
    { type: 'float', uniform: 'speed', label: 'Speed', min: 0, max: 20, step: 0.1, hardMax: 1000, default: 1 },
    { type: 'float', uniform: 'amplitude', label: 'Amplitude', min: 0, max: 10, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'offset', label: 'Offset', min: -10, max: 10, step: 0.1, hardMin: -1000, hardMax: 1000, default: 0, visibleWhen: { uniform: 'mode', equal: 1 } },
  ],
  defaults: { mode: 0, speed: 1, amplitude: 1, offset: 0 },
}

export function registerTimeNodes() {
  registerNode(time)
}
