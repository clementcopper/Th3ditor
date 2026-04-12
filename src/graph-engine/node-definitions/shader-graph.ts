import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const shaderUV: NodeDefinition = {
  type: 'shader/uv',
  label: 'Shader UV',
  category: 'shader',
  inputs: [],
  outputs: [{ name: 'uv', type: 'svec2', label: 'UV' }],
  properties: [],
  defaults: {},
}

const shaderTime: NodeDefinition = {
  type: 'shader/time',
  label: 'Shader Time',
  category: 'shader',
  inputs: [],
  outputs: [{ name: 'time', type: 'sfloat', label: 'Time' }],
  properties: [
    { type: 'float', uniform: 'speed', label: 'Speed', min: 0, max: 10, step: 0.01, default: 1.0 },
  ],
  defaults: { speed: 1.0 },
}

const shaderMouse: NodeDefinition = {
  type: 'shader/mouse',
  label: 'Shader Mouse',
  category: 'shader',
  inputs: [],
  outputs: [{ name: 'mouse', type: 'svec2', label: 'Mouse' }],
  properties: [],
  defaults: {},
}

const shaderPosition: NodeDefinition = {
  type: 'shader/position',
  label: 'Shader Position',
  category: 'shader',
  inputs: [],
  outputs: [{ name: 'position', type: 'svec3', label: 'Position' }],
  properties: [],
  defaults: {},
}

const shaderNoise: NodeDefinition = {
  type: 'shader/noise',
  label: 'Shader Noise',
  category: 'shader',
  inputs: [
    { name: 'uv',       type: 'svec2',  label: 'UV',       visibleWhen: { portDisconnected: 'position' } },
    { name: 'position', type: 'svec3',  label: 'Position', visibleWhen: { portDisconnected: 'uv' } },
    { name: 'scale', type: 'sfloat', label: 'Scale' },
    { name: 'time',  type: 'sfloat', label: 'Time' },
    { name: 'seed',  type: 'sfloat', label: 'Seed' },
  ],
  outputs: [{ name: 'value', type: 'sfloat', label: 'Value' }],
  properties: [
    { type: 'select', uniform: 'noiseType', label: 'Type', options: [
      { label: 'fBm', value: '0' },
      { label: 'Ridged', value: '1' },
      { label: 'Voronoi', value: '2' },
    ], default: 0 },
    { type: 'float', uniform: 'scale',     label: 'Scale',      min: 0.1, max: 20,  step: 0.1,  default: 3.0, visibleWhen: { portDisconnected: 'scale' } },
    { type: 'float', uniform: 'detail',    label: 'Detail',     min: 1,   max: 8,   step: 1,    default: 4.0, visibleWhen: { uniform: 'noiseType', notEqual: 2 } },
    { type: 'float', uniform: 'timeSpeed', label: 'Time Speed', min: 0,   max: 5,   step: 0.01, default: 1.0, visibleWhen: { portDisconnected: 'time' } },
    { type: 'float', uniform: 'seed',      label: 'Seed (Pan)', min: -100, max: 100, step: 0.01, default: 0.0, visibleWhen: { portDisconnected: 'seed' } },
  ],
  defaults: { noiseType: 0, scale: 3.0, detail: 4.0, timeSpeed: 1.0, seed: 0.0 },
}

const shaderGradient: NodeDefinition = {
  type: 'shader/gradient',
  label: 'Shader Gradient',
  category: 'shader',
  inputs: [
    { name: 't', type: 'sfloat', label: 'T' },
  ],
  outputs: [{ name: 'color', type: 'svec3', label: 'Color' }],
  properties: [
    { type: 'color', uniform: 'colorA', label: 'Color A', default: [0, 0, 0, 1], inline: true },
    { type: 'color', uniform: 'colorB', label: 'Color B', default: [1, 1, 1, 1], inline: true },
    { type: 'float', uniform: 't',      label: 'T',       min: 0, max: 1, step: 0.01, default: 0.5, visibleWhen: { portDisconnected: 't' } },
  ],
  defaults: { colorA: [0, 0, 0, 1], colorB: [1, 1, 1, 1], t: 0.5 },
}

const shaderMix: NodeDefinition = {
  type: 'shader/mix',
  label: 'Shader Mix',
  category: 'shader',
  inputs: [
    { name: 'a', type: 'svec3',  label: 'A' },
    { name: 'b', type: 'svec3',  label: 'B' },
    { name: 't', type: 'sfloat', label: 'Factor' },
  ],
  outputs: [{ name: 'result', type: 'svec3', label: 'Result' }],
  properties: [
    { type: 'color', uniform: 'a', label: 'A',      default: [1, 0, 0, 1], inline: true, visibleWhen: { portDisconnected: 'a' } },
    { type: 'color', uniform: 'b', label: 'B',      default: [0, 0, 1, 1], inline: true, visibleWhen: { portDisconnected: 'b' } },
    { type: 'float', uniform: 't', label: 'Factor', default: 0.5, min: 0, max: 1, step: 0.01, visibleWhen: { portDisconnected: 't' } },
  ],
  defaults: { a: [1, 0, 0, 1], b: [0, 0, 1, 1], t: 0.5 },
}

const shaderMath: NodeDefinition = {
  type: 'shader/math',
  label: 'Shader Math',
  category: 'shader',
  inputs: [
    { name: 'a', type: 'sfloat', label: 'A' },
    { name: 'b', type: 'sfloat', label: 'B', visibleWhen: { uniform: 'op', equal: [0, 1, 2] } },
  ],
  outputs: [{ name: 'result', type: 'sfloat', label: 'Result' }],
  properties: [
    { type: 'select', uniform: 'op', label: 'Operation', options: [
      { label: 'Multiply', value: '0' },
      { label: 'Add',      value: '1' },
      { label: 'Subtract', value: '2' },
      { label: 'Sin',      value: '3' },
      { label: 'Cos',      value: '4' },
      { label: 'Abs',      value: '5' },
      { label: 'Clamp',    value: '6' },
    ], default: 0 },
    { type: 'float', uniform: 'a', label: 'A', min: -100, max: 100, step: 0.01, hardMin: -1e6, hardMax: 1e6, default: 1.0,
      visibleWhen: { portDisconnected: 'a' } },
    { type: 'float', uniform: 'b', label: 'B', min: -100, max: 100, step: 0.01, hardMin: -1e6, hardMax: 1e6, default: 1.0,
      visibleWhen: [{ uniform: 'op', equal: [0, 1, 2] }, { portDisconnected: 'b' }] },
  ],
  defaults: { op: 0, a: 1.0, b: 1.0 },
}

const shaderColor: NodeDefinition = {
  type: 'shader/color',
  label: 'Shader Color',
  category: 'shader',
  inputs: [],
  outputs: [{ name: 'color', type: 'svec3', label: 'Color' }],
  properties: [
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1], inline: true },
  ],
  defaults: { color: [1, 1, 1, 1] },
}

const shaderNumber: NodeDefinition = {
  type: 'shader/number',
  label: 'Shader Number',
  category: 'shader',
  inputs: [],
  outputs: [{ name: 'value', type: 'sfloat', label: 'Value' }],
  properties: [
    { type: 'float', uniform: 'value', label: 'Value', min: -1000, max: 1000, step: 0.01, hardMin: -1e9, hardMax: 1e9, default: 0.0 },
  ],
  defaults: { value: 0.0 },
}

const shaderOutput: NodeDefinition = {
  type: 'shader/output',
  label: 'Shader Output',
  category: 'shader',
  inputs: [
    { name: 'color',        type: 'svec3',  label: 'Color' },
    { name: 'alpha',        type: 'sfloat', label: 'Alpha' },
    { name: 'displacement', type: 'sfloat', label: 'Displacement' },
  ],
  outputs: [{ name: 'material', type: 'material', label: 'Material' }],
  properties: [
    { type: 'color', uniform: 'defaultColor',      label: 'Color',  default: [0, 0, 0, 1], inline: true,
      visibleWhen: { portDisconnected: 'color' } },
    { type: 'float', uniform: 'defaultAlpha',      label: 'Alpha',  min: 0, max: 1, step: 0.01, default: 1.0,
      visibleWhen: { portDisconnected: 'alpha' } },
    { type: 'float', uniform: 'displacementScale', label: 'Disp Scale', min: -2, max: 2, step: 0.01, default: 0.2,
      visibleWhen: { portConnected: 'displacement' } },
  ],
  defaults: { defaultColor: [0, 0, 0, 1], defaultAlpha: 1.0, displacementScale: 0.2 },
}

export function registerShaderGraphNodes() {
  registerNode(shaderUV)
  registerNode(shaderTime)
  registerNode(shaderMouse)
  registerNode(shaderPosition)
  registerNode(shaderNoise)
  registerNode(shaderGradient)
  registerNode(shaderMix)
  registerNode(shaderMath)
  registerNode(shaderColor)
  registerNode(shaderNumber)
  registerNode(shaderOutput)
}
