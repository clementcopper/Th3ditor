import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const colorNode: NodeDefinition = {
  type: 'color',
  label: 'Color',
  category: 'color',
  inputs: [
    { name: 'r', type: 'float', label: 'R' },
    { name: 'g', type: 'float', label: 'G' },
    { name: 'b', type: 'float', label: 'B' },
  ],
  outputs: [{ name: 'color', type: 'color', label: 'Color' }],
  properties: [
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1], inline: true },
  ],
  defaults: { color: [1, 1, 1, 1] },
}

const colorMix: NodeDefinition = {
  type: 'color/mix',
  label: 'Mix',
  category: 'color',
  inputs: [
    { name: 'colorA', type: 'color', label: 'A' },
    { name: 'colorB', type: 'color', label: 'B' },
    { name: 't', type: 'float', label: 'T' },
  ],
  outputs: [{ name: 'color', type: 'color', label: 'Color' }],
  properties: [
    { type: 'float', uniform: 't', label: 'T', min: 0, max: 1, step: 0.01, default: 0.5, linkedPort: 't' },
  ],
  defaults: { colorA: [0, 0, 1, 1], colorB: [1, 0, 0, 1], t: 0.5 },
}

const colorHSL: NodeDefinition = {
  type: 'color/hsl',
  label: 'HSL Shift',
  category: 'color',
  inputs: [
    { name: 'color', type: 'color', label: 'Color' },
    { name: 'hue', type: 'float', label: 'Hue' },
    { name: 'saturation', type: 'float', label: 'Sat' },
    { name: 'lightness', type: 'float', label: 'Lit' },
  ],
  outputs: [{ name: 'color', type: 'color', label: 'Color' }],
  properties: [
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1], visibleWhen: { portDisconnected: 'color' } },
    { type: 'float', uniform: 'hue', label: 'Hue Shift', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPort: 'hue' },
    { type: 'float', uniform: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, default: 0, linkedPort: 'saturation' },
    { type: 'float', uniform: 'lightness', label: 'Lightness', min: -100, max: 100, step: 1, default: 0, linkedPort: 'lightness' },
  ],
  defaults: { color: [1, 1, 1, 1], hue: 0, saturation: 0, lightness: 0 },
}

export function registerColorNodes() {
  registerNode(colorNode)
  registerNode(colorMix)
  registerNode(colorHSL)
}
