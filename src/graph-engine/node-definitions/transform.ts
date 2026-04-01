import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const translate: NodeDefinition = {
  type: 'transform/translate',
  label: 'Translate',
  category: 'transform',
  inputs: [
    { name: 'mesh', type: 'mesh', label: 'Mesh' },
    { name: 'x', type: 'float', label: 'X' },
    { name: 'y', type: 'float', label: 'Y' },
    { name: 'z', type: 'float', label: 'Z' },
  ],
  outputs: [{ name: 'mesh', type: 'mesh', label: 'Mesh' }],
  properties: [
    { type: 'float', uniform: 'x', label: 'X', min: -50, max: 50, step: 0.1, default: 0 },
    { type: 'float', uniform: 'y', label: 'Y', min: -50, max: 50, step: 0.1, default: 0 },
    { type: 'float', uniform: 'z', label: 'Z', min: -50, max: 50, step: 0.1, default: 0 },
  ],
  defaults: { x: 0, y: 0, z: 0 },
}

const rotate: NodeDefinition = {
  type: 'transform/rotate',
  label: 'Rotate',
  category: 'transform',
  inputs: [
    { name: 'mesh', type: 'mesh', label: 'Mesh' },
    { name: 'x', type: 'float', label: 'X' },
    { name: 'y', type: 'float', label: 'Y' },
    { name: 'z', type: 'float', label: 'Z' },
  ],
  outputs: [{ name: 'mesh', type: 'mesh', label: 'Mesh' }],
  properties: [
    { type: 'float', uniform: 'x', label: 'X', min: -360, max: 360, step: 1, default: 0, suffix: '°' },
    { type: 'float', uniform: 'y', label: 'Y', min: -360, max: 360, step: 1, default: 0, suffix: '°' },
    { type: 'float', uniform: 'z', label: 'Z', min: -360, max: 360, step: 1, default: 0, suffix: '°' },
  ],
  defaults: { x: 0, y: 0, z: 0 },
}

const scale: NodeDefinition = {
  type: 'transform/scale',
  label: 'Scale',
  category: 'transform',
  inputs: [
    { name: 'mesh', type: 'mesh', label: 'Mesh' },
    { name: 'x', type: 'float', label: 'X' },
    { name: 'y', type: 'float', label: 'Y' },
    { name: 'z', type: 'float', label: 'Z' },
  ],
  outputs: [{ name: 'mesh', type: 'mesh', label: 'Mesh' }],
  properties: [
    { type: 'float', uniform: 'x', label: 'X', min: 0.01, max: 20, step: 0.1, default: 1 },
    { type: 'float', uniform: 'y', label: 'Y', min: 0.01, max: 20, step: 0.1, default: 1 },
    { type: 'float', uniform: 'z', label: 'Z', min: 0.01, max: 20, step: 0.1, default: 1 },
  ],
  defaults: { x: 1, y: 1, z: 1 },
}

export function registerTransformNodes() {
  registerNode(translate)
  registerNode(rotate)
  registerNode(scale)
}
