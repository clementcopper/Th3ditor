import type { NodeDefinition } from '../../types/node-graph'
import { registerNode } from '../node-registry'

// Available uniforms (auto-injected, no need to declare):
// uTime, uMouse, uResolution — built-in
// uFloat1..uFloat4          — connect Float ports in graph
// uTex1, uTex2              — connect Tex ports in graph

const DEFAULT_VERT = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const DEFAULT_FRAG = `varying vec2 vUv;
void main() {
  gl_FragColor = vec4(vUv, 0.5, 1.0);
}`

const glslShader: NodeDefinition = {
  type: 'shader/glsl',
  label: 'GLSL Shader',
  category: 'shader',
  inputs: [
    { name: 'u1', type: 'float', label: 'Float 1' },
    { name: 'u2', type: 'float', label: 'Float 2' },
    { name: 'u3', type: 'float', label: 'Float 3' },
    { name: 'u4', type: 'float', label: 'Float 4' },
    { name: 't1', type: 'texture', label: 'Tex 1' },
    { name: 't2', type: 'texture', label: 'Tex 2' },
  ],
  outputs: [{ name: 'material', type: 'material', label: 'Material' }],
  properties: [
    { type: 'textarea', uniform: 'vertCode', label: 'Vertex', default: DEFAULT_VERT, group: 'Vertex Shader' },
    { type: 'textarea', uniform: 'fragCode', label: 'Fragment', default: DEFAULT_FRAG, group: 'Fragment Shader' },
  ],
  defaults: {
    vertCode: DEFAULT_VERT,
    fragCode: DEFAULT_FRAG,
    u1: 0,
    u2: 0,
    u3: 0,
    u4: 0,
  },
}

export function registerShaderNodes() {
  registerNode(glslShader)
}
