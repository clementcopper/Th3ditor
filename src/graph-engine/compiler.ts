import type { GraphNode, GraphEdge, CompiledScene, CompiledMesh, CompiledGLTF, CompiledLight, CompiledCamera, CompiledPath, CompiledTransform, CompiledBackgroundShader } from '../types/node-graph'
import { getNodeDef } from './node-registry'
import { rgbaToHex6, rgbToHsl, hslToRgb } from '../utils/color'
import { compileShaderGraph } from './shader-graph-compiler'

/** Maps geometry mode number to a subtype string for the renderer */
const GEO_SUBTYPES = ['box', 'sphere', 'plane', 'torus', 'cylinder', 'capsule', 'icosphere'] as const

/** Maps light mode number to a subtype string */
const LIGHT_SUBTYPES = ['ambient', 'directional', 'point', 'area'] as const

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

    // Resolve color port connection: walk upstream color nodes at compile time
    const colorEdge = edges.find((e) => e.target === matNode.id && e.targetHandle === 'color')
    if (colorEdge) {
      const colorSrcNode = nodeMap.get(colorEdge.source)
      if (colorSrcNode) {
        const resolved = resolveStaticColor(colorSrcNode, edges, nodeMap)
        if (resolved) matProps.color = resolved
      }
    }

    // Resolve all texture map ports into a textureSlots dict
    const TEXTURE_PORTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'displacementMap'] as const
    const textureSlots: Record<string, { nodeId: string; dataUrl?: string; noiseProps?: Record<string, unknown> }> = {}
    for (const port of TEXTURE_PORTS) {
      const slot = resolveTextureSlot(port, matNode.id, edges, nodeMap)
      if (slot) textureSlots[port] = slot
    }
    // Shader-specific texture ports t1/t2
    if (matNode.type === 'shader/glsl') {
      for (const port of ['t1', 't2']) {
        const slot = resolveTextureSlot(port, matNode.id, edges, nodeMap)
        if (slot) textureSlots[port] = slot
      }
    }
    if (Object.keys(textureSlots).length > 0) matProps.textureSlots = textureSlots

    // Resolve geometry subtype and props
    let geometryType: string
    let normalizedGeoProps: Record<string, unknown>
    let geometrySource: CompiledMesh['geometrySource'] | undefined

    if (geoNode.type === 'geometry/gltf-mesh') {
      geometryType = 'gltf-mesh'
      normalizedGeoProps = {}
      const fileDataUrl = geoNode.data.fileDataUrl as string | undefined
      const meshIndex = (geoNode.data.meshIndex as number) ?? 0
      if (fileDataUrl) {
        const matrixWorld = geoNode.data.matrixWorld as number[] | undefined
        const extraFiles = geoNode.data.extraFiles as { name: string; dataUrl: string }[] | undefined
        geometrySource = { type: 'gltf', dataUrl: fileDataUrl, meshIndex, matrixWorld, extraFiles }
      }
    } else {
      const geoMode = (geoProps.mode as number) ?? 0
      geometryType = GEO_SUBTYPES[geoMode] ?? 'box'
      normalizedGeoProps = normalizeGeoProps(geometryType, geoProps)
    }

    // Compile shader graph — either direct (shader/output → mesh) or via material port (PBR mode)
    let meshShaderGraph: CompiledMesh['shaderGraph'] | undefined
    if (matNode.type === 'shader/output') {
      meshShaderGraph = compileShaderGraph(matNode.id, nodes, edges)
    } else if (matNode.type === 'material') {
      const sgEdge = edges.find((e) => e.target === matNode.id && e.targetHandle === 'shaderGraph')
      if (sgEdge) {
        const sgNode = nodeMap.get(sgEdge.source)
        if (sgNode?.type === 'shader/output') {
          meshShaderGraph = { ...compileShaderGraph(sgNode.id, nodes, edges), pbrMode: true }
        }
      }
    }

    meshes.push({
      id: meshNode.id,
      geometryNodeId: geoNode.id,
      geometryType,
      geometryProps: normalizedGeoProps,
      geometrySource,
      materialNodeId: matNode.id,
      materialType: matNode.type,
      materialProps: matProps,
      shaderGraph: meshShaderGraph,
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
    const glbFile = props.glbFile as { name: string; dataUrl: string; extraFiles?: { name: string; dataUrl: string }[] } | '' | undefined

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
    const targetNodeId = (lightType === 'directional' || lightType === 'area') && props.targetNodeId
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
    const camMode = Number(props.mode ?? 0)
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

  const sceneOutputNode = sceneOutputNodes[0]
  const sceneOutputProps = sceneOutputNode ? getProps(sceneOutputNode) : {}
  const smoothShading = Boolean(sceneOutputProps.smoothShading)
  const bgColorRaw = sceneOutputProps.bgColor
  const bgColor = Array.isArray(bgColorRaw) && bgColorRaw.length >= 3
    ? rgbaToHex6([bgColorRaw[0] as number, bgColorRaw[1] as number, bgColorRaw[2] as number, (bgColorRaw[3] as number) ?? 1])
    : '#191614'

  const envMapFile = sceneOutputProps.envMap as { name: string; dataUrl: string } | '' | undefined
  const envMapDataUrl = typeof envMapFile === 'object' && envMapFile ? envMapFile.dataUrl : undefined
  const envIntensity = (sceneOutputProps.envIntensity as number) ?? 1
  const showEnvBackground = Boolean(sceneOutputProps.showEnvBackground)

  // --- Background Shader (connected to Scene Output 'shader' port) ---
  let backgroundShader: CompiledBackgroundShader | undefined
  if (sceneOutputNode) {
    const shaderEdge = edges.find((e) => e.target === sceneOutputNode.id && e.targetHandle === 'shader')
    if (shaderEdge) {
      const shaderNode = nodeMap.get(shaderEdge.source)
      if (shaderNode) {
        if (shaderNode.type === 'shader/output') {
          // Visual shader graph path — compile to GLSL automatically
          const compiled = compileShaderGraph(shaderNode.id, nodes, edges)
          backgroundShader = {
            materialNodeId: shaderNode.id,
            materialProps: {},
            generatedFragmentShader: compiled.fragmentShader,
            generatedUniforms: compiled.uniforms,
            uniformNodeMap: compiled.uniformNodeMap,
            bridgeUniforms: compiled.bridgeUniforms,
          }
        } else {
          // Raw GLSL shader node (shader/glsl)
          const shaderProps = getProps(shaderNode)
          backgroundShader = { materialNodeId: shaderNode.id, materialProps: shaderProps }
        }
      }
    }
  }

  return { meshes, gltfObjects, paths, lights, camera, backgroundShader, smoothShading, bgColor, envMapDataUrl, envIntensity, showEnvBackground }
}

/** Normalize geometry props to a renderer-friendly format */
function normalizeGeoProps(type: string, props: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'box':
      return { width: props.width, height: props.height, depth: props.depth, widthSegs: props.boxWidthSegs, heightSegs: props.boxHeightSegs, depthSegs: props.boxDepthSegs }
    case 'sphere':
      return { radius: props.radius, segments: props.sphereSegments }
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
    case 'area':
      return { color: props.color, intensity: props.areaIntensity ?? 5, width: props.areaWidth ?? 2, height: props.areaHeight ?? 1, positionX: props.positionX, positionY: props.positionY, positionZ: props.positionZ, rotationX: props.areaRotX ?? 0, rotationY: props.areaRotY ?? 0, rotationZ: props.areaRotZ ?? 0 }
    default:
      return props
  }
}

/**
 * Resolve a single texture input port into a slot descriptor for SceneRenderer.
 * Handles plain texture nodes and texture/normal conversion nodes.
 */
function resolveTextureSlot(
  portName: string,
  targetNodeId: string,
  edges: GraphEdge[],
  nodeMap: Map<string, GraphNode>,
): { nodeId: string; dataUrl?: string; flipY?: boolean; noiseProps?: Record<string, unknown>; normalFrom?: { dataUrl?: string; noiseProps?: Record<string, unknown> }; normalStrength?: number; normalSourceNodeId?: string } | null {
  const edge = edges.find((e) => e.target === targetNodeId && e.targetHandle === portName)
  if (!edge) return null
  const node = nodeMap.get(edge.source)
  if (!node) return null

  if (node.type !== 'texture') return null
  const texDef = getNodeDef(node.type)
  const texProps = { ...(texDef?.defaults ?? {}), ...node.data } as Record<string, unknown>
  const texMode = Number(texProps.mode ?? 0)

  if (texMode === 0) {
    // Image mode
    const imageFile = texProps.imageFile as { name: string; dataUrl: string } | '' | undefined
    if (typeof imageFile !== 'object' || !imageFile) return null
    // flipY:false stored by glTF-expand to signal "do not flip" (glTF UV top-left convention)
    const flipY = texProps.flipY === false ? false : undefined
    return { nodeId: node.id, dataUrl: imageFile.dataUrl, ...(flipY === false && { flipY }) }
  }

  if (texMode === 1) {
    // Noise mode
    return { nodeId: node.id, noiseProps: texProps }
  }

  if (texMode === 2) {
    // Normal mode: walk upstream via 'texture' input port to find source texture
    const strength = (texProps.strength as number) ?? 3
    const srcEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'source')
    if (!srcEdge) return null
    const srcNode = nodeMap.get(srcEdge.source)
    if (srcNode?.type !== 'texture') return null
    const srcDef = getNodeDef(srcNode.type)
    const srcProps = { ...(srcDef?.defaults ?? {}), ...srcNode.data } as Record<string, unknown>
    const srcMode = Number(srcProps.mode ?? 0)
    let normalFrom: { dataUrl?: string; noiseProps?: Record<string, unknown> }
    if (srcMode === 0) {
      const imageFile = srcProps.imageFile as { name: string; dataUrl: string } | '' | undefined
      if (typeof imageFile !== 'object' || !imageFile) return null
      normalFrom = { dataUrl: imageFile.dataUrl }
    } else {
      normalFrom = { noiseProps: srcProps }
    }
    return { nodeId: node.id, normalFrom, normalStrength: strength, normalSourceNodeId: srcNode.id }
  }

  return null
}

/**
 * Statically resolve a color value from a color-type node chain (no dynamic context).
 * Used by the compiler to set initial materialProps.color at compile time.
 */
function resolveStaticColor(
  node: GraphNode,
  edges: GraphEdge[],
  nodeMap: Map<string, GraphNode>,
): [number, number, number, number] | undefined {
  const def = getNodeDef(node.type)
  const props = { ...(def?.defaults ?? {}), ...node.data }

  function upstreamColor(handle: string, fallback: string): [number, number, number, number] {
    const edge = edges.find((e) => e.target === node.id && e.targetHandle === handle)
    if (edge) {
      const src = nodeMap.get(edge.source)
      if (src) {
        const v = resolveStaticColor(src, edges, nodeMap)
        if (v) return v
      }
    }
    return (props[fallback] as [number, number, number, number]) ?? [1, 1, 1, 1]
  }

  if (node.type === 'color') {
    return (props.color as [number, number, number, number]) ?? [1, 1, 1, 1]
  }

  if (node.type === 'color/mix') {
    const a = upstreamColor('colorA', 'colorA')
    const b = upstreamColor('colorB', 'colorB')
    const t = Math.min(1, Math.max(0, (props.t as number) ?? 0.5))
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      a[3] + (b[3] - a[3]) * t,
    ]
  }

  if (node.type === 'color/hsl') {
    const base = upstreamColor('color', 'color')
    const hueShift = (props.hue as number) ?? 0
    const satShift = (props.saturation as number) ?? 0
    const lightShift = (props.lightness as number) ?? 0
    const [h, s, l] = rgbToHsl(base[0], base[1], base[2])
    const newH = ((h + hueShift) % 360 + 360) % 360
    const newS = Math.min(100, Math.max(0, s + satShift))
    const newL = Math.min(100, Math.max(0, l + lightShift))
    const [r, g, b] = hslToRgb(newH, newS, newL)
    return [r, g, b, base[3]]
  }

  return undefined
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
