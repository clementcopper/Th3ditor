import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const time: NodeDefinition = {
  type: 'time',
  label: 'Time',
  category: 'time',
  inputs: [],
  outputs: [
    { name: 'value', type: 'float', label: 'Value' },
  ],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0, appendToHeader: true,
      options: [
        { label: 'Linear', value: '0' },
        { label: 'Sine', value: '1' },
        { label: 'Sawtooth', value: '2' },
        { label: 'Square', value: '3' },
        { label: 'Bounce', value: '4' },
        { label: 'Ease In', value: '5' },
        { label: 'Ease Out', value: '6' },
        { label: 'Ease In-Out', value: '7' },
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
