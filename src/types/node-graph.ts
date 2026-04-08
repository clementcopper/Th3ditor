import type { PropertyDef, VisibleWhenCondition } from './properties'

// --- Port Types ---

export type PortType = 'geometry' | 'material' | 'mesh' | 'light' | 'camera' | 'scene' | 'float' | 'vec3' | 'color' | 'texture'

export interface PortDef {
  name: string
  type: PortType
  label?: string
  visibleWhen?: VisibleWhenCondition | VisibleWhenCondition[]
}

// --- Node Definition (static blueprint) ---

export interface NodeDefinition {
  type: string
  label: string
  category: 'geometry' | 'material' | 'object' | 'transform' | 'light' | 'camera' | 'shader' | 'math' | 'color' | 'texture' | 'time' | 'input' | 'effect' | 'scene'
  inputs: PortDef[]
  outputs: PortDef[]
  properties: PropertyDef[]
  defaults: Record<string, unknown>
}

// --- Graph Node (instance in the graph) ---

export interface GraphNode {
  id: string
  type: string // references NodeDefinition.type
  position: { x: number; y: number }
  data: Record<string, unknown> // property values
}

// --- Graph Edge ---

export interface GraphEdge {
  id: string
  source: string      // source node id
  sourceHandle: string // output port name
  target: string      // target node id
  targetHandle: string // input port name
}

// --- Compiled Scene (output of compiler) ---

export interface CompiledTransform {
  position: [number, number, number]
  rotation: [number, number, number]  // radians
  scale: [number, number, number]
}

export interface CompiledMesh {
  id: string
  geometryNodeId: string       // source geometry node
  geometryType: string
  geometryProps: Record<string, unknown>
  materialNodeId: string       // source material node
  materialType: string
  materialProps: Record<string, unknown>
  transformNodeIds: string[]   // node IDs in the transform chain
  transform: CompiledTransform
}

export interface CompiledLight {
  id: string
  lightType: string  // 'ambient' | 'directional' | 'point'
  props: Record<string, unknown>
  targetNodeId?: string  // directional light target mesh node id
}

export interface CompiledCamera {
  nodeId: string
  position: [number, number, number]
  rotation: [number, number, number]  // degrees
  fov: number
}

export interface CompiledScene {
  meshes: CompiledMesh[]
  lights: CompiledLight[]
  camera?: CompiledCamera
}
