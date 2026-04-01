import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const box: NodeDefinition = {
  type: 'geometry/box',
  label: 'Box',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'geometry', type: 'geometry', label: 'Geometry' }],
  properties: [
    { type: 'float', uniform: 'width', label: 'Width', min: 0.01, max: 20, step: 0.1, default: 1 },
    { type: 'float', uniform: 'height', label: 'Height', min: 0.01, max: 20, step: 0.1, default: 1 },
    { type: 'float', uniform: 'depth', label: 'Depth', min: 0.01, max: 20, step: 0.1, default: 1 },
  ],
  defaults: { width: 1, height: 1, depth: 1 },
}

const sphere: NodeDefinition = {
  type: 'geometry/sphere',
  label: 'Sphere',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'geometry', type: 'geometry', label: 'Geometry' }],
  properties: [
    { type: 'float', uniform: 'radius', label: 'Radius', min: 0.01, max: 10, step: 0.1, default: 0.5 },
    { type: 'int', uniform: 'widthSegments', label: 'W Segments', min: 3, max: 128, step: 1, default: 32 },
    { type: 'int', uniform: 'heightSegments', label: 'H Segments', min: 2, max: 64, step: 1, default: 16 },
  ],
  defaults: { radius: 0.5, widthSegments: 32, heightSegments: 16 },
}

const plane: NodeDefinition = {
  type: 'geometry/plane',
  label: 'Plane',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'geometry', type: 'geometry', label: 'Geometry' }],
  properties: [
    { type: 'float', uniform: 'width', label: 'Width', min: 0.01, max: 50, step: 0.1, default: 1 },
    { type: 'float', uniform: 'height', label: 'Height', min: 0.01, max: 50, step: 0.1, default: 1 },
  ],
  defaults: { width: 1, height: 1 },
}

const torus: NodeDefinition = {
  type: 'geometry/torus',
  label: 'Torus',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'geometry', type: 'geometry', label: 'Geometry' }],
  properties: [
    { type: 'float', uniform: 'radius', label: 'Radius', min: 0.01, max: 10, step: 0.1, default: 0.5 },
    { type: 'float', uniform: 'tube', label: 'Tube', min: 0.01, max: 5, step: 0.05, default: 0.2 },
  ],
  defaults: { radius: 0.5, tube: 0.2 },
}

const cylinder: NodeDefinition = {
  type: 'geometry/cylinder',
  label: 'Cylinder',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'geometry', type: 'geometry', label: 'Geometry' }],
  properties: [
    { type: 'float', uniform: 'radiusTop', label: 'Radius Top', min: 0, max: 10, step: 0.1, default: 0.5 },
    { type: 'float', uniform: 'radiusBottom', label: 'Radius Bottom', min: 0, max: 10, step: 0.1, default: 0.5 },
    { type: 'float', uniform: 'height', label: 'Height', min: 0.01, max: 20, step: 0.1, default: 1 },
    { type: 'int', uniform: 'radialSegments', label: 'Segments', min: 3, max: 128, step: 1, default: 32 },
  ],
  defaults: { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 32 },
}

export function registerGeometryNodes() {
  registerNode(box)
  registerNode(sphere)
  registerNode(plane)
  registerNode(torus)
  registerNode(cylinder)
}
