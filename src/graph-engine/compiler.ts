import type { GraphNode, GraphEdge, CompiledScene, CompiledMesh, CompiledLight, CompiledTransform } from '../types/node-graph'
import { getNodeDef } from './node-registry'

/**
 * Compiles the node graph into a CompiledScene.
 *
 * - Finds mesh nodes, resolves geometry + material inputs
 * - Collects transform chain between mesh and scene output
 * - Finds light nodes
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
  // Only include meshes that reach a Scene Output node via their mesh-port chain
  const meshNodes = nodes.filter((n) => n.type === 'object/mesh')
  const meshes: CompiledMesh[] = []

  for (const meshNode of meshNodes) {
    const geoNode = getInputNode(meshNode.id, 'geometry')
    const matNode = getInputNode(meshNode.id, 'material')
    if (!geoNode || !matNode) continue

    const geoDef = getNodeDef(geoNode.type)
    const matDef = getNodeDef(matNode.type)
    if (!geoDef || !matDef) continue

    // Walk the mesh-port chain and check if it reaches scene/output
    const { transform, nodeIds: transformNodeIds, reachesOutput } = resolveTransformChain(meshNode.id, nodes, edges)
    if (!reachesOutput) continue

    const geoProps = getProps(geoNode)
    const matProps = getProps(matNode)

    meshes.push({
      id: meshNode.id,
      geometryNodeId: geoNode.id,
      geometryType: geoNode.type,
      geometryProps: geoProps,
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

  const lightNodes = nodes.filter((n) => n.type.startsWith('light/') && connectedLightIds.has(n.id))
  const lights: CompiledLight[] = lightNodes.map((n) => ({
    id: n.id,
    lightType: n.type,
    props: getProps(n),
  }))

  return { meshes, lights }
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

    // Reached Scene Output — chain is complete
    if (targetNode.type === 'scene/output') {
      reachesOutput = true
      break
    }

    const props = { ...(getNodeDef(targetNode.type)?.defaults ?? {}), ...targetNode.data }

    if (targetNode.type === 'transform/translate') {
      pos[0] += (props.x as number) ?? 0
      pos[1] += (props.y as number) ?? 0
      pos[2] += (props.z as number) ?? 0
      nodeIds.push(targetNode.id)
    } else if (targetNode.type === 'transform/rotate') {
      rot[0] += ((props.x as number) ?? 0) * DEG2RAD
      rot[1] += ((props.y as number) ?? 0) * DEG2RAD
      rot[2] += ((props.z as number) ?? 0) * DEG2RAD
      nodeIds.push(targetNode.id)
    } else if (targetNode.type === 'transform/scale') {
      scl[0] *= (props.x as number) ?? 1
      scl[1] *= (props.y as number) ?? 1
      scl[2] *= (props.z as number) ?? 1
      nodeIds.push(targetNode.id)
    } else {
      break
    }

    currentId = targetNode.id
  }

  return { transform: { position: pos, rotation: rot, scale: scl }, nodeIds, reachesOutput }
}
