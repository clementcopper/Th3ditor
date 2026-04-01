import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const add: NodeDefinition = {
  type: 'math/add',
  label: 'Add',
  category: 'math',
  inputs: [
    { name: 'a', type: 'float', label: 'A' },
    { name: 'b', type: 'float', label: 'B' },
  ],
  outputs: [{ name: 'result', type: 'float', label: 'Result' }],
  properties: [
    { type: 'float', uniform: 'a', label: 'A', min: -100, max: 100, step: 0.1, default: 0 },
    { type: 'float', uniform: 'b', label: 'B', min: -100, max: 100, step: 0.1, default: 0 },
  ],
  defaults: { a: 0, b: 0 },
}

const multiply: NodeDefinition = {
  type: 'math/multiply',
  label: 'Multiply',
  category: 'math',
  inputs: [
    { name: 'a', type: 'float', label: 'A' },
    { name: 'b', type: 'float', label: 'B' },
  ],
  outputs: [{ name: 'result', type: 'float', label: 'Result' }],
  properties: [
    { type: 'float', uniform: 'a', label: 'A', min: -100, max: 100, step: 0.1, default: 1 },
    { type: 'float', uniform: 'b', label: 'B', min: -100, max: 100, step: 0.1, default: 1 },
  ],
  defaults: { a: 1, b: 1 },
}

const sin: NodeDefinition = {
  type: 'math/sin',
  label: 'Sin',
  category: 'math',
  inputs: [{ name: 'value', type: 'float', label: 'Value' }],
  outputs: [{ name: 'result', type: 'float', label: 'Result' }],
  properties: [
    { type: 'float', uniform: 'value', label: 'Value', min: -100, max: 100, step: 0.1, default: 0 },
  ],
  defaults: { value: 0 },
}

const cos: NodeDefinition = {
  type: 'math/cos',
  label: 'Cos',
  category: 'math',
  inputs: [{ name: 'value', type: 'float', label: 'Value' }],
  outputs: [{ name: 'result', type: 'float', label: 'Result' }],
  properties: [
    { type: 'float', uniform: 'value', label: 'Value', min: -100, max: 100, step: 0.1, default: 0 },
  ],
  defaults: { value: 0 },
}

const lerp: NodeDefinition = {
  type: 'math/lerp',
  label: 'Lerp',
  category: 'math',
  inputs: [
    { name: 'a', type: 'float', label: 'A' },
    { name: 'b', type: 'float', label: 'B' },
    { name: 't', type: 'float', label: 'T' },
  ],
  outputs: [{ name: 'result', type: 'float', label: 'Result' }],
  properties: [
    { type: 'float', uniform: 'a', label: 'A', min: -100, max: 100, step: 0.1, default: 0 },
    { type: 'float', uniform: 'b', label: 'B', min: -100, max: 100, step: 0.1, default: 1 },
    { type: 'float', uniform: 't', label: 'T', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  defaults: { a: 0, b: 1, t: 0.5 },
}

const clamp: NodeDefinition = {
  type: 'math/clamp',
  label: 'Clamp',
  category: 'math',
  inputs: [{ name: 'value', type: 'float', label: 'Value' }],
  outputs: [{ name: 'result', type: 'float', label: 'Result' }],
  properties: [
    { type: 'float', uniform: 'value', label: 'Value', min: -100, max: 100, step: 0.1, default: 0 },
    { type: 'float', uniform: 'min', label: 'Min', min: -100, max: 100, step: 0.1, default: 0 },
    { type: 'float', uniform: 'max', label: 'Max', min: -100, max: 100, step: 0.1, default: 1 },
  ],
  defaults: { value: 0, min: 0, max: 1 },
}

const remap: NodeDefinition = {
  type: 'math/remap',
  label: 'Remap',
  category: 'math',
  inputs: [{ name: 'value', type: 'float', label: 'Value' }],
  outputs: [{ name: 'result', type: 'float', label: 'Result' }],
  properties: [
    { type: 'float', uniform: 'value', label: 'Value', min: -100, max: 100, step: 0.1, default: 0 },
    { type: 'float', uniform: 'inMin', label: 'In Min', min: -100, max: 100, step: 0.1, default: -1 },
    { type: 'float', uniform: 'inMax', label: 'In Max', min: -100, max: 100, step: 0.1, default: 1 },
    { type: 'float', uniform: 'outMin', label: 'Out Min', min: -100, max: 100, step: 0.1, default: 0 },
    { type: 'float', uniform: 'outMax', label: 'Out Max', min: -100, max: 100, step: 0.1, default: 1 },
  ],
  defaults: { value: 0, inMin: -1, inMax: 1, outMin: 0, outMax: 1 },
}

const number: NodeDefinition = {
  type: 'math/number',
  label: 'Number',
  category: 'math',
  inputs: [],
  outputs: [{ name: 'value', type: 'float', label: 'Value' }],
  properties: [
    { type: 'float', uniform: 'value', label: 'Value', min: -10000, max: 10000, step: 0.1, default: 0 },
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0,
      options: [
        { label: 'Float', value: '0' },
        { label: 'Int', value: '1' },
      ],
    },
  ],
  defaults: { value: 0, mode: 0 },
}

export function registerMathNodes() {
  registerNode(number)
  registerNode(add)
  registerNode(multiply)
  registerNode(sin)
  registerNode(cos)
  registerNode(lerp)
  registerNode(clamp)
  registerNode(remap)
}
