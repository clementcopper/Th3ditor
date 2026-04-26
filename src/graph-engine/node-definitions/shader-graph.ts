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
  outputs: [{ name: 'time', type: 'sfloat', label: 'Value' }],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Mode', default: 0, appendToHeader: true,
      options: [
        { label: 'Linear', value: '0' },
        { label: 'Sawtooth', value: '1' },
        { label: 'Sine', value: '2' },
        { label: 'Square', value: '3' },
        { label: 'Bounce', value: '4' },
        { label: 'Ease In', value: '5' },
        { label: 'Ease Out', value: '6' },
        { label: 'Ease In-Out', value: '7' },
      ],
    },
    { type: 'float', uniform: 'speed', label: 'Speed', min: 0, max: 10, step: 0.01, default: 1.0 },
  ],
  defaults: { mode: 0, speed: 1.0 },
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
  outputs: [
    { name: 'value', type: 'sfloat', label: 'Value' },
    { name: 'color', type: 'svec3',  label: 'Color' },
  ],
  properties: [
    { type: 'select', uniform: 'noiseType', label: 'Type', options: [
      { label: 'fBm', value: '0' },
      { label: 'Ridged', value: '1' },
      { label: 'Voronoi', value: '2' },
      { label: 'Worley', value: '3' },
      { label: 'Curl', value: '4' },
    ], default: 0 },
    { type: 'float', uniform: 'scale',     label: 'Scale',      min: 0.1, max: 20,  step: 0.1,  default: 3.0, visibleWhen: { portDisconnected: 'scale' } },
    { type: 'float', uniform: 'detail',    label: 'Detail',     min: 1,   max: 8,   step: 1,    default: 4.0, visibleWhen: { uniform: 'noiseType', equal: [0, 1, 4] } },
    { type: 'float', uniform: 'timeSpeed', label: 'Time Speed', min: 0,   max: 5,   step: 0.01, default: 1.0, visibleWhen: { portDisconnected: 'time' } },
    { type: 'float', uniform: 'seed',      label: 'Seed (Pan)', min: -100, max: 100, step: 0.01, default: 0.0, visibleWhen: { portDisconnected: 'seed' } },
    { type: 'float', uniform: 'bevel',     label: 'Bevel',      min: 0,    max: 1,   step: 0.01, default: 0.0 },
  ],
  defaults: { noiseType: 0, scale: 3.0, detail: 4.0, timeSpeed: 1.0, seed: 0.0, bevel: 0.0 },
}

const shaderGradient: NodeDefinition = {
  type: 'shader/gradient',
  hidden: true,
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
  hidden: true,
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
    { name: 'a', type: 'sfloat', label: 'A', visibleWhen: { uniform: 'op', notEqual: 9 } },
    { name: 'b', type: 'sfloat', label: 'B', visibleWhen: { uniform: 'op', equal: [0, 1, 2, 7] } },
    { name: 't', type: 'sfloat', label: 'T',  visibleWhen: { uniform: 'op', equal: 7 } },
  ],
  outputs: [{ name: 'value', type: 'sfloat', label: 'Value' }],
  properties: [
    { type: 'select', uniform: 'op', label: 'Operation', options: [
      { label: 'Number',   value: '9' },
      { label: 'Add',      value: '1' },
      { label: 'Subtract', value: '2' },
      { label: 'Multiply', value: '0' },
      { label: 'Sin',      value: '3' },
      { label: 'Cos',      value: '4' },
      { label: 'Abs',      value: '5' },
      { label: 'Clamp',    value: '6' },
      { label: 'Lerp',     value: '7' },
      { label: 'Fract',    value: '8' },
    ], default: 9 },
    { type: 'float', uniform: 'value', label: 'Value', min: -1000, max: 1000, step: 0.01, hardMin: -1e9, hardMax: 1e9, default: 0.0,
      visibleWhen: { uniform: 'op', equal: 9 } },
    { type: 'float', uniform: 'a', label: 'A', min: -100, max: 100, step: 0.01, hardMin: -1e6, hardMax: 1e6, default: 1.0,
      visibleWhen: [{ uniform: 'op', notEqual: 9 }, { portDisconnected: 'a' }] },
    { type: 'float', uniform: 'b', label: 'B', min: -100, max: 100, step: 0.01, hardMin: -1e6, hardMax: 1e6, default: 1.0,
      visibleWhen: [{ uniform: 'op', equal: [0, 1, 2, 7] }, { portDisconnected: 'b' }] },
    { type: 'float', uniform: 'lerpT', label: 'T', min: 0, max: 1, step: 0.01, default: 0.5,
      visibleWhen: [{ uniform: 'op', equal: 7 }, { portDisconnected: 't' }] },
  ],
  defaults: { op: 9, a: 1.0, b: 1.0, lerpT: 0.5, value: 0.0 },
}

const shaderColor: NodeDefinition = {
  type: 'shader/color',
  label: 'Shader Color',
  category: 'shader',
  inputs: [
    // Mode 0: Color — per-channel overrides
    { name: 'r', type: 'sfloat', label: 'R', visibleWhen: { uniform: 'colorMode', equal: 0 } },
    { name: 'g', type: 'sfloat', label: 'G', visibleWhen: { uniform: 'colorMode', equal: 0 } },
    { name: 'b', type: 'sfloat', label: 'B', visibleWhen: { uniform: 'colorMode', equal: 0 } },
    // Mode 1: Mix
    { name: 'colorA', type: 'svec3',  label: 'A',      visibleWhen: { uniform: 'colorMode', equal: 1 } },
    { name: 'colorB', type: 'svec3',  label: 'B',      visibleWhen: { uniform: 'colorMode', equal: 1 } },
    { name: 't',      type: 'sfloat', label: 'Factor', visibleWhen: { uniform: 'colorMode', equal: 1 } },
    // Mode 2: Ramp — note: 't' reused from Mix, only one is visible at a time
    { name: 't', type: 'sfloat', label: 'T', visibleWhen: { uniform: 'colorMode', equal: 2 } },
  ],
  outputs: [
    { name: 'color', type: 'svec3',  label: 'Color' },
    { name: 'value', type: 'sfloat', label: 'Value' },
  ],
  properties: [
    { type: 'select', uniform: 'colorMode', label: 'Mode', options: [
      { label: 'Color', value: '0' },
      { label: 'Mix',   value: '1' },
      { label: 'Ramp',  value: '2' },
    ], default: 0 },
    // Mode 0: Color — hidden when any channel port is connected (channels override static color)
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1], inline: true,
      visibleWhen: [{ uniform: 'colorMode', equal: 0 }, { portDisconnected: 'r' }, { portDisconnected: 'g' }, { portDisconnected: 'b' }] },
    // Mode 1: Mix
    { type: 'color', uniform: 'colorA', label: 'A', default: [1, 0, 0, 1], inline: true,
      visibleWhen: [{ uniform: 'colorMode', equal: 1 }, { portDisconnected: 'colorA' }] },
    { type: 'color', uniform: 'colorB', label: 'B', default: [0, 0, 1, 1], inline: true,
      visibleWhen: [{ uniform: 'colorMode', equal: 1 }, { portDisconnected: 'colorB' }] },
    { type: 'float', uniform: 't', label: 'Factor', default: 0.5, min: 0, max: 1, step: 0.01,
      visibleWhen: [{ uniform: 'colorMode', equal: 1 }, { portDisconnected: 't' }] },
    // Mode 2: Ramp
    { type: 'colorramp', uniform: 'stops', label: 'Ramp',
      default: [{ pos: 0.0, color: [0, 0, 0, 1] as [number, number, number, number] }, { pos: 1.0, color: [1, 1, 1, 1] as [number, number, number, number] }],
      visibleWhen: { uniform: 'colorMode', equal: 2 } },
    { type: 'float', uniform: 't', label: 'T', default: 0.5, min: 0, max: 1, step: 0.01,
      visibleWhen: [{ uniform: 'colorMode', equal: 2 }, { portDisconnected: 't' }] },
  ],
  defaults: {
    colorMode: 0,
    color: [1, 1, 1, 1],
    colorA: [1, 0, 0, 1],
    colorB: [0, 0, 1, 1],
    t: 0.5,
    stops: [
      { pos: 0.0, color: [0, 0, 0, 1] },
      { pos: 1.0, color: [1, 1, 1, 1] },
    ],
  },
}

const shaderNumber: NodeDefinition = {
  type: 'shader/number',
  label: 'Shader Number',
  category: 'shader',
  hidden: true,  // consolidated into shader/math op=9 (Number)
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
    { name: 'roughness',    type: 'sfloat', label: 'Roughness' },
    { name: 'metalness',    type: 'sfloat', label: 'Metalness' },
    { name: 'emissive',     type: 'svec3',  label: 'Emissive' },
    { name: 'displacement', type: 'sfloat', label: 'Displacement' },
  ],
  outputs: [{ name: 'material', type: 'material', label: 'Material' }],
  properties: [
    { type: 'color', uniform: 'defaultColor',      label: 'Color',     default: [0, 0, 0, 1], inline: true,
      visibleWhen: { portDisconnected: 'color' } },
    { type: 'float', uniform: 'defaultRoughness',  label: 'Roughness', min: 0, max: 1, step: 0.01, default: 0.5,
      visibleWhen: { portDisconnected: 'roughness' } },
    { type: 'float', uniform: 'defaultMetalness',  label: 'Metalness', min: 0, max: 1, step: 0.01, default: 0.1,
      visibleWhen: { portDisconnected: 'metalness' } },
    { type: 'float', uniform: 'displacementScale', label: 'Disp Scale', min: -2, max: 2, step: 0.01, default: 0.2,
      visibleWhen: { portConnected: 'displacement' } },
  ],
  defaults: { defaultColor: [0, 0, 0, 1], defaultRoughness: 0.5, defaultMetalness: 0.1, displacementScale: 0.2 },
}

const shaderBand: NodeDefinition = {
  type: 'shader/band',
  label: 'Shader Band',
  category: 'shader',
  inputs: [
    { name: 't',      type: 'sfloat', label: 'T (Position)' },
    { name: 'center', type: 'sfloat', label: 'Center' },
    { name: 'width',  type: 'sfloat', label: 'Width' },
  ],
  outputs: [{ name: 'value', type: 'sfloat', label: 'Value' }],
  properties: [
    { type: 'float', uniform: 'center', label: 'Center',   min: -2, max: 2,  step: 0.01, default: 0.0,  visibleWhen: { portDisconnected: 'center' } },
    { type: 'float', uniform: 'width',  label: 'Width',    min: 0,  max: 2,  step: 0.01, default: 0.15, visibleWhen: { portDisconnected: 'width' } },
    { type: 'float', uniform: 'sharp',  label: 'Sharpness', min: 0,  max: 1,  step: 0.01, default: 0.5 },
  ],
  defaults: { center: 0.0, width: 0.15, sharp: 0.5 },
}

const shaderComponent: NodeDefinition = {
  type: 'shader/component',
  label: 'Shader Component',
  category: 'shader',
  inputs: [
    { name: 'vec', type: 'svec3', label: 'Vector' },
  ],
  outputs: [{ name: 'value', type: 'sfloat', label: 'Value' }],
  properties: [
    { type: 'select', uniform: 'component', label: 'Component', options: [
      { label: 'X', value: '0' },
      { label: 'Y', value: '1' },
      { label: 'Z', value: '2' },
    ], default: 1 },
  ],
  defaults: { component: 1 },
}

const shaderColorRamp: NodeDefinition = {
  type: 'shader/colorramp',
  hidden: true,
  label: 'Shader Color Ramp',
  category: 'shader',
  inputs: [
    { name: 't', type: 'sfloat', label: 'T' },
  ],
  outputs: [{ name: 'color', type: 'svec3', label: 'Color' }],
  properties: [
    { type: 'colorramp', uniform: 'stops', label: 'Ramp', default: [
      { pos: 0.0, color: [0, 0, 0, 1] },
      { pos: 1.0, color: [1, 1, 1, 1] },
    ]},
    { type: 'float', uniform: 't', label: 'T', min: 0, max: 1, step: 0.01, default: 0.5,
      visibleWhen: { portDisconnected: 't' } },
  ],
  defaults: {
    stops: [
      { pos: 0.0, color: [0, 0, 0, 1] },
      { pos: 1.0, color: [1, 1, 1, 1] },
    ],
    t: 0.5,
  },
}

const shaderDomainWarp: NodeDefinition = {
  type: 'shader/domainwarp',
  label: 'Shader Domain Warp',
  category: 'shader',
  inputs: [
    { name: 'position', type: 'svec3', label: 'Position' },
    { name: 'strength', type: 'sfloat', label: 'Strength' },
    { name: 'time', type: 'sfloat', label: 'Time' },
  ],
  outputs: [{ name: 'warped', type: 'svec3', label: 'Warped' }],
  properties: [
    { type: 'float', uniform: 'strength', label: 'Strength', min: 0, max: 5, step: 0.01, default: 0.5,
      visibleWhen: { portDisconnected: 'strength' } },
    { type: 'float', uniform: 'scale', label: 'Scale', min: 0.1, max: 20, step: 0.1, default: 2.0 },
    { type: 'int', uniform: 'octaves', label: 'Octaves', min: 1, max: 8, step: 1, default: 4 },
    { type: 'float', uniform: 'timeSpeed', label: 'Time Speed', min: 0, max: 5, step: 0.01, default: 0.3,
      visibleWhen: { portDisconnected: 'time' } },
  ],
  defaults: { strength: 0.5, scale: 2.0, octaves: 4, timeSpeed: 0.3 },
}


const shaderPattern: NodeDefinition = {
  type: 'shader/pattern',
  label: 'Shader Pattern',
  category: 'shader',
  inputs: [
    { name: 'uv',       type: 'svec2',  label: 'UV',       visibleWhen: { portDisconnected: 'position' } },
    { name: 'position', type: 'svec3',  label: 'Position', visibleWhen: { portDisconnected: 'uv' } },
    { name: 'scale',    type: 'sfloat', label: 'Scale' },
    { name: 'softness', type: 'sfloat', label: 'Softness' },
    { name: 'radius',   type: 'sfloat', label: 'Radius',   visibleWhen: { uniform: 'mode', equal: [0] } },
    { name: 'width',    type: 'sfloat', label: 'Width',    visibleWhen: { uniform: 'mode', equal: [1] } },
    { name: 'angle',    type: 'sfloat', label: 'Angle',    visibleWhen: { uniform: 'mode', equal: [1] } },
    { name: 'colorFG',  type: 'svec3',  label: 'Fill' },
    { name: 'colorBG',  type: 'svec3',  label: 'Back' },
    { name: 'time',     type: 'sfloat', label: 'Time' },
    { name: 'mouse',    type: 'svec2',  label: 'Mouse', visibleWhen: { uniform: 'mode', equal: [0] } },
  ],
  outputs: [
    { name: 'color', type: 'svec3',  label: 'Color' },
    { name: 'value', type: 'sfloat', label: 'Value' },
  ],
  properties: [
    { type: 'select', uniform: 'mode', label: 'Mode', appendToHeader: true, options: [
      { label: 'Dots',  value: '0' },
      { label: 'Lines', value: '1' },
    ], default: 0 },
    { type: 'float', uniform: 'scale',    label: 'Scale',  min: 0.1, max: 100, step: 0.1,  default: 5,    visibleWhen: { portDisconnected: 'scale' } },
    { type: 'float', uniform: 'softness', label: 'Soft',   min: 0,   max: 1,   step: 0.01, default: 0.1,  visibleWhen: { portDisconnected: 'softness' } },
    { type: 'float', uniform: 'radius',   label: 'Radius', min: 0,   max: 0.5, step: 0.01, default: 0.25, visibleWhen: [{ uniform: 'mode', equal: [0] }, { portDisconnected: 'radius' }] },
    { type: 'float', uniform: 'width',    label: 'Width',  min: 0,   max: 1,   step: 0.01, default: 0.5,  visibleWhen: [{ uniform: 'mode', equal: [1] }, { portDisconnected: 'width' }] },
    { type: 'float', uniform: 'angle',    label: 'Angle',  min: 0,   max: 180, step: 1,    default: 0,    visibleWhen: [{ uniform: 'mode', equal: [1] }, { portDisconnected: 'angle' }] },
    { type: 'select', uniform: 'layout', label: 'Layout', options: [
      { label: 'Grid',     value: '0' },
      { label: 'Hex',      value: '1' },
      { label: 'Diagonal', value: '2' },
    ], default: '0', visibleWhen: { uniform: 'mode', equal: [0] } },
    { type: 'float', uniform: 'timeSpeed', label: 'Time Speed', min: 0, max: 10, step: 0.1, default: 0, visibleWhen: { portDisconnected: 'time' } },
    { type: 'select', uniform: 'mouseEffect', label: 'Effect', options: [
      { label: 'None',    value: '0' },
      { label: 'Attract', value: '1' },
      { label: 'Repel',   value: '2' },
      { label: 'Grow',    value: '3' },
      { label: 'Shrink',  value: '4' },
    ], default: '0', visibleWhen: [{ portConnected: 'mouse' }, { uniform: 'mode', equal: [0] }] },
    { type: 'float', uniform: 'mouseRadius',   label: 'Radius',   min: 0.01, max: 0.5, step: 0.01, default: 0.2,  visibleWhen: [{ portConnected: 'mouse' }, { uniform: 'mode', equal: [0] }, { uniform: 'mouseEffect', notEqual: 0 }] },
    { type: 'float', uniform: 'mouseStrength', label: 'Strength', min: 0,    max: 1,   step: 0.01, default: 0.5,  visibleWhen: [{ portConnected: 'mouse' }, { uniform: 'mode', equal: [0] }, { uniform: 'mouseEffect', notEqual: 0 }] },
    { type: 'color', uniform: 'colorFG',  label: 'Fill',   default: [1, 1, 1, 1], visibleWhen: { portDisconnected: 'colorFG' } },
    { type: 'color', uniform: 'colorBG',  label: 'Back',   default: [0, 0, 0, 1], visibleWhen: { portDisconnected: 'colorBG' } },
  ],
  defaults: { mode: 0, scale: 5, softness: 0.1, radius: 0.25, width: 0.5, angle: 0, layout: '0', timeSpeed: 0, mouseEffect: '0', mouseRadius: 0.2, mouseStrength: 0.5, colorFG: [1, 1, 1, 1], colorBG: [0, 0, 0, 1] },
}

const shaderDots: NodeDefinition = {
  type: 'shader/dots',
  hidden: true,
  label: 'Shader Dots',
  category: 'shader',
  inputs: [{ name: 'uv', type: 'svec2', label: 'UV' }],
  outputs: [
    { name: 'color', type: 'svec3', label: 'Color' },
    { name: 'value', type: 'sfloat', label: 'Value' },
  ],
  properties: [
    { type: 'float', uniform: 'scale',    label: 'Scale',    min: 0.1, max: 50,  step: 0.1,  default: 5 },
    { type: 'float', uniform: 'radius',   label: 'Radius',   min: 0,   max: 0.5, step: 0.01, default: 0.25 },
    { type: 'float', uniform: 'softness', label: 'Soft',     min: 0,   max: 1,   step: 0.01, default: 0.1 },
    { type: 'color', uniform: 'colorFG',  label: 'Fill',     default: [1, 1, 1, 1] },
    { type: 'color', uniform: 'colorBG',  label: 'Back',     default: [0, 0, 0, 1] },
  ],
  defaults: { scale: 5, radius: 0.25, softness: 0.1, colorFG: [1, 1, 1, 1], colorBG: [0, 0, 0, 1] },
}

const shaderLines: NodeDefinition = {
  type: 'shader/lines',
  hidden: true,
  label: 'Shader Lines',
  category: 'shader',
  inputs: [{ name: 'uv', type: 'svec2', label: 'UV' }],
  outputs: [
    { name: 'color', type: 'svec3', label: 'Color' },
    { name: 'value', type: 'sfloat', label: 'Value' },
  ],
  properties: [
    { type: 'float', uniform: 'scale',    label: 'Scale',    min: 0.1, max: 50,  step: 0.1,  default: 5 },
    { type: 'float', uniform: 'width',    label: 'Width',    min: 0,   max: 1,   step: 0.01, default: 0.5 },
    { type: 'float', uniform: 'angle',    label: 'Angle',    min: 0,   max: 180, step: 1,    default: 0 },
    { type: 'float', uniform: 'softness', label: 'Soft',     min: 0,   max: 1,   step: 0.01, default: 0.1 },
    { type: 'color', uniform: 'colorFG',  label: 'Fill',     default: [1, 1, 1, 1] },
    { type: 'color', uniform: 'colorBG',  label: 'Back',     default: [0, 0, 0, 1] },
  ],
  defaults: { scale: 5, width: 0.5, angle: 0, softness: 0.1, colorFG: [1, 1, 1, 1], colorBG: [0, 0, 0, 1] },
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
  registerNode(shaderBand)
  registerNode(shaderComponent)
  registerNode(shaderColorRamp)
  registerNode(shaderDomainWarp)
  registerNode(shaderPattern)
  registerNode(shaderDots)
  registerNode(shaderLines)
  registerNode(shaderOutput)
}
