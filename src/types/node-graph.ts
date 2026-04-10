import type { PropertyDef, VisibleWhenCondition } from './properties'

// --- Port Types ---

export type PortType = 'geometry' | 'material' | 'mesh' | 'light' | 'camera' | 'scene' | 'float' | 'vec3' | 'color' | 'texture' | 'path'

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
  category: 'geometry' | 'material' | 'object' | 'transform' | 'light' | 'camera' | 'shader' | 'math' | 'color' | 'texture' | 'time' | 'input' | 'effect' | 'scene' | 'path'
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
  pathNodeId?: string
  pathProgress?: number
}

export interface CompiledCamera {
  nodeId: string
  position: [number, number, number]
  rotation: [number, number, number]  // degrees
  fov: number
  mode: number  // 0 = Free, 1 = Target, 2 = Path
  targetNodeId?: string
  pathNodeId?: string
  pathProgress?: number
  pathLookAhead?: boolean
}

export interface CompiledPath {
  id: string
  pathType: 'line' | 'circle' | 'arc'
  pathProps: Record<string, unknown>
  position: [number, number, number]
  transformNodeIds: string[]  // Transform nodes downstream from this path (in order)
}

export interface CompiledGLTF {
  id: string
  fileDataUrl?: string
  fileName?: string
  /** Associated files for multi-file .gltf (bin, textures) — mapped by filename */
  extraFiles?: { name: string; dataUrl: string }[]
  /** 0=Off, 1=BBox-Mitte, 2=BBox-Boden, 3=Manuell */
  centerMode: number
  originX: number
  originY: number
  originZ: number
  transform: CompiledTransform
  transformNodeIds: string[]
}

export interface CompiledScene {
  meshes: CompiledMesh[]
  gltfObjects: CompiledGLTF[]
  paths: CompiledPath[]
  lights: CompiledLight[]
  camera?: CompiledCamera
  smoothShading: boolean
  bgColor: string
  envMapDataUrl?: string
  envIntensity: number
  showEnvBackground: boolean
}
