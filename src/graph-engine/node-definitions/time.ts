import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const time: NodeDefinition = {
  type: 'time/time',
  label: 'Time',
  category: 'time',
  inputs: [],
  outputs: [
    { name: 'elapsed', type: 'float', label: 'Elapsed' },
    { name: 'delta', type: 'float', label: 'Delta' },
  ],
  properties: [
    { type: 'float', uniform: 'speed', label: 'Speed', min: 0, max: 10, step: 0.1, default: 1 },
  ],
  defaults: { speed: 1 },
}

const sinTime: NodeDefinition = {
  type: 'time/sin',
  label: 'Sin(Time)',
  category: 'time',
  inputs: [],
  outputs: [
    { name: 'value', type: 'float', label: 'Value' },
  ],
  properties: [
    { type: 'float', uniform: 'speed', label: 'Speed', min: 0, max: 20, step: 0.1, default: 1 },
    { type: 'float', uniform: 'amplitude', label: 'Amplitude', min: 0, max: 10, step: 0.1, default: 1 },
    { type: 'float', uniform: 'offset', label: 'Offset', min: -10, max: 10, step: 0.1, default: 0 },
  ],
  defaults: { speed: 1, amplitude: 1, offset: 0 },
}

export function registerTimeNodes() {
  registerNode(time)
  registerNode(sinTime)
}
