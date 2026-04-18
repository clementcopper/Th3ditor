import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const geometry: NodeDefinition = {
  type: 'geometry',
  label: 'Geometry',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'geometry', type: 'geometry', label: 'Geometry' }],
  properties: [
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0,
      options: [
        { label: 'Box', value: '0' },
        { label: 'Sphere', value: '1' },
        { label: 'Plane', value: '2' },
        { label: 'Torus', value: '3' },
        { label: 'Cylinder', value: '4' },
        { label: 'Capsule', value: '5' },
        { label: 'Icosphere', value: '6' },
      ],
    },
    // Box (0)
    { type: 'float', uniform: 'width', label: 'Width', min: 0.01, max: 20, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'float', uniform: 'height', label: 'Height', min: 0.01, max: 20, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'float', uniform: 'depth', label: 'Depth', min: 0.01, max: 20, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'int', uniform: 'boxSegments', label: 'Segments', min: 1, max: 256, step: 1, default: 4, visibleWhen: { uniform: 'mode', equal: 0 } },
    // Sphere (1) — Quad Sphere (Box inflated to sphere, mergeVertices for seamless edges)
    { type: 'float', uniform: 'radius', label: 'Radius', min: 0.01, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'int', uniform: 'sphereSegments', label: 'Segments', min: 1, max: 256, step: 1, default: 32, visibleWhen: { uniform: 'mode', equal: 1 } },
    // Plane (2)
    { type: 'float', uniform: 'planeWidth', label: 'Width', min: 0.01, max: 50, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'planeHeight', label: 'Height', min: 0.01, max: 50, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'int', uniform: 'planeSegments', label: 'Segments', min: 1, max: 256, step: 1, default: 4, visibleWhen: { uniform: 'mode', equal: 2 } },
    // Torus (3)
    { type: 'float', uniform: 'torusRadius', label: 'Radius', min: 0.01, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 3 } },
    { type: 'float', uniform: 'tube', label: 'Tube', min: 0.01, max: 5, step: 0.05, hardMax: 1000, default: 0.2, visibleWhen: { uniform: 'mode', equal: 3 } },
    { type: 'int', uniform: 'torusSegments', label: 'Segments', min: 3, max: 256, step: 1, default: 32, visibleWhen: { uniform: 'mode', equal: 3 } },
    // Cylinder (4)
    { type: 'float', uniform: 'radiusTop', label: 'Radius Top', min: 0, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 4 } },
    { type: 'float', uniform: 'radiusBottom', label: 'Radius Bottom', min: 0, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 4 } },
    { type: 'float', uniform: 'cylHeight', label: 'Height', min: 0.01, max: 20, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 4 } },
    { type: 'int', uniform: 'cylSegments', label: 'Segments', min: 3, max: 256, step: 1, default: 32, visibleWhen: { uniform: 'mode', equal: 4 } },
    // Capsule (5)
    { type: 'float', uniform: 'capsuleRadius', label: 'Radius', min: 0.01, max: 10, step: 0.05, hardMax: 1000, default: 0.3, visibleWhen: { uniform: 'mode', equal: 5 } },
    { type: 'float', uniform: 'capsuleLength', label: 'Length', min: 0.01, max: 20, step: 0.1, hardMax: 1000, default: 0.8, visibleWhen: { uniform: 'mode', equal: 5 } },
    { type: 'int', uniform: 'capsuleSegments', label: 'Segments', min: 3, max: 256, step: 1, default: 24, visibleWhen: { uniform: 'mode', equal: 5 } },
    // Icosphere (6)
    { type: 'float', uniform: 'icoRadius', label: 'Radius', min: 0.01, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 6 } },
    { type: 'int', uniform: 'icoSegments', label: 'Segments', min: 0, max: 256, step: 1, default: 20, visibleWhen: { uniform: 'mode', equal: 6 } },
  ],
  defaults: {
    mode: 0,
    width: 1, height: 1, depth: 1, boxSegments: 4,
    radius: 0.5, sphereSegments: 32,
    planeWidth: 1, planeHeight: 1, planeSegments: 4,
    torusRadius: 0.5, tube: 0.2, torusSegments: 32,
    radiusTop: 0.5, radiusBottom: 0.5, cylHeight: 1, cylSegments: 32,
    capsuleRadius: 0.3, capsuleLength: 0.8, capsuleSegments: 24,
    icoRadius: 0.5, icoSegments: 20,
  },
}

export function registerGeometryNodes() {
  registerNode(geometry)
}
