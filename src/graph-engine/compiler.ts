import type { GraphNode, GraphEdge, CompiledScene, CompiledMesh, CompiledLight, CompiledTransform } from '../types/node-graph'
import { getNodeDef } from './node-registry'

/** Maps geometry mode number to a subtype string for the renderer */
const GEO_SUBTYPES = ['box', 'sphere', 'plane', 'torus', 'cylinder'] as const

/** Maps light mode number to a subtype string */
const LIGHT_SUBTYPES = ['ambient', 'directional', 'point'] as const

/**
 * Compiles the node graph into a CompiledScene.
 */
export function compileGraph(nodes: GraphNode[], edges: GraphEdge[]): CompiledScene {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  function getInputNode(nodeId: string, handleName: string): GraphNode | undefined {
    const edge = edges.find((e) => e.target === nodeId && e.targetHandle === handleName)
    if (!edge) return undefined
    return nodeMap.get(edge.source)
  }

  function getProps(node: GraphNode): Record<string, unknown> {
    const def = getNodeDef(node.type)
    return { ...(def?.defaults ?? {}), ...node.data }
  }

  // --- Meshes ---
  const meshNodes = nodes.filter((n) => n.type === 'object/mesh')
  const meshes: CompiledMesh[] = []

  for (const meshNode of meshNodes) {
    const geoNode = getInputNode(meshNode.id, 'geometry')
    const matNode = getInputNode(meshNode.id, 'material')
    if (!geoNode || !matNode) continue

    const geoDef = getNodeDef(geoNode.type)
    const matDef = getNodeDef(matNode.type)
    if (!geoDef || !matDef) continue

    const { transform, nodeIds: transformNodeIds, reachesOutput } = resolveTransformChain(meshNode.id, nodes, edges)
    if (!reachesOutput) continue

    const geoProps = getProps(geoNode)
    const matProps = getProps(matNode)

    // Resolve geometry subtype from mode
    const geoMode = (geoProps.mode as number) ?? 0
    const geometryType = GEO_SUBTYPES[geoMode] ?? 'box'

    // Normalize geometry props for the renderer
    const normalizedGeoProps = normalizeGeoProps(geometryType, geoProps)

    meshes.push({
      id: meshNode.id,
      geometryNodeId: geoNode.id,
      geometryType,
      geometryProps: normalizedGeoProps,
      materialNodeId: matNode.id,
      materialType: matNode.type,
      materialProps: matProps,
      transformNodeIds,
      transform,
    })
  }

  // --- Lights (only those connected to Scene Output) ---
  const sceneOutputNodes = nodes.filter((n) => n.type === 'scene/output')
  const connectedLightIds = new Set<string>()
  for (const soNode of sceneOutputNodes) {
    for (const edge of edges) {
      if (edge.target === soNode.id && edge.targetHandle === 'light') {
        connectedLightIds.add(edge.source)
      }
    }
  }

  const lightNodes = nodes.filter((n) => n.type === 'light' && connectedLightIds.has(n.id))
  const lights: CompiledLight[] = lightNodes.map((n) => {
    const props = getProps(n)
    const mode = (props.mode as number) ?? 0
    const lightType = LIGHT_SUBTYPES[mode] ?? 'directional'

    return {
      id: n.id,
      lightType,
      props: normalizeLightProps(lightType, props),
    }
  })

  return { meshes, lights }
}

/** Normalize geometry props to a renderer-friendly format */
function normalizeGeoProps(type: string, props: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'box':
      return { width: props.width, height: props.height, depth: props.depth }
    case 'sphere':
      return { radius: props.radius, widthSegments: props.widthSegments, heightSegments: props.heightSegments }
    case 'plane':
      return { width: props.planeWidth, height: props.planeHeight }
    case 'torus':
      return { radius: props.torusRadius, tube: props.tube }
    case 'cylinder':
      return { radiusTop: props.radiusTop, radiusBottom: props.radiusBottom, height: props.cylHeight, radialSegments: props.radialSegments }
    default:
      return props
  }
}

/** Normalize light props to a renderer-friendly format */
function normalizeLightProps(type: string, props: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'ambient':
      return { color: props.color, intensity: props.intensity }
    case 'directional':
      return { color: props.color, intensity: props.dirIntensity, positionX: props.positionX, positionY: props.positionY, positionZ: props.positionZ }
    case 'point':
      return { color: props.color, intensity: props.ptIntensity, distance: props.distance, positionX: props.ptPositionX, positionY: props.ptPositionY, positionZ: props.ptPositionZ }
    default:
      return props
  }
}

/**
 * Walk downstream from a mesh node through transform nodes
 * and accumulate position/rotation/scale.
 */
function resolveTransformChain(
  meshNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): { transform: CompiledTransform; nodeIds: string[]; reachesOutput: boolean } {
  const pos: [number, number, number] = [0, 0, 0]
  const rot: [number, number, number] = [0, 0, 0]
  const scl: [number, number, number] = [1, 1, 1]
  const nodeIds: string[] = []
  let reachesOutput = false

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const DEG2RAD = Math.PI / 180

  let currentId = meshNodeId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)

    const outEdge = edges.find((e) => e.source === currentId && e.sourceHandle === 'mesh')
    if (!outEdge) break

    const targetNode = nodeMap.get(outEdge.target)
    if (!targetNode) break

    if (targetNode.type === 'scene/output') {
      reachesOutput = true
      break
    }

    if (targetNode.type === 'transform') {
      const props = { ...(getNodeDef(targetNode.type)?.defaults ?? {}), ...targetNode.data }
      const mode = (props.mode as number) ?? 0

      if (mode === 0) {
        // Translate
        pos[0] += (props.tx as number) ?? 0
        pos[1] += (props.ty as number) ?? 0
        pos[2] += (props.tz as number) ?? 0
      } else if (mode === 1) {
        // Rotate
        rot[0] += ((props.rx as number) ?? 0) * DEG2RAD
        rot[1] += ((props.ry as number) ?? 0) * DEG2RAD
        rot[2] += ((props.rz as number) ?? 0) * DEG2RAD
      } else if (mode === 2) {
        // Scale
        scl[0] *= (props.sx as number) ?? 1
        scl[1] *= (props.sy as number) ?? 1
        scl[2] *= (props.sz as number) ?? 1
      }

      nodeIds.push(targetNode.id)
      currentId = targetNode.id
    } else {
      break
    }
  }

  return { transform: { position: pos, rotation: rot, scale: scl }, nodeIds, reachesOutput }
}
