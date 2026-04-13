import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const math: NodeDefinition = {
  type: 'math',
  label: 'Math',
  category: 'math',
  inputs: [
    { name: 'a', type: 'float', label: 'A', visibleWhen: { uniform: 'mode', equal: [1, 2, 5, 8] } },
    { name: 'b', type: 'float', label: 'B', visibleWhen: { uniform: 'mode', equal: [1, 2, 5, 8] } },
    { name: 't', type: 'float', label: 'T', visibleWhen: { uniform: 'mode', equal: 5 } },
    { name: 'value', type: 'float', label: 'Value', visibleWhen: { uniform: 'mode', equal: [3, 4, 6, 7] } },
  ],
  outputs: [
    { name: 'value', type: 'float', label: 'Value', visibleWhen: { uniform: 'mode', equal: 0 } },
    { name: 'result', type: 'float', label: 'Result', visibleWhen: { uniform: 'mode', notEqual: 0 } },
  ],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Operation', default: 0,
      options: [
        { label: 'Number',   value: '0' },
        { label: 'Add',      value: '1' },
        { label: 'Subtract', value: '8' },
        { label: 'Multiply', value: '2' },
        { label: 'Sin',      value: '3' },
        { label: 'Cos',      value: '4' },
        { label: 'Clamp',    value: '6' },
        { label: 'Lerp',     value: '5' },
        { label: 'Remap',    value: '7' },
      ],
    },
    // Number (0)
    {
      type: 'select', uniform: 'numType', label: 'Type', default: 0,
      options: [
        { label: 'Float', value: '0' },
        { label: 'Int', value: '1' },
      ],
      visibleWhen: { uniform: 'mode', equal: 0 },
    },
    { type: 'float', uniform: 'numFloat', label: 'Value', min: -10, max: 10, step: 0.01, hardMin: -Infinity, hardMax: Infinity, default: 0, visibleWhen: [{ uniform: 'mode', equal: 0 }, { uniform: 'numType', equal: 0 }] },
    { type: 'float', uniform: 'numInt', label: 'Value', min: -100, max: 100, step: 1, hardMin: -65536, hardMax: 65536, default: 1, visibleWhen: [{ uniform: 'mode', equal: 0 }, { uniform: 'numType', equal: 1 }] },
    // Add (1)
    { type: 'float', uniform: 'a', label: 'A', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, linkedPort: 'a', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'addB', label: 'B', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, linkedPort: 'b', visibleWhen: { uniform: 'mode', equal: 1 } },
    // Multiply (2)
    { type: 'float', uniform: 'mulA', label: 'A', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 1, linkedPort: 'a', visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'mulB', label: 'B', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 1, linkedPort: 'b', visibleWhen: { uniform: 'mode', equal: 2 } },
    // Sin (3)
    { type: 'float', uniform: 'sinValue', label: 'Value', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, linkedPort: 'value', visibleWhen: { uniform: 'mode', equal: 3 } },
    // Cos (4)
    { type: 'float', uniform: 'cosValue', label: 'Value', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, linkedPort: 'value', visibleWhen: { uniform: 'mode', equal: 4 } },
    // Lerp (5)
    { type: 'float', uniform: 'lerpA', label: 'A', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, linkedPort: 'a', visibleWhen: { uniform: 'mode', equal: 5 } },
    { type: 'float', uniform: 'lerpB', label: 'B', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 1, linkedPort: 'b', visibleWhen: { uniform: 'mode', equal: 5 } },
    { type: 'float', uniform: 'lerpT', label: 'T', min: 0, max: 1, step: 0.01, default: 0.5, linkedPort: 't', visibleWhen: { uniform: 'mode', equal: 5 } },
    // Clamp (6)
    { type: 'float', uniform: 'clampValue', label: 'Value', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, linkedPort: 'value', visibleWhen: { uniform: 'mode', equal: 6 } },
    { type: 'float', uniform: 'clampMin', label: 'Min', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, visibleWhen: { uniform: 'mode', equal: 6 } },
    { type: 'float', uniform: 'clampMax', label: 'Max', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 1, visibleWhen: { uniform: 'mode', equal: 6 } },
    // Subtract (8)
    { type: 'float', uniform: 'subA', label: 'A', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, linkedPort: 'a', visibleWhen: { uniform: 'mode', equal: 8 } },
    { type: 'float', uniform: 'subB', label: 'B', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, linkedPort: 'b', visibleWhen: { uniform: 'mode', equal: 8 } },
    // Remap (7)
    { type: 'float', uniform: 'remapValue', label: 'Value', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, linkedPort: 'value', visibleWhen: { uniform: 'mode', equal: 7 } },
    { type: 'float', uniform: 'inMin', label: 'In Min', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: -1, visibleWhen: { uniform: 'mode', equal: 7 } },
    { type: 'float', uniform: 'inMax', label: 'In Max', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 1, visibleWhen: { uniform: 'mode', equal: 7 } },
    { type: 'float', uniform: 'outMin', label: 'Out Min', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 0, visibleWhen: { uniform: 'mode', equal: 7 } },
    { type: 'float', uniform: 'outMax', label: 'Out Max', min: -10, max: 10, step: 0.1, hardMin: -Infinity, hardMax: Infinity, default: 1, visibleWhen: { uniform: 'mode', equal: 7 } },
  ],
  defaults: {
    mode: 0,
    numType: 0, numFloat: 0, numInt: 1,
    a: 0, addB: 0,
    mulA: 1, mulB: 1,
    sinValue: 0,
    cosValue: 0,
    lerpA: 0, lerpB: 1, lerpT: 0.5,
    clampValue: 0, clampMin: 0, clampMax: 1,
    remapValue: 0, inMin: -1, inMax: 1, outMin: 0, outMax: 1,
    subA: 0, subB: 0,
  },
}

export function registerMathNodes() {
  registerNode(math)
}
