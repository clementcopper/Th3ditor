import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const mesh: NodeDefinition = {
  type: 'object/mesh',
  label: 'Mesh',
  category: 'object',
  inputs: [
    { name: 'geometry', type: 'geometry', label: 'Geometry' },
    { name: 'material', type: 'material', label: 'Material' },
  ],
  outputs: [{ name: 'mesh', type: 'mesh', label: 'Mesh' }],
  properties: [
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -50, max: 50, step: 0.1, default: 0 },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -50, max: 50, step: 0.1, default: 0 },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -50, max: 50, step: 0.1, default: 0 },
  ],
  defaults: { positionX: 0, positionY: 0, positionZ: 0 },
}

const nullObject: NodeDefinition = {
  type: 'object/null',
  label: 'Null',
  category: 'object',
  inputs: [],
  outputs: [{ name: 'mesh', type: 'mesh', label: 'Mesh' }],
  properties: [],
  defaults: {},
}

const gltfImport: NodeDefinition = {
  type: 'object/gltf',
  label: 'glTF Import',
  category: 'object',
  inputs: [],
  outputs: [{ name: 'mesh', type: 'mesh', label: 'Mesh' }],
  properties: [
    { type: 'file', uniform: 'glbFile', label: 'Model File', accept: '.gltf,.glb', default: '' },
    {
      type: 'select', uniform: 'centerMode', label: 'Origin', default: 0,
      options: [
        { label: 'Off', value: '0' },
        { label: 'BBox Center', value: '1' },
        { label: 'BBox Bottom', value: '2' },
        { label: 'Manual', value: '3' },
      ],
    },
    { type: 'float', uniform: 'originX', label: 'Origin X', min: -50, max: 50, step: 0.01, default: 0, visibleWhen: { uniform: 'centerMode', equal: 3 } },
    { type: 'float', uniform: 'originY', label: 'Origin Y', min: -50, max: 50, step: 0.01, default: 0, visibleWhen: { uniform: 'centerMode', equal: 3 } },
    { type: 'float', uniform: 'originZ', label: 'Origin Z', min: -50, max: 50, step: 0.01, default: 0, visibleWhen: { uniform: 'centerMode', equal: 3 } },
  ],
  defaults: { glbFile: '', centerMode: 0, originX: 0, originY: 0, originZ: 0 },
}

export function registerObjectNodes() {
  registerNode(mesh)
  registerNode(nullObject)
  registerNode(gltfImport)
}
