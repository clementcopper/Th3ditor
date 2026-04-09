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
    { type: 'int', uniform: 'boxWidthSegs', label: 'W Segments', min: 1, max: 32, step: 1, default: 1, visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'int', uniform: 'boxHeightSegs', label: 'H Segments', min: 1, max: 32, step: 1, default: 1, visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'int', uniform: 'boxDepthSegs', label: 'D Segments', min: 1, max: 32, step: 1, default: 1, visibleWhen: { uniform: 'mode', equal: 0 } },
    // Sphere (1)
    { type: 'float', uniform: 'radius', label: 'Radius', min: 0.01, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'int', uniform: 'widthSegments', label: 'W Segments', min: 3, max: 128, step: 1, default: 32, visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'int', uniform: 'heightSegments', label: 'H Segments', min: 2, max: 64, step: 1, default: 16, visibleWhen: { uniform: 'mode', equal: 1 } },
    // Plane (2)
    { type: 'float', uniform: 'planeWidth', label: 'Width', min: 0.01, max: 50, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'planeHeight', label: 'Height', min: 0.01, max: 50, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'int', uniform: 'planeWidthSegs', label: 'W Segments', min: 1, max: 256, step: 1, default: 1, visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'int', uniform: 'planeHeightSegs', label: 'H Segments', min: 1, max: 256, step: 1, default: 1, visibleWhen: { uniform: 'mode', equal: 2 } },
    // Torus (3)
    { type: 'float', uniform: 'torusRadius', label: 'Radius', min: 0.01, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 3 } },
    { type: 'float', uniform: 'tube', label: 'Tube', min: 0.01, max: 5, step: 0.05, hardMax: 1000, default: 0.2, visibleWhen: { uniform: 'mode', equal: 3 } },
    { type: 'int', uniform: 'torusRadialSegs', label: 'Radial Segments', min: 3, max: 64, step: 1, default: 16, visibleWhen: { uniform: 'mode', equal: 3 } },
    { type: 'int', uniform: 'torusTubularSegs', label: 'Tubular Segments', min: 3, max: 256, step: 1, default: 48, visibleWhen: { uniform: 'mode', equal: 3 } },
    // Cylinder (4)
    { type: 'float', uniform: 'radiusTop', label: 'Radius Top', min: 0, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 4 } },
    { type: 'float', uniform: 'radiusBottom', label: 'Radius Bottom', min: 0, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 4 } },
    { type: 'float', uniform: 'cylHeight', label: 'Height', min: 0.01, max: 20, step: 0.1, hardMax: 1000, default: 1, visibleWhen: { uniform: 'mode', equal: 4 } },
    { type: 'int', uniform: 'radialSegments', label: 'Segments', min: 3, max: 128, step: 1, default: 32, visibleWhen: { uniform: 'mode', equal: 4 } },
    // Capsule (5)
    { type: 'float', uniform: 'capsuleRadius', label: 'Radius', min: 0.01, max: 10, step: 0.05, hardMax: 1000, default: 0.3, visibleWhen: { uniform: 'mode', equal: 5 } },
    { type: 'float', uniform: 'capsuleLength', label: 'Length', min: 0.01, max: 20, step: 0.1, hardMax: 1000, default: 0.8, visibleWhen: { uniform: 'mode', equal: 5 } },
    { type: 'int', uniform: 'capSegments', label: 'Cap Segments', min: 2, max: 32, step: 1, default: 8, visibleWhen: { uniform: 'mode', equal: 5 } },
    { type: 'int', uniform: 'capsuleRadialSegments', label: 'Radial Segments', min: 3, max: 64, step: 1, default: 16, visibleWhen: { uniform: 'mode', equal: 5 } },
    // Icosphere (6)
    { type: 'float', uniform: 'icoRadius', label: 'Radius', min: 0.01, max: 10, step: 0.1, hardMax: 1000, default: 0.5, visibleWhen: { uniform: 'mode', equal: 6 } },
    { type: 'int', uniform: 'icoDetail', label: 'Detail', min: 0, max: 6, step: 1, default: 2, visibleWhen: { uniform: 'mode', equal: 6 } },
  ],
  defaults: {
    mode: 0,
    width: 1, height: 1, depth: 1, boxWidthSegs: 1, boxHeightSegs: 1, boxDepthSegs: 1,
    radius: 0.5, widthSegments: 32, heightSegments: 16,
    planeWidth: 1, planeHeight: 1, planeWidthSegs: 1, planeHeightSegs: 1,
    torusRadius: 0.5, tube: 0.2, torusRadialSegs: 16, torusTubularSegs: 48,
    radiusTop: 0.5, radiusBottom: 0.5, cylHeight: 1, radialSegments: 32,
    capsuleRadius: 0.3, capsuleLength: 0.8, capSegments: 8, capsuleRadialSegments: 16,
    icoRadius: 0.5, icoDetail: 2,
  },
}

export function registerGeometryNodes() {
  registerNode(geometry)
}
