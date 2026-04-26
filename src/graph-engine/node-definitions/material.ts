import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const material: NodeDefinition = {
  type: 'material',
  label: 'Material',
  category: 'material',
  inputs: [
    { name: 'shaderGraph', type: 'material', label: 'Shader Graph' },
    { name: 'color', type: 'color', label: 'Color' },
    { name: 'map', type: 'texture', label: 'Map' },
    { name: 'normalMap', type: 'texture', label: 'Normal' },
    { name: 'roughnessMap', type: 'texture', label: 'Rough Map' },
    { name: 'metalnessMap', type: 'texture', label: 'Metal Map' },
    { name: 'aoMap', type: 'texture', label: 'AO Map' },
    { name: 'emissiveMap', type: 'texture', label: 'Emis. Map' },
    { name: 'displacementMap', type: 'texture', label: 'Displace' },
    { name: 'metalness', type: 'float', label: 'Metalness' },
    { name: 'roughness', type: 'float', label: 'Roughness' },
    { name: 'emissiveIntensity', type: 'float', label: 'Emis. Int.' },
    { name: 'opacity', type: 'float', label: 'Opacity' },
  ],
  outputs: [{ name: 'material', type: 'material', label: 'Material' }],
  properties: [
    { type: 'color', uniform: 'color', label: 'Color', default: [0.24, 0.52, 0.88, 1], visibleWhen: { portDisconnected: 'color' } },
    { type: 'float', uniform: 'metalness', label: 'Metalness', min: 0, max: 1, step: 0.01, default: 0.1, linkedPort: 'metalness' },
    { type: 'float', uniform: 'roughness', label: 'Roughness', min: 0, max: 1, step: 0.01, default: 0.5, linkedPort: 'roughness' },
    { type: 'color', uniform: 'emissive', label: 'Emissive', default: [0, 0, 0, 1], group: 'Emissive' },
    { type: 'float', uniform: 'emissiveIntensity', label: 'Intensity', min: 0, max: 10, step: 0.1, default: 1, linkedPort: 'emissiveIntensity', group: 'Emissive' },
    { type: 'float', uniform: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01, default: 1, linkedPort: 'opacity' },
    {
      type: 'select', uniform: 'side', label: 'Side', default: 0, noHeader: true,
      options: [{ label: 'Front', value: '0' }, { label: 'Back', value: '1' }, { label: 'Double', value: '2' }],
    },
    { type: 'bool', uniform: 'wireframe', label: 'Wireframe', default: false },
    { type: 'float', uniform: 'normalScale', label: 'Normal Scale', min: 0, max: 3, step: 0.01, default: 1 },
    { type: 'float', uniform: 'aoMapIntensity', label: 'AO Intensity', min: 0, max: 2, step: 0.01, default: 1, visibleWhen: { portConnected: 'aoMap' } },
    { type: 'float', uniform: 'displacementScale', label: 'Displace Scale', min: -2, max: 2, step: 0.01, default: 0.3, visibleWhen: { portConnected: 'displacementMap' } },
    { type: 'float', uniform: 'displacementBias', label: 'Displace Bias', min: -1, max: 1, step: 0.01, default: 0, visibleWhen: { portConnected: 'displacementMap' } },
  ],
  defaults: {
    color: [0.24, 0.52, 0.88, 1],
    metalness: 0.1,
    roughness: 0.5,
    emissive: [0, 0, 0, 1],
    emissiveIntensity: 1,
    opacity: 1,
    side: 0,
    wireframe: false,
    normalScale: 1,
    aoMapIntensity: 1,
    displacementScale: 0.3,
    displacementBias: 0,
  },
}

export function registerMaterialNodes() {
  registerNode(material)
}
