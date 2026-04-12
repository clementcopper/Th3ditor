import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GraphNode, GraphEdge } from '../types/node-graph'

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

async function textureToDataUrl(texture: THREE.Texture): Promise<string | null> {
  const img = (texture.source as { data?: unknown } | undefined)?.data
  if (!img) return null

  let w = 1, h = 1
  if (img instanceof HTMLImageElement) {
    w = Math.max(img.naturalWidth || img.width, 1)
    h = Math.max(img.naturalHeight || img.height, 1)
  } else if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    w = Math.max(img.width, 1)
    h = Math.max(img.height, 1)
  } else {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0)

  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export interface ExpandResult {
  nodesToAdd: GraphNode[]
  edgesToAdd: GraphEdge[]
  nodeToRemove: string
}

export async function expandGLTFToNodes(
  gltfNode: GraphNode,
  allNodes: GraphNode[],
): Promise<ExpandResult> {
  const fileData = gltfNode.data.glbFile as
    | { name: string; dataUrl: string; extraFiles?: { name: string; dataUrl: string }[] }
    | ''
    | undefined
  if (!fileData || typeof fileData !== 'object') {
    throw new Error('No file loaded in glTF Import node')
  }

  const { dataUrl: fileDataUrl, extraFiles } = fileData

  // Load the glTF
  const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
    const manager = new THREE.LoadingManager()
    if (extraFiles && extraFiles.length > 0) {
      const urlMap = new Map(extraFiles.map((f) => [f.name, f.dataUrl]))
      manager.setURLModifier((url) => {
        const filename = url.split('/').pop()?.split('?')[0] ?? ''
        return urlMap.get(filename) ?? url
      })
    }
    const loader = new GLTFLoader(manager)
    loader.load(fileDataUrl, resolve, undefined, reject)
  })

  // Ensure world matrices are up-to-date before reading them
  gltf.scene.updateMatrixWorld(true)

  // Collect all meshes from the scene hierarchy
  const meshObjects: THREE.Mesh[] = []
  gltf.scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshObjects.push(child as THREE.Mesh)
    }
  })

  if (meshObjects.length === 0) {
    throw new Error('No meshes found in the imported file')
  }

  const sceneOutputNode = allNodes.find((n) => n.type === 'scene/output')

  const nodesToAdd: GraphNode[] = []
  const edgesToAdd: GraphEdge[] = []

  const originX = gltfNode.position.x
  const originY = gltfNode.position.y

  for (let i = 0; i < meshObjects.length; i++) {
    const threeMesh = meshObjects[i]
    const meshName = threeMesh.name || `Mesh_${i}`
    const mat = Array.isArray(threeMesh.material) ? threeMesh.material[0] : threeMesh.material
    const stdMat = mat instanceof THREE.MeshStandardMaterial ? mat : null
    const physMat = mat instanceof THREE.MeshPhysicalMaterial ? mat : null
    // Capture world transform so expanded mesh parts appear at their correct positions
    const matrixWorld = Array.from(threeMesh.matrixWorld.elements) as number[]

    const groupX = originX + i * 800
    const groupY = originY

    // --- Extract textures from material ---
    type TexEntry = { slot: string; dataUrl: string; label: string }
    const textures: TexEntry[] = []

    if (stdMat) {
      const slots: { slot: string; texture: THREE.Texture | null; label: string }[] = [
        { slot: 'map', texture: stdMat.map, label: 'Diffuse' },
        { slot: 'normalMap', texture: stdMat.normalMap, label: 'Normal' },
        { slot: 'roughnessMap', texture: stdMat.roughnessMap, label: 'Roughness' },
        { slot: 'metalnessMap', texture: stdMat.metalnessMap, label: 'Metalness' },
        { slot: 'aoMap', texture: stdMat.aoMap, label: 'AO' },
        { slot: 'emissiveMap', texture: stdMat.emissiveMap, label: 'Emissive' },
      ]
      for (const { slot, texture, label } of slots) {
        if (!texture) continue
        const dataUrl = await textureToDataUrl(texture)
        if (dataUrl) textures.push({ slot, dataUrl, label })
      }
    }

    // --- Texture nodes ---
    const texNodeIds = new Map<string, string>()
    for (let t = 0; t < textures.length; t++) {
      const tex = textures[t]
      const texNodeId = `gltf-tex-${uid()}`
      texNodeIds.set(tex.slot, texNodeId)
      nodesToAdd.push({
        id: texNodeId,
        type: 'texture',
        position: { x: groupX + t * 190, y: groupY - 380 },
        data: {
          label: tex.label,
          mode: 0,
          // flipY:false signals the renderer to NOT flip this texture — glTF UV coords
          // are top-left origin and already match the raw image data without any flip.
          flipY: false,
          imageFile: { name: `${meshName}_${tex.label}.png`, dataUrl: tex.dataUrl },
        },
      })
    }

    // --- Material node ---
    const matNodeId = `gltf-mat-${uid()}`
    const matColor: [number, number, number, number] = stdMat
      ? [stdMat.color.r, stdMat.color.g, stdMat.color.b, 1]
      : [1, 1, 1, 1]
    // Transmission (KHR_materials_transmission) → approximate as opacity-based transparency
    const transmission = physMat?.transmission ?? 0
    const isTransparent = (stdMat?.transparent ?? false) || transmission > 0
    const opacity = transmission > 0 ? 1 - transmission : (stdMat?.opacity ?? 1)
    const side = stdMat?.side === 2 ? 2 : stdMat?.side === 1 ? 1 : 0
    nodesToAdd.push({
      id: matNodeId,
      type: 'material',
      position: { x: groupX + 220, y: groupY - 160 },
      data: {
        label: `${meshName} Mat`,
        color: matColor,
        metalness: stdMat?.metalness ?? 0.1,
        roughness: stdMat?.roughness ?? 0.5,
        ...(isTransparent && { transparent: true, opacity }),
        ...(side !== 0 && { side }),
      },
    })

    // Connect textures → material
    for (const [slot, texNodeId] of texNodeIds) {
      edgesToAdd.push({
        id: `e-${texNodeId}-${matNodeId}-${slot}`,
        source: texNodeId,
        sourceHandle: 'texture',
        target: matNodeId,
        targetHandle: slot,
      })
    }

    // --- Geometry node ---
    const geoNodeId = `gltf-geo-${uid()}`
    nodesToAdd.push({
      id: geoNodeId,
      type: 'geometry/gltf-mesh',
      position: { x: groupX, y: groupY - 160 },
      data: {
        label: meshName,
        fileDataUrl,
        meshIndex: i,
        matrixWorld,
        ...(extraFiles && extraFiles.length > 0 && { extraFiles }),
      },
    })

    // --- Mesh node ---
    const meshNodeId = `gltf-mesh-${uid()}`
    nodesToAdd.push({
      id: meshNodeId,
      type: 'object/mesh',
      position: { x: groupX + 120, y: groupY },
      data: { label: meshName },
    })

    // geometry → mesh node
    edgesToAdd.push({
      id: `e-${geoNodeId}-${meshNodeId}-geometry`,
      source: geoNodeId,
      sourceHandle: 'geometry',
      target: meshNodeId,
      targetHandle: 'geometry',
    })

    // material → mesh node
    edgesToAdd.push({
      id: `e-${matNodeId}-${meshNodeId}-material`,
      source: matNodeId,
      sourceHandle: 'material',
      target: meshNodeId,
      targetHandle: 'material',
    })

    // mesh node → Scene Output
    if (sceneOutputNode) {
      edgesToAdd.push({
        id: `e-${meshNodeId}-${sceneOutputNode.id}-mesh-${uid()}`,
        source: meshNodeId,
        sourceHandle: 'mesh',
        target: sceneOutputNode.id,
        targetHandle: 'mesh',
      })
    }
  }

  return { nodesToAdd, edgesToAdd, nodeToRemove: gltfNode.id }
}
