import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const path: NodeDefinition = {
  type: 'path',
  label: 'Path',
  category: 'path',
  inputs: [],
  outputs: [{ name: 'path', type: 'path', label: 'Path' }],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0,
      options: [
        { label: 'Line',   value: '0' },
        { label: 'Circle', value: '1' },
        { label: 'Arc',    value: '2' },
      ],
    },
    // Line (0)
    { type: 'float',  uniform: 'length',      label: 'Length',   min: 0.1, max: 50, step: 0.1, hardMax: 1000, default: 4,   visibleWhen: { uniform: 'mode', equal: 0 } },
    {
      type: 'select', uniform: 'lineAxis', label: 'Axis', default: 0,
      options: [{ label: 'X', value: '0' }, { label: 'Y', value: '1' }, { label: 'Z', value: '2' }],
      visibleWhen: { uniform: 'mode', equal: 0 },
    },
    // Circle + Arc (1, 2)
    { type: 'float',  uniform: 'radius',      label: 'Radius',   min: 0.1, max: 50, step: 0.1, hardMax: 1000, default: 2,   visibleWhen: { uniform: 'mode', equal: [1, 2] } },
    {
      type: 'select', uniform: 'circleAxis', label: 'Plane', default: 1,
      options: [{ label: 'XY', value: '0' }, { label: 'XZ', value: '1' }, { label: 'YZ', value: '2' }],
      visibleWhen: { uniform: 'mode', equal: [1, 2] },
    },
    // Arc (2)
    { type: 'float',  uniform: 'sweepAngle',  label: 'Sweep°',   min: 1, max: 360, step: 1, default: 180, visibleWhen: { uniform: 'mode', equal: 2 } },
    // Common
    { type: 'int',    uniform: 'segments',    label: 'Segments', min: 4, max: 256, step: 1, default: 64 },
    { type: 'float',  uniform: 'positionX',   label: 'X',        min: -50, max: 50, step: 0.1, hardMin: -1000, hardMax: 1000, default: 0 },
    { type: 'float',  uniform: 'positionY',   label: 'Y',        min: -50, max: 50, step: 0.1, hardMin: -1000, hardMax: 1000, default: 0 },
    { type: 'float',  uniform: 'positionZ',   label: 'Z',        min: -50, max: 50, step: 0.1, hardMin: -1000, hardMax: 1000, default: 0 },
  ],
  defaults: {
    mode: 0,
    length: 4, lineAxis: 0,
    radius: 2, circleAxis: 1, sweepAngle: 180,
    segments: 64,
    positionX: 0, positionY: 0, positionZ: 0,
  },
}

export function registerPathNodes() {
  registerNode(path)
}
