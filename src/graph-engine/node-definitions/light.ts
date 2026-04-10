import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

const light: NodeDefinition = {
  type: 'light',
  label: 'Light',
  category: 'light',
  inputs: [
    { name: 'intensity',    type: 'float', label: 'Intensity' },
    { name: 'positionX',   type: 'float', label: 'Position X',  visibleWhen: { uniform: 'mode', equal: [1, 2, 3] } },
    { name: 'positionY',   type: 'float', label: 'Position Y',  visibleWhen: { uniform: 'mode', equal: [1, 2, 3] } },
    { name: 'positionZ',   type: 'float', label: 'Position Z',  visibleWhen: { uniform: 'mode', equal: [1, 2, 3] } },
    { name: 'distance',    type: 'float', label: 'Distance',    visibleWhen: { uniform: 'mode', equal: 2 } },
    { name: 'areaWidth',  type: 'float', label: 'Width',       visibleWhen: { uniform: 'mode', equal: 3 } },
    { name: 'areaHeight', type: 'float', label: 'Height',      visibleWhen: { uniform: 'mode', equal: 3 } },
    { name: 'areaRotX',   type: 'float', label: 'Rotation X',  visibleWhen: [{ uniform: 'mode', equal: 3 }, { uniformFalsy: 'targetNodeId' }] },
    { name: 'areaRotY',   type: 'float', label: 'Rotation Y',  visibleWhen: [{ uniform: 'mode', equal: 3 }, { uniformFalsy: 'targetNodeId' }] },
    { name: 'areaRotZ',   type: 'float', label: 'Rotation Z',  visibleWhen: [{ uniform: 'mode', equal: 3 }, { uniformFalsy: 'targetNodeId' }] },
    { name: 'path',        type: 'path',  label: 'Path',        visibleWhen: { uniform: 'mode', equal: [1, 2, 3] } },
    { name: 'pathProgress', type: 'float', label: 'Progress',   visibleWhen: { uniform: 'mode', equal: [1, 2, 3] } },
  ],
  outputs: [{ name: 'light', type: 'light', label: 'Light' }],
  properties: [
    // Type
    {
      type: 'select', uniform: 'mode', label: 'Type', default: 0,
      options: [
        { label: 'Ambient', value: '0' },
        { label: 'Directional', value: '1' },
        { label: 'Point', value: '2' },
        { label: 'Area', value: '3' },
      ],
    },
    { type: 'noderef', uniform: 'targetNodeId', label: 'Target', categories: ['object'], default: '', visibleWhen: { uniform: 'mode', equal: [1, 3] } },
    // Color
    { type: 'color', uniform: 'color', label: 'Color', default: [1, 1, 1, 1] },
    // Intensity (per mode)
    { type: 'float', uniform: 'intensity',     label: 'Intensity', min: 0, max: 5,  step: 0.05, hardMax: 100,  default: 0.5, linkedPort: 'intensity', visibleWhen: { uniform: 'mode', equal: 0 } },
    { type: 'float', uniform: 'dirIntensity',  label: 'Intensity', min: 0, max: 10, step: 0.1,  hardMax: 100,  default: 1,   linkedPort: 'intensity', visibleWhen: { uniform: 'mode', equal: 1 } },
    { type: 'float', uniform: 'ptIntensity',   label: 'Intensity', min: 0, max: 10, step: 0.1,  hardMax: 100,  default: 1,   linkedPort: 'intensity', visibleWhen: { uniform: 'mode', equal: 2 } },
    { type: 'float', uniform: 'areaIntensity', label: 'Intensity', min: 0, max: 50, step: 0.5,  hardMax: 1000, default: 5,                            visibleWhen: { uniform: 'mode', equal: 3 } },
    // Width / Height (area only)
    { type: 'float', uniform: 'areaWidth',  label: 'Width',  min: 0.1, max: 20, step: 0.1, hardMax: 1000, default: 2, linkedPort: 'areaWidth',  visibleWhen: { uniform: 'mode', equal: 3 } },
    { type: 'float', uniform: 'areaHeight', label: 'Height', min: 0.1, max: 20, step: 0.1, hardMax: 1000, default: 1, linkedPort: 'areaHeight', visibleWhen: { uniform: 'mode', equal: 3 } },
    // Distance (point only)
    { type: 'float', uniform: 'distance', label: 'Distance', min: 0, max: 100, step: 1, hardMax: 10000, default: 0, linkedPort: 'distance', visibleWhen: { uniform: 'mode', equal: 2 } },
    // Position
    { type: 'float', uniform: 'positionX', label: 'Position X', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, linkedPort: 'positionX', linkedPath: true, visibleWhen: { uniform: 'mode', equal: [1, 2, 3] } },
    { type: 'float', uniform: 'positionY', label: 'Position Y', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, linkedPort: 'positionY', linkedPath: true, visibleWhen: { uniform: 'mode', equal: [1, 2, 3] } },
    { type: 'float', uniform: 'positionZ', label: 'Position Z', min: -10, max: 10, step: 0.5, hardMin: -10000, hardMax: 10000, default: 5, linkedPort: 'positionZ', linkedPath: true, visibleWhen: { uniform: 'mode', equal: [1, 2, 3] } },
    // Rotation (directional path live-display)
    { type: 'float', uniform: 'rotationX', label: 'Rotation X', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPath: true, visibleWhen: [{ portConnected: 'path' }, { uniform: 'mode', equal: 1 }, { uniformFalsy: 'targetNodeId' }] },
    { type: 'float', uniform: 'rotationY', label: 'Rotation Y', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPath: true, visibleWhen: [{ portConnected: 'path' }, { uniform: 'mode', equal: 1 }, { uniformFalsy: 'targetNodeId' }] },
    { type: 'float', uniform: 'rotationZ', label: 'Rotation Z', min: -180, max: 180, step: 1, default: 0, suffix: '°', linkedPath: true, visibleWhen: [{ portConnected: 'path' }, { uniform: 'mode', equal: 1 }, { uniformFalsy: 'targetNodeId' }] },
    // Rotation (area — hidden when target is set)
    { type: 'float', uniform: 'areaRotX', label: 'Rotation X', min: -180, max: 180, step: 1, default: -90, suffix: '°', linkedPort: 'areaRotX', visibleWhen: [{ uniform: 'mode', equal: 3 }, { uniformFalsy: 'targetNodeId' }] },
    { type: 'float', uniform: 'areaRotY', label: 'Rotation Y', min: -180, max: 180, step: 1, default: 0,  suffix: '°', linkedPort: 'areaRotY', visibleWhen: [{ uniform: 'mode', equal: 3 }, { uniformFalsy: 'targetNodeId' }] },
    { type: 'float', uniform: 'areaRotZ', label: 'Rotation Z', min: -180, max: 180, step: 1, default: 0,  suffix: '°', linkedPort: 'areaRotZ', visibleWhen: [{ uniform: 'mode', equal: 3 }, { uniformFalsy: 'targetNodeId' }] },
    // Progress
    { type: 'float', uniform: 'pathProgress', label: 'Progress', min: 0, max: 1, step: 0.001, default: 0, linkedPort: 'pathProgress', visibleWhen: { uniform: 'mode', notEqual: 0 } },
  ],
  defaults: {
    mode: 1,
    color: [1, 1, 1, 1],
    intensity: 0.5,
    dirIntensity: 1, positionX: 5, positionY: 5, positionZ: 5,
    targetNodeId: '',
    ptIntensity: 1, distance: 0,
    areaIntensity: 5, areaWidth: 2, areaHeight: 1, areaRotX: -90, areaRotY: 0, areaRotZ: 0,
    pathProgress: 0,
  },
}

export function registerLightNodes() {
  registerNode(light)
}
