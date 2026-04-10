import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const textureNode: NodeDefinition = {
  type: 'texture',
  label: 'Texture',
  category: 'texture',
  inputs: [
    // Noise mode inputs
    { name: 'scale', type: 'float', label: 'Scale', visibleWhen: { uniform: 'mode', equal: 1 } },
    { name: 'detail', type: 'float', label: 'Detail', visibleWhen: { uniform: 'mode', equal: 1 } },
    { name: 'roughness', type: 'float', label: 'Roughness', visibleWhen: { uniform: 'mode', equal: 1 } },
    { name: 'resolution', type: 'float', label: 'Resolution', visibleWhen: { uniform: 'mode', equal: 1 } },
    // Normal mode input
    { name: 'source', type: 'texture', label: '→ Texture', visibleWhen: { uniform: 'mode', equal: 2 } },
  ],
  outputs: [{ name: 'texture', type: 'texture', label: 'Texture →' }],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Mode', default: 0,
      options: [
        { label: 'Image', value: '0' },
        { label: 'Noise', value: '1' },
        { label: 'Normal', value: '2' },
      ],
    },
    // Image mode
    {
      type: 'file', uniform: 'imageFile', label: 'Image',
      accept: '.png,.jpg,.jpeg,.webp,.gif', default: '',
      visibleWhen: { uniform: 'mode', equal: 0 },
    },
    // Noise mode
    {
      type: 'select', uniform: 'noiseType', label: 'Type', default: 0,
      options: [
        { label: 'Noise', value: '0' },
        { label: 'Ridged', value: '1' },
        { label: 'Voronoi', value: '2' },
      ],
      visibleWhen: { uniform: 'mode', equal: 1 },
    },
    { type: 'float', uniform: 'scale', label: 'Scale', min: 0.1, max: 20, step: 0.1, default: 4, linkedPort: 'scale', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'int', uniform: 'detail', label: 'Detail', min: 1, max: 8, step: 1, default: 4, linkedPort: 'detail', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'roughness', label: 'Roughness', min: 0, max: 1, step: 0.01, default: 0.5, linkedPort: 'roughness', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'int', uniform: 'resolution', label: 'Resolution', min: 64, max: 1024, step: 64, default: 256, linkedPort: 'resolution', visibleWhen: { uniform: 'mode', equal: 1 } },
    // Normal mode
    { type: 'float', uniform: 'strength', label: 'Strength', min: 0.1, max: 10, step: 0.1, default: 3, visibleWhen: { uniform: 'mode', equal: 2 } },
  ],
  defaults: { mode: 0, imageFile: '', noiseType: 0, scale: 4, detail: 4, roughness: 0.5, resolution: 256, strength: 3 },
}

export function registerTextureNodes() {
  registerNode(textureNode)
}
