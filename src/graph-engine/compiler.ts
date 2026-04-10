import type { GraphNode, GraphEdge, CompiledScene, CompiledMesh, CompiledGLTF, CompiledLight, CompiledCamera, CompiledPath, CompiledTransform } from '../types/node-graph'
import { getNodeDef } from './node-registry'

/** Maps geometry mode number to a subtype string for the renderer */
const GEO_SUBTYPES = ['box', 'sphere', 'plane', 'torus', 'cylinder', 'capsule', 'icosphere'] as const

/** Maps light mode number to a subtype string */
const LIGHT_SUBTYPES = ['ambient', 'directional', 'point'] as const

/** Maps path mode number to a subtype string */
const PATH_SUBTYPES = ['line', 'circle', 'arc'] as const

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

  // --- Null Objects (compiled into meshes[] with geometryType 'null') ---
  const nullNodes = nodes.filter((n) => n.type === 'object/null')
  for (const nullNode of nullNodes) {
    const { transform, nodeIds: transformNodeIds, reachesOutput } = resolveTransformChain(nullNode.id, nodes, edges)
    if (!reachesOutput) continue
    meshes.push({
      id: nullNode.id,
      geometryNodeId: nullNode.id,
      geometryType: 'null',
      geometryProps: {},
      materialNodeId: nullNode.id,
      materialType: 'null',
      materialProps: {},
      transformNodeIds,
      transform,
    })
  }

  // --- glTF Objects ---
  const gltfNodes = nodes.filter((n) => n.type === 'object/gltf')
  const gltfObjects: CompiledGLTF[] = []

  for (const gltfNode of gltfNodes) {
    const { transform, nodeIds: transformNodeIds, reachesOutput } = resolveTransformChain(gltfNode.id, nodes, edges)
    if (!reachesOutput) continue

    const props = getProps(gltfNode)
    const glbFile = props.glbFile as { name: string; dataUrl: string } | '' | undefined

    gltfObjects.push({
      id: gltfNode.id,
      fileDataUrl: typeof glbFile === 'object' ? glbFile.dataUrl : undefined,
      fileName: typeof glbFile === 'object' ? glbFile.name : undefined,
      extraFiles: typeof glbFile === 'object' ? glbFile.extraFiles : undefined,
      centerMode: (props.centerMode as number) ?? 0,
      originX: (props.originX as number) ?? 0,
      originY: (props.originY as number) ?? 0,
      originZ: (props.originZ as number) ?? 0,
      transform,
      transformNodeIds,
    })
  }

  // --- Paths ---
  const pathNodes = nodes.filter((n) => n.type === 'path')
  const paths: CompiledPath[] = pathNodes.map((n) => {
    const props = getProps(n)
    const mode = (props.mode as number) ?? 0

    // Walk downstream through Transform nodes (via 'path' handle)
    const transformNodeIds: string[] = []
    let currentId = n.id
    const visited = new Set<string>()
    while (!visited.has(currentId)) {
      visited.add(currentId)
      const outEdge = edges.find((e) => e.source === currentId && e.sourceHandle === 'path')
      if (!outEdge) break
      const next = nodeMap.get(outEdge.target)
      if (!next || next.type !== 'transform') break
      transformNodeIds.push(next.id)
      currentId = next.id
    }

    return {
      id: n.id,
      pathType: PATH_SUBTYPES[mode] ?? 'line',
      pathProps: props,
      position: [0, 0, 0],   // Set at runtime by LiveEvaluator from Transform chain
      transformNodeIds,
    }
  })

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
    const targetNodeId = lightType === 'directional' && props.targetNodeId
      ? (props.targetNodeId as string)
      : undefined

    // Path via port connection (may go through Transform nodes)
    const pathEdge = lightType !== 'ambient'
      ? edges.find((e) => e.target === n.id && e.targetHandle === 'path')
      : undefined
    const pathNodeId = pathEdge ? resolvePathNodeId(pathEdge.source, edges, nodeMap) : undefined

    return {
      id: n.id,
      lightType,
      props: normalizeLightProps(lightType, props),
      targetNodeId,
      pathNodeId,
      pathProgress: (props.pathProgress as number) ?? 0,
    }
  })

  // --- Camera (connected to Scene Output) ---
  let camera: CompiledCamera | undefined
  for (const soNode of sceneOutputNodes) {
    const edge = edges.find((e) => e.target === soNode.id && e.targetHandle === 'camera')
    if (!edge) continue
    const camNode = nodeMap.get(edge.source)
    if (!camNode || camNode.type !== 'camera') continue
    const props = getProps(camNode)
    const camMode = (props.mode as number) ?? 0
    camera = {
      nodeId: camNode.id,
      position: [
        (props.positionX as number) ?? 0,
        (props.positionY as number) ?? 5,
        (props.positionZ as number) ?? 10,
      ],
      rotation: [
        (props.rotationX as number) ?? 0,
        (props.rotationY as number) ?? 0,
        (props.rotationZ as number) ?? 0,
      ],
      fov: (props.fov as number) ?? 50,
      mode: camMode,
      targetNodeId: camMode === 1 && props.targetNodeId ? (props.targetNodeId as string) : undefined,
      // Path via port connection (may go through Transform nodes)
      pathNodeId: (() => {
        const e = edges.find((e) => e.target === camNode.id && e.targetHandle === 'path')
        return e ? resolvePathNodeId(e.source, edges, nodeMap) : undefined
      })(),
      pathProgress: (props.pathProgress as number) ?? 0,
      pathLookAhead: (props.pathLookAhead as boolean) ?? true,
    }
    break
  }

  return { meshes, gltfObjects, paths, lights, camera }
}

/** Normalize geometry props to a renderer-friendly format */
function normalizeGeoProps(type: string, props: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'box':
      return { width: props.width, height: props.height, depth: props.depth, widthSegs: props.boxWidthSegs, heightSegs: props.boxHeightSegs, depthSegs: props.boxDepthSegs }
    case 'sphere':
      return { radius: props.radius, widthSegments: props.widthSegments, heightSegments: props.heightSegments }
    case 'plane':
      return { width: props.planeWidth, height: props.planeHeight, widthSegs: props.planeWidthSegs, heightSegs: props.planeHeightSegs }
    case 'torus':
      return { radius: props.torusRadius, tube: props.tube, radialSegments: props.torusRadialSegs, tubularSegments: props.torusTubularSegs }
    case 'cylinder':
      return { radiusTop: props.radiusTop, radiusBottom: props.radiusBottom, height: props.cylHeight, radialSegments: props.radialSegments }
    case 'capsule':
      return { radius: props.capsuleRadius, length: props.capsuleLength, capSegments: props.capSegments, radialSegments: props.capsuleRadialSegments }
    case 'icosphere':
      return { radius: props.icoRadius, detail: props.icoDetail }
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
      return { color: props.color, intensity: props.ptIntensity, distance: props.distance, positionX: props.positionX, positionY: props.positionY, positionZ: props.positionZ }
    default:
      return props
  }
}

/**
 * Walk upstream from a node through 'path' inputs until we reach the actual Path node.
 * Used by Camera/Light to find the real path when a Transform is in between.
 */
function resolvePathNodeId(
  sourceId: string,
  edges: GraphEdge[],
  nodeMap: Map<string, GraphNode>,
): string | undefined {
  let currentId = sourceId
  const visited = new Set<string>()
  while (!visited.has(currentId)) {
    visited.add(currentId)
    const node = nodeMap.get(currentId)
    if (!node) return undefined
    if (node.type === 'path') return currentId
    if (node.type === 'transform') {
      const pathEdge = edges.find((e) => e.target === currentId && e.targetHandle === 'path')
      if (!pathEdge) return undefined
      currentId = pathEdge.source
    } else {
      return undefined
    }
  }
  return undefined
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
