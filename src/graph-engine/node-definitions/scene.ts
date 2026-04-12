import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const sceneOutput: NodeDefinition = {
  type: 'scene/output',
  label: 'Scene Output',
  category: 'scene',
  inputs: [
    { name: 'mesh', type: 'mesh', label: 'Mesh' },
    { name: 'light', type: 'light', label: 'Light' },
    { name: 'camera', type: 'camera', label: 'Camera' },
    { name: 'shader', type: 'material', label: 'BG Shader' },
  ],
  outputs: [],
  properties: [
    { type: 'bool',  uniform: 'smoothShading',      label: 'Smooth Shading',    default: true },
    { type: 'color', uniform: 'bgColor',             label: 'Background',        default: [0.098, 0.086, 0.078, 1] },
    { type: 'file',  uniform: 'envMap',              label: 'HDR Environment',   accept: '.hdr', default: '' },
    { type: 'float', uniform: 'envIntensity',        label: 'Env Intensity',     min: 0, max: 5, step: 0.05, default: 1 },
    { type: 'bool',  uniform: 'showEnvBackground',   label: 'Show as Background', default: false },
  ],
  defaults: { smoothShading: true, bgColor: [0.098, 0.086, 0.078, 1], envMap: '', envIntensity: 1, showEnvBackground: false },
}

export function registerSceneNodes() {
  registerNode(sceneOutput)
}
