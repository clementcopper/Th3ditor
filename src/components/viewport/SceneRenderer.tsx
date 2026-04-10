import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { useSceneStore } from '../../store/scene-store'
import { useGraphStore } from '../../store/graph-store'
import { useAnimationStore } from '../../store/animation-store'
import { useEditorStore } from '../../store/editor-store'
import { evaluateFloatPort, type EvalContext } from '../../graph-engine/evaluator'
import { getNodeDef } from '../../graph-engine/node-registry'
import { useEvaluatorStore } from '../../store/evaluator-store'
import { evaluatePathPosition } from '../../graph-engine/path-utils'
import type { CompiledMesh, CompiledGLTF, CompiledLight, CompiledCamera, CompiledPath } from '../../types/node-graph'

function toThreeColor(color?: unknown): string {
  const c = color as [number, number, number, number] | undefined
  if (!c) return '#ffffff'
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`
}

function MeshObject({
  mesh,
  editorShading,
  isEditorView,
}: {
  mesh: CompiledMesh
  editorShading: boolean
  isEditorView: boolean
}) {
  const gp = mesh.geometryProps
  const mp = mesh.materialProps
  const t = mesh.transform

  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)

  const wireframeOverride = useEditorStore((s) => editorShading && s.shadingMode === 'wireframe')
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const gizmoMode = useEditorStore((s) => s.gizmoMode)
  const isSelected = selectedNodeId === mesh.id
  const { controls } = useThree()

  // Sync group transform from compiled scene when not dragging
  useFrame(() => {
    if (!isDragging.current && groupRef.current) {
      groupRef.current.position.set(t.position[0], t.position[1], t.position[2])
      groupRef.current.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2])
      groupRef.current.scale.set(t.scale[0], t.scale[1], t.scale[2])
    }
  })

  // Always show gizmo when selected in editor — no transform node required
  const canGizmo = isEditorView && isSelected

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return

    const gs = useGraphStore.getState()
    const RAD2DEG = 180 / Math.PI
    const pos = groupRef.current.position
    const rot = groupRef.current.rotation
    const scale = groupRef.current.scale

    // Find existing transform node for this mode
    const modeIndex = gizmoMode === 'translate' ? 0 : gizmoMode === 'rotate' ? 1 : 2
    const transformNode = mesh.transformNodeIds
      .map((id) => gs.nodes.find((n) => n.id === id))
      .find((n) => n?.type === 'transform' && ((n.data.mode as number) ?? 0) === modeIndex)

    if (transformNode) {
      // Update existing transform node
      if (gizmoMode === 'translate') {
        gs.updateNodeData(transformNode.id, { tx: pos.x, ty: pos.y, tz: pos.z })
      } else if (gizmoMode === 'rotate') {
        gs.updateNodeData(transformNode.id, { rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG })
      } else if (gizmoMode === 'scale') {
        gs.updateNodeData(transformNode.id, { sx: scale.x, sy: scale.y, sz: scale.z })
      }
    } else {
      // Auto-create and insert a new transform node into the chain
      const baseData = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
      const modeData =
        gizmoMode === 'translate' ? { mode: 0, tx: pos.x, ty: pos.y, tz: pos.z } :
        gizmoMode === 'rotate' ? { mode: 1, rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG } :
        { mode: 2, sx: scale.x, sy: scale.y, sz: scale.z }

      // Insert after the last node in the transform chain (or after the mesh itself)
      const lastId = mesh.transformNodeIds.length > 0
        ? mesh.transformNodeIds[mesh.transformNodeIds.length - 1]
        : mesh.id
      const outEdge = gs.edges.find((e) => e.source === lastId && e.sourceHandle === 'mesh')
      if (!outEdge) return

      const meshGraphNode = gs.nodes.find((n) => n.id === mesh.id)
      const newId = `transform-${Date.now()}`

      gs.removeEdge(outEdge.id)
      gs.addNode({
        id: newId,
        type: 'transform',
        position: { x: (meshGraphNode?.position.x ?? 0) + 220, y: meshGraphNode?.position.y ?? 0 },
        data: { ...baseData, ...modeData },
      })
      gs.addEdge({ id: `e-${lastId}-${newId}`, source: lastId, sourceHandle: 'mesh', target: newId, targetHandle: 'mesh' })
      gs.addEdge({ id: `e-${newId}-${outEdge.target}`, source: newId, sourceHandle: 'mesh', target: outEdge.target, targetHandle: outEdge.targetHandle })
    }

    // Wait 2 frames for the compiler to re-run before re-enabling position sync
    requestAnimationFrame(() => requestAnimationFrame(() => {
      isDragging.current = false
    }))
  }

  // Null object — only visible in editor as a small marker, never in camera view
  if (mesh.geometryType === 'null') {
    return (
      <>
        <group ref={groupRef}>
          {isEditorView && (
            <mesh
              renderOrder={999}
              onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : mesh.id) }}
            >
              <octahedronGeometry args={[0.15, 0]} />
              <meshBasicMaterial
                color={isSelected ? '#ff8800' : '#aaaaaa'}
                wireframe
                depthTest={false}
              />
            </mesh>
          )}
        </group>
        {canGizmo && (
          <TransformControls
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            object={groupRef as any}
            mode={gizmoMode}
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
          />
        )}
      </>
    )
  }

  return (
    <>
      <group ref={groupRef}>
        <mesh
          onClick={(e) => {
            if (!isEditorView) return
            e.stopPropagation()
            setSelectedNode(isSelected ? null : mesh.id)
          }}
        >
          {mesh.geometryType === 'box' && (
            <boxGeometry args={[gp.width as number, gp.height as number, gp.depth as number, gp.widthSegs as number, gp.heightSegs as number, gp.depthSegs as number]} />
          )}
          {mesh.geometryType === 'sphere' && (
            <sphereGeometry args={[gp.radius as number, gp.widthSegments as number, gp.heightSegments as number]} />
          )}
          {mesh.geometryType === 'plane' && (
            <planeGeometry args={[gp.width as number, gp.height as number, gp.widthSegs as number, gp.heightSegs as number]} />
          )}
          {mesh.geometryType === 'torus' && (
            <torusGeometry args={[gp.radius as number, gp.tube as number, gp.radialSegments as number, gp.tubularSegments as number]} />
          )}
          {mesh.geometryType === 'cylinder' && (
            <cylinderGeometry args={[gp.radiusTop as number, gp.radiusBottom as number, gp.height as number, gp.radialSegments as number]} />
          )}
          {mesh.geometryType === 'capsule' && (
            <capsuleGeometry args={[gp.radius as number, gp.length as number, gp.capSegments as number, gp.radialSegments as number]} />
          )}
          {mesh.geometryType === 'icosphere' && (
            <icosahedronGeometry args={[gp.radius as number, gp.detail as number]} />
          )}
          {wireframeOverride ? (
            <meshBasicMaterial color={toThreeColor(mp.color)} wireframe />
          ) : (
            <meshStandardMaterial
              color={toThreeColor(mp.color)}
              metalness={(mp.metalness as number) ?? 0.1}
              roughness={(mp.roughness as number) ?? 0.5}
              wireframe={(mp.wireframe as boolean) ?? false}
            />
          )}
        </mesh>
        {/* Selection highlight overlay */}
        {isEditorView && isSelected && (
          <mesh renderOrder={10}>
            {mesh.geometryType === 'box' && (
              <boxGeometry args={[gp.width as number, gp.height as number, gp.depth as number, gp.widthSegs as number, gp.heightSegs as number, gp.depthSegs as number]} />
            )}
            {mesh.geometryType === 'sphere' && (
              <sphereGeometry args={[gp.radius as number, gp.widthSegments as number, gp.heightSegments as number]} />
            )}
            {mesh.geometryType === 'plane' && (
              <planeGeometry args={[gp.width as number, gp.height as number, gp.widthSegs as number, gp.heightSegs as number]} />
            )}
            {mesh.geometryType === 'torus' && (
              <torusGeometry args={[gp.radius as number, gp.tube as number, gp.radialSegments as number, gp.tubularSegments as number]} />
            )}
            {mesh.geometryType === 'cylinder' && (
              <cylinderGeometry args={[gp.radiusTop as number, gp.radiusBottom as number, gp.height as number, gp.radialSegments as number]} />
            )}
            {mesh.geometryType === 'capsule' && (
              <capsuleGeometry args={[gp.radius as number, gp.length as number, gp.capSegments as number, gp.radialSegments as number]} />
            )}
            {mesh.geometryType === 'icosphere' && (
              <icosahedronGeometry args={[gp.radius as number, gp.detail as number]} />
            )}
            <meshBasicMaterial color="#ff8800" wireframe depthTest={false} />
          </mesh>
        )}
      </group>
      {canGizmo && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode={gizmoMode}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

function LightObject({
  light,
  isEditorView,
  meshes,
}: {
  light: CompiledLight
  isEditorView: boolean
  meshes: import('../../types/node-graph').CompiledMesh[]
}) {
  const lp = light.props
  const color = toThreeColor(lp.color)
  const intensity = (lp.intensity as number) ?? 1
  const pos: [number, number, number] = [
    (lp.positionX as number) ?? 0,
    (lp.positionY as number) ?? 0,
    (lp.positionZ as number) ?? 0,
  ]

  // Resolve directional light target position
  const targetMesh = light.targetNodeId
    ? meshes.find((m) => m.id === light.targetNodeId)
    : undefined
  const targetPos: [number, number, number] = targetMesh?.transform.position ?? [0, 0, 0]

  const hasPosition = light.lightType !== 'ambient'

  const groupRef = useRef<THREE.Group>(null)
  const iconRef = useRef<THREE.Mesh>(null)
  const dirLightRef = useRef<THREE.DirectionalLight>(null)
  const isDragging = useRef(false)

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const isSelected = selectedNodeId === light.id
  const { controls } = useThree()

  useFrame(() => {
    if (hasPosition && !isDragging.current && groupRef.current) {
      groupRef.current.position.set(pos[0], pos[1], pos[2])
    }
    // Update directional light target position imperatively
    if (dirLightRef.current) {
      dirLightRef.current.target.position.set(targetPos[0], targetPos[1], targetPos[2])
      dirLightRef.current.target.updateMatrixWorld()
    }
    // Rotate directional cone to face toward target
    if (isEditorView && light.lightType === 'directional' && iconRef.current && groupRef.current) {
      const p = groupRef.current.position
      const dir = new THREE.Vector3(
        targetPos[0] - p.x,
        targetPos[1] - p.y,
        targetPos[2] - p.z,
      )
      if (dir.length() > 0.001) {
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, -1, 0),
          dir.normalize(),
        )
        iconRef.current.quaternion.copy(quat)
      }
    }
  })

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return
    const p = groupRef.current.position
    // Update graph store (triggers recompile for persistence)
    updateNodeData(light.id, { positionX: p.x, positionY: p.y, positionZ: p.z })
    // Also update scene store directly to avoid snap-back before compiler runs
    const scene = useSceneStore.getState().scene
    const newLights = scene.lights.map((l) =>
      l.id === light.id
        ? { ...l, props: { ...l.props, positionX: p.x, positionY: p.y, positionZ: p.z } }
        : l
    )
    useSceneStore.getState().setScene({ ...scene, lights: newLights })
    requestAnimationFrame(() => requestAnimationFrame(() => {
      isDragging.current = false
    }))
  }

  if (light.lightType === 'ambient') {
    // In editor view the canvas has its own fixed ambient — skip scene ambient
    if (isEditorView) return null
    return <ambientLight color={color} intensity={intensity} />
  }

  const iconColor = isSelected ? '#ff8800' : '#ffdd44'
  const iconScale = Math.max(0.5, Math.min(3.0, 0.8 + Math.sqrt(Math.max(0, intensity)) * 0.25))

  return (
    <>
      <group ref={groupRef} position={pos}>
        {/* Only render actual scene lights in camera view */}
        {!isEditorView && light.lightType === 'directional' && (
          <directionalLight ref={dirLightRef} color={color} intensity={intensity} />
        )}
        {!isEditorView && light.lightType === 'point' && (
          <pointLight color={color} intensity={intensity} distance={(lp.distance as number) ?? 0} />
        )}
        {isEditorView && (
          <mesh
            ref={iconRef}
            scale={iconScale}
            renderOrder={999}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedNode(isSelected ? null : light.id)
            }}
          >
            {light.lightType === 'point' && (
              <sphereGeometry args={[0.15, 8, 6]} />
            )}
            {light.lightType === 'directional' && (
              <coneGeometry args={[0.15, 0.35, 16]} />
            )}
            <meshBasicMaterial color={iconColor} wireframe depthTest={false} />
          </mesh>
        )}
      </group>
      {isEditorView && isSelected && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode="translate"
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

function CameraIcon({ camera }: { camera: CompiledCamera }) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const gizmoMode = useEditorStore((s) => s.gizmoMode)
  const isSelected = selectedNodeId === camera.nodeId
  const { controls } = useThree()

  const DEG2RAD = Math.PI / 180
  const RAD2DEG = 180 / Math.PI

  useFrame(() => {
    if (!isDragging.current && groupRef.current) {
      groupRef.current.position.set(camera.position[0], camera.position[1], camera.position[2])
      if (camera.mode === 1 && camera.targetNodeId) {
        const scene = useSceneStore.getState().scene
        const target = scene.meshes.find((m) => m.id === camera.targetNodeId)
          ?? scene.gltfObjects.find((g) => g.id === camera.targetNodeId)
        if (target) {
          const [tx, ty, tz] = target.transform.position
          const p = groupRef.current.position
          // Look at the mirrored point so -Z (base) faces the target
          groupRef.current.lookAt(2 * p.x - tx, 2 * p.y - ty, 2 * p.z - tz)
        }
      } else {
        groupRef.current.rotation.set(
          camera.rotation[0] * DEG2RAD,
          camera.rotation[1] * DEG2RAD,
          camera.rotation[2] * DEG2RAD,
        )
      }
    }
  })

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return
    const p = groupRef.current.position
    const r = groupRef.current.rotation
    const gs = useGraphStore.getState()
    const scene = useSceneStore.getState().scene

    if (gizmoMode === 'translate') {
      gs.updateNodeData(camera.nodeId, { positionX: p.x, positionY: p.y, positionZ: p.z })
      if (scene.camera) {
        useSceneStore.getState().setScene({
          ...scene,
          camera: { ...scene.camera, position: [p.x, p.y, p.z] },
        })
      }
    } else if (gizmoMode === 'rotate') {
      gs.updateNodeData(camera.nodeId, {
        rotationX: r.x * RAD2DEG,
        rotationY: r.y * RAD2DEG,
        rotationZ: r.z * RAD2DEG,
      })
      if (scene.camera) {
        useSceneStore.getState().setScene({
          ...scene,
          camera: { ...scene.camera, rotation: [r.x * RAD2DEG, r.y * RAD2DEG, r.z * RAD2DEG] },
        })
      }
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      isDragging.current = false
    }))
  }

  return (
    <>
      <group ref={groupRef} position={camera.position}>
        <mesh
          renderOrder={999}
          rotation={[Math.PI / 2, Math.PI / 4, 0]}
          position={[0, 0, -0.08]}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedNode(isSelected ? null : camera.nodeId)
          }}
        >
          {/* Square pyramid — radius scales with FOV, base faces -Z (camera look direction) */}
          <coneGeometry args={[Math.max(0.05, Math.tan((camera.fov * Math.PI / 180) / 2) * 0.5), 0.35, 4]} />
          <meshBasicMaterial
            color={isSelected ? '#ff8800' : '#38BDF8'}
            depthTest={false}
            wireframe
          />
        </mesh>
      </group>
      {isSelected && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode={gizmoMode === 'scale' ? 'translate' : gizmoMode}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

/**
 * LiveEvaluator runs inside the R3F render loop.
 * Evaluates dynamic float connections and updates the compiled scene.
 */
function LiveEvaluator() {
  const mouseRef = useRef({ x: 0, y: 0 })
  const lastStoreUpdate = useRef(0)
  const { size } = useThree()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  useFrame((_, delta) => {
    const animStore = useAnimationStore.getState()
    const playing = animStore.playing

    let newElapsed = animStore.elapsed
    if (playing) {
      newElapsed += delta
      animStore.setElapsed(newElapsed)
    }

    const nodes = useGraphStore.getState().nodes
    const edges = useGraphStore.getState().edges
    const scene = useSceneStore.getState().scene

    const ctx: EvalContext = {
      elapsed: newElapsed,
      delta: playing ? delta : 0,
      mouseX: mouseRef.current.x,
      mouseY: mouseRef.current.y,
      screenW: size.width,
      screenH: size.height,
    }

    const cache = new Map<string, number>()

    // Evaluate ALL float source ports so edge labels work
    for (const edge of edges) {
      const sourceNode = nodes.find((n) => n.id === edge.source)
      if (!sourceNode) continue
      if (sourceNode.type === 'time' || sourceNode.type === 'math' || sourceNode.type === 'input') {
        evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
      }
    }

    const hasDynamic = nodes.some(
      (n) => n.type === 'time' || n.type === 'input' || n.type === 'math',
    )
    const hasPath = !!scene.camera?.pathNodeId || scene.lights.some((l) => l.pathNodeId)
    if (!hasDynamic && !hasPath) {
      // Still update evaluator store for edge labels even when no path/dynamic nodes
      const now = performance.now()
      if (cache.size > 0 && now - lastStoreUpdate.current > 100) {
        lastStoreUpdate.current = now
        useEvaluatorStore.getState().setValues(cache)
      }
      return
    }

    let changed = false
    const newMeshes = scene.meshes.map((mesh) => {
      let meshChanged = false
      const matProps = { ...mesh.materialProps }
      const geoProps = { ...mesh.geometryProps }
      const transform = { ...mesh.transform }

      const ownedNodeIds = new Set([mesh.id, mesh.geometryNodeId, mesh.materialNodeId, ...mesh.transformNodeIds])

      for (const edge of edges) {
        if (!ownedNodeIds.has(edge.target)) continue

        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        const targetNode = nodes.find((n) => n.id === edge.target)
        if (!targetNode) continue

        if (targetNode.type === 'material') {
          if (mesh.materialProps[edge.targetHandle] !== val) { matProps[edge.targetHandle] = val; meshChanged = true }
        } else if (targetNode.type === 'geometry') {
          if (mesh.geometryProps[edge.targetHandle] !== val) { geoProps[edge.targetHandle] = val; meshChanged = true }
        } else if (targetNode.type === 'transform') {
          const targetDef = getNodeDef(targetNode.type)
          const targetProps = { ...(targetDef?.defaults ?? {}), ...targetNode.data }
          const mode = (targetProps.mode as number) ?? 0
          const prop = edge.targetHandle

          if (mode === 0) {
            // Translate
            if (prop === 'x' && transform.position[0] !== val) { transform.position = [...transform.position]; transform.position[0] = val; meshChanged = true }
            if (prop === 'y' && transform.position[1] !== val) { transform.position = [...transform.position]; transform.position[1] = val; meshChanged = true }
            if (prop === 'z' && transform.position[2] !== val) { transform.position = [...transform.position]; transform.position[2] = val; meshChanged = true }
          } else if (mode === 1) {
            // Rotate
            const DEG2RAD = Math.PI / 180
            if (prop === 'x' && transform.rotation[0] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[0] = val * DEG2RAD; meshChanged = true }
            if (prop === 'y' && transform.rotation[1] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[1] = val * DEG2RAD; meshChanged = true }
            if (prop === 'z' && transform.rotation[2] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[2] = val * DEG2RAD; meshChanged = true }
          } else if (mode === 2) {
            // Scale
            if (prop === 'x' && transform.scale[0] !== val) { transform.scale = [...transform.scale]; transform.scale[0] = val; meshChanged = true }
            if (prop === 'y' && transform.scale[1] !== val) { transform.scale = [...transform.scale]; transform.scale[1] = val; meshChanged = true }
            if (prop === 'z' && transform.scale[2] !== val) { transform.scale = [...transform.scale]; transform.scale[2] = val; meshChanged = true }
          }
        }
      }

      if (meshChanged) {
        changed = true
        return { ...mesh, materialProps: matProps, geometryProps: geoProps, transform: transform as any }
      }
      return mesh
    })

    // Evaluate float inputs on gltf object transform nodes
    const newGltfObjects = scene.gltfObjects.map((gltf) => {
      let gltfChanged = false
      const transform = { ...gltf.transform }

      const ownedNodeIds = new Set([gltf.id, ...gltf.transformNodeIds])

      for (const edge of edges) {
        if (!ownedNodeIds.has(edge.target)) continue

        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        const targetNode = nodes.find((n) => n.id === edge.target)
        if (!targetNode || targetNode.type !== 'transform') continue

        const targetDef = getNodeDef(targetNode.type)
        const targetProps = { ...(targetDef?.defaults ?? {}), ...targetNode.data }
        const mode = (targetProps.mode as number) ?? 0
        const prop = edge.targetHandle

        if (mode === 0) {
          if (prop === 'x' && transform.position[0] !== val) { transform.position = [...transform.position]; transform.position[0] = val; gltfChanged = true }
          if (prop === 'y' && transform.position[1] !== val) { transform.position = [...transform.position]; transform.position[1] = val; gltfChanged = true }
          if (prop === 'z' && transform.position[2] !== val) { transform.position = [...transform.position]; transform.position[2] = val; gltfChanged = true }
        } else if (mode === 1) {
          const DEG2RAD = Math.PI / 180
          if (prop === 'x' && transform.rotation[0] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[0] = val * DEG2RAD; gltfChanged = true }
          if (prop === 'y' && transform.rotation[1] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[1] = val * DEG2RAD; gltfChanged = true }
          if (prop === 'z' && transform.rotation[2] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[2] = val * DEG2RAD; gltfChanged = true }
        } else if (mode === 2) {
          if (prop === 'x' && transform.scale[0] !== val) { transform.scale = [...transform.scale]; transform.scale[0] = val; gltfChanged = true }
          if (prop === 'y' && transform.scale[1] !== val) { transform.scale = [...transform.scale]; transform.scale[1] = val; gltfChanged = true }
          if (prop === 'z' && transform.scale[2] !== val) { transform.scale = [...transform.scale]; transform.scale[2] = val; gltfChanged = true }
        }
      }

      if (gltfChanged) {
        changed = true
        return { ...gltf, transform: transform as any }
      }
      return gltf
    })

    // Evaluate float inputs on light nodes
    const newLights = scene.lights.map((light) => {
      let lightChanged = false
      const props = { ...light.props }

      let pathProgress = light.pathProgress ?? 0

      for (const edge of edges) {
        if (edge.target !== light.id) continue

        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        if (edge.targetHandle === 'pathProgress') {
          pathProgress = val
        } else if (light.props[edge.targetHandle as string] !== val) {
          props[edge.targetHandle] = val
          lightChanged = true
        }
      }

      // Apply path position for lights
      let updatedLight = lightChanged ? { ...light, props } : light
      if (light.pathNodeId) {
        const lightPath = scene.paths.find((p) => p.id === light.pathNodeId)
        if (lightPath) {
          const pos = evaluatePathPosition(lightPath, pathProgress)
          if (pos[0] !== updatedLight.props.positionX || pos[1] !== updatedLight.props.positionY || pos[2] !== updatedLight.props.positionZ) {
            updatedLight = { ...updatedLight, props: { ...updatedLight.props, positionX: pos[0], positionY: pos[1], positionZ: pos[2] }, pathProgress }
            lightChanged = true
          }
          // Push real world position + path rotation into evaluator store for PropertiesPanel/port display
          cache.set(`${light.id}:positionX`, pos[0])
          cache.set(`${light.id}:positionY`, pos[1])
          cache.set(`${light.id}:positionZ`, pos[2])
          cache.set(`${light.id}:rotationX`, (lightPath.pathProps.rotationX as number) ?? 0)
          cache.set(`${light.id}:rotationY`, (lightPath.pathProps.rotationY as number) ?? 0)
          cache.set(`${light.id}:rotationZ`, (lightPath.pathProps.rotationZ as number) ?? 0)
        }
      }

      if (lightChanged) {
        changed = true
        return updatedLight
      }
      return light
    })

    // Evaluate float inputs on camera node
    let newCamera = scene.camera
    if (scene.camera) {
      const camNodeId = scene.camera.nodeId
      let camChanged = false
      const camPos: [number, number, number] = [...scene.camera.position]
      const camRot: [number, number, number] = [...scene.camera.rotation]
      let camFov = scene.camera.fov

      for (const edge of edges) {
        if (edge.target !== camNodeId) continue
        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        camChanged = true
        switch (edge.targetHandle) {
          case 'positionX': camPos[0] = val; break
          case 'positionY': camPos[1] = val; break
          case 'positionZ': camPos[2] = val; break
          case 'rotationX': camRot[0] = val; break
          case 'rotationY': camRot[1] = val; break
          case 'rotationZ': camRot[2] = val; break
          case 'fov': camFov = val; break
          case 'pathProgress':
            if (scene.camera!.pathNodeId && scene.camera!.pathProgress !== val) {
              newCamera = { ...(newCamera ?? scene.camera!), pathProgress: val }
              camChanged = true
            }
            break
        }
      }

      if (camChanged) {
        changed = true
        newCamera = { ...(newCamera ?? scene.camera!), position: camPos, rotation: camRot, fov: camFov }
      }

      // Apply path position when a path is connected
      if (newCamera?.pathNodeId) {
        const camPath = scene.paths.find((p) => p.id === newCamera!.pathNodeId)
        if (camPath) {
          const t = newCamera.pathProgress ?? 0
          const pos = evaluatePathPosition(camPath, t)
          let pathCamChanged = pos[0] !== newCamera.position[0] || pos[1] !== newCamera.position[1] || pos[2] !== newCamera.position[2]
          let pathRot: [number, number, number] = newCamera.rotation

          // pathLookAhead orientation is handled entirely by CameraPathLookAhead
          // in CameraView.tsx via per-frame quaternion override. Do NOT compute or
          // store euler here: the plane-normal lookAt decomposition is discontinuous
          // for XY/YZ circles and overwrites the quaternion before gl.render().

          if (pathCamChanged) {
            changed = true
            newCamera = { ...newCamera, position: pos, rotation: pathRot }
          }
          // Push real world position + path rotation into evaluator store for PropertiesPanel/port display
          cache.set(`${scene.camera!.nodeId}:positionX`, pos[0])
          cache.set(`${scene.camera!.nodeId}:positionY`, pos[1])
          cache.set(`${scene.camera!.nodeId}:positionZ`, pos[2])
          cache.set(`${scene.camera!.nodeId}:rotationX`, (camPath.pathProps.rotationX as number) ?? 0)
          cache.set(`${scene.camera!.nodeId}:rotationY`, (camPath.pathProps.rotationY as number) ?? 0)
          cache.set(`${scene.camera!.nodeId}:rotationZ`, (camPath.pathProps.rotationZ as number) ?? 0)
        }
      }
    }

    // Evaluate Transform chains for path nodes — applies position + rotation from Transform nodes
    const newPaths = scene.paths.map((path) => {
      const transformIds = path.transformNodeIds ?? []
      if (transformIds.length === 0) return path

      const pos: [number, number, number] = [0, 0, 0]
      const rot = { x: 0, y: 0, z: 0 }

      for (const transformId of transformIds) {
        const tNode = nodes.find((n) => n.id === transformId)
        if (!tNode) continue
        const tMode = (tNode.data.mode as number) ?? 0

        if (tMode === 0) {
          // Translate — read tx/ty/tz, possibly overridden by connected float ports
          let tx = (tNode.data.tx as number) ?? 0
          let ty = (tNode.data.ty as number) ?? 0
          let tz = (tNode.data.tz as number) ?? 0
          for (const edge of edges) {
            if (edge.target !== transformId) continue
            const src = nodes.find((n) => n.id === edge.source)
            if (!src || (src.type !== 'time' && src.type !== 'math' && src.type !== 'input')) continue
            const val = evaluateFloatPort(src.id, edge.sourceHandle, nodes, edges, ctx, cache)
            if (val === undefined) continue
            if (edge.targetHandle === 'x') tx = val
            if (edge.targetHandle === 'y') ty = val
            if (edge.targetHandle === 'z') tz = val
          }
          pos[0] += tx; pos[1] += ty; pos[2] += tz
        } else if (tMode === 1) {
          // Rotate — read rx/ry/rz (degrees), possibly overridden by connected float ports
          let rx = (tNode.data.rx as number) ?? 0
          let ry = (tNode.data.ry as number) ?? 0
          let rz = (tNode.data.rz as number) ?? 0
          for (const edge of edges) {
            if (edge.target !== transformId) continue
            const src = nodes.find((n) => n.id === edge.source)
            if (!src || (src.type !== 'time' && src.type !== 'math' && src.type !== 'input')) continue
            const val = evaluateFloatPort(src.id, edge.sourceHandle, nodes, edges, ctx, cache)
            if (val === undefined) continue
            if (edge.targetHandle === 'x') rx = val
            if (edge.targetHandle === 'y') ry = val
            if (edge.targetHandle === 'z') rz = val
          }
          rot.x += rx; rot.y += ry; rot.z += rz
        }
      }

      const posChanged = pos[0] !== path.position[0] || pos[1] !== path.position[1] || pos[2] !== path.position[2]
      const rotChanged = rot.x !== ((path.pathProps.rotationX as number) ?? 0)
        || rot.y !== ((path.pathProps.rotationY as number) ?? 0)
        || rot.z !== ((path.pathProps.rotationZ as number) ?? 0)

      if (posChanged || rotChanged) changed = true

      return (posChanged || rotChanged)
        ? { ...path, position: pos, pathProps: { ...path.pathProps, rotationX: rot.x, rotationY: rot.y, rotationZ: rot.z } }
        : path
    })

    if (changed) {
      useSceneStore.getState().setScene({ ...scene, meshes: newMeshes, gltfObjects: newGltfObjects, paths: newPaths, lights: newLights, camera: newCamera })
    }

    // Throttled update of evaluator store for edge labels + path positions (~10fps)
    const now = performance.now()
    if (cache.size > 0 && now - lastStoreUpdate.current > 100) {
      lastStoreUpdate.current = now
      useEvaluatorStore.getState().setValues(cache)
    }
  })

  return null
}

export { LiveEvaluator }

function EnvironmentLoader() {
  const envMapDataUrl = useSceneStore((s) => s.scene.envMapDataUrl)
  const envIntensity = useSceneStore((s) => s.scene.envIntensity)
  const showEnvBackground = useSceneStore((s) => s.scene.showEnvBackground)
  const { gl, scene: threeScene } = useThree()
  const envMapRef = useRef<THREE.Texture | null>(null)

  // Load / reload when file changes
  useEffect(() => {
    if (envMapRef.current) { envMapRef.current.dispose(); envMapRef.current = null }
    threeScene.environment = null
    threeScene.background = null
    gl.toneMapping = THREE.NoToneMapping
    gl.toneMappingExposure = 1
    if (!envMapDataUrl) return

    let cancelled = false
    const pmremGen = new THREE.PMREMGenerator(gl)
    pmremGen.compileEquirectangularShader()
    const loader = new RGBELoader()
    loader.load(envMapDataUrl, (texture) => {
      if (cancelled) { texture.dispose(); pmremGen.dispose(); return }
      const rt = pmremGen.fromEquirectangular(texture)
      envMapRef.current = rt.texture
      threeScene.environment = rt.texture
      threeScene.environmentIntensity = envIntensity
      if (showEnvBackground) threeScene.background = rt.texture
      gl.toneMapping = THREE.ACESFilmicToneMapping
      gl.toneMappingExposure = 1
      texture.dispose()
      pmremGen.dispose()
    })
    return () => {
      cancelled = true
      if (envMapRef.current) { envMapRef.current.dispose(); envMapRef.current = null }
      threeScene.environment = null
      threeScene.background = null
      gl.toneMapping = THREE.NoToneMapping
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envMapDataUrl])

  // Update intensity live without reload
  useEffect(() => {
    if (threeScene.environment) threeScene.environmentIntensity = envIntensity
  }, [envIntensity, threeScene])

  // Toggle background without reload
  useEffect(() => {
    if (!threeScene.environment) return
    threeScene.background = showEnvBackground ? threeScene.environment : null
  }, [showEnvBackground, threeScene])

  return null
}

function GltfObject({
  gltf,
  editorShading,
  isEditorView,
  smoothShading,
}: {
  gltf: CompiledGLTF
  editorShading: boolean
  isEditorView: boolean
  smoothShading: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const pivotRef = useRef<THREE.Group>(null)
  const loadedRef = useRef<THREE.Group | null>(null)
  const isDragging = useRef(false)
  const rawBboxCenter = useRef<THREE.Vector3 | null>(null)
  const rawBboxMin = useRef<THREE.Vector3 | null>(null)
  // Incremented after each successful load to trigger the shading effect
  const [smoothVersion, setSmoothVersion] = useState(0)
  const t = gltf.transform

  // Cross-shaped canvas texture for origin indicator (created once)
  const crossTex = useMemo(() => {
    const s = 32
    const canvas = document.createElement('canvas')
    canvas.width = s; canvas.height = s
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(5, s / 2); ctx.lineTo(s - 5, s / 2)
    ctx.moveTo(s / 2, 5); ctx.lineTo(s / 2, s - 5)
    ctx.stroke()
    return new THREE.CanvasTexture(canvas)
  }, [])

  const wireframeOverride = useEditorStore((s) => editorShading && s.shadingMode === 'wireframe')
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const gizmoMode = useEditorStore((s) => s.gizmoMode)
  const isSelected = selectedNodeId === gltf.id
  const { controls } = useThree()

  const wireframeOverrideRef = useRef(wireframeOverride)
  wireframeOverrideRef.current = wireframeOverride

  function applyWireframeToScene(scene: THREE.Group, wf: boolean) {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material
        const set = (m: THREE.Material) => {
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) {
            m.wireframe = wf
          }
        }
        if (Array.isArray(mat)) mat.forEach(set)
        else set(mat)
      }
    })
  }

  // Always-fresh centering params — avoids stale closures in async callbacks
  const centeringRef = useRef({ centerMode: gltf.centerMode, originX: gltf.originX, originY: gltf.originY, originZ: gltf.originZ })
  centeringRef.current = { centerMode: gltf.centerMode, originX: gltf.originX, originY: gltf.originY, originZ: gltf.originZ }

  // Apply centering using cached raw bbox (computed before scene is added to any parent)
  function applyCenterToScene(scene: THREE.Group) {
    const { centerMode, originX, originY, originZ } = centeringRef.current
    scene.position.set(0, 0, 0)
    if (centerMode === 1 && rawBboxCenter.current) {
      const c = rawBboxCenter.current
      scene.position.set(-c.x, -c.y, -c.z)
    } else if (centerMode === 2 && rawBboxCenter.current && rawBboxMin.current) {
      const c = rawBboxCenter.current
      scene.position.set(-c.x, -rawBboxMin.current.y, -c.z)
    } else if (centerMode === 3) {
      scene.position.set(-originX, -originY, -originZ)
    }
  }

  // Load GLB/GLTF only when fileDataUrl changes
  useEffect(() => {
    if (!gltf.fileDataUrl || !groupRef.current) return
    let cancelled = false

    const manager = new THREE.LoadingManager()

    // For multi-file .gltf: map relative filenames → data URLs
    if (gltf.extraFiles && gltf.extraFiles.length > 0) {
      const urlMap = new Map(gltf.extraFiles.map((f) => [f.name, f.dataUrl]))
      manager.setURLModifier((url) => {
        const filename = url.split('/').pop()?.split('?')[0] ?? ''
        return urlMap.get(filename) ?? url
      })
    }

    const loader = new GLTFLoader(manager)
    loader.load(gltf.fileDataUrl, (result) => {
      if (cancelled || !groupRef.current) return
      if (loadedRef.current) groupRef.current.remove(loadedRef.current)

      // Compute raw bbox BEFORE adding to parent — keeps it in scene-local space
      result.scene.position.set(0, 0, 0)
      result.scene.updateMatrixWorld(true)
      const rawBox = new THREE.Box3().setFromObject(result.scene, true)
      if (!rawBox.isEmpty()) {
        rawBboxCenter.current = rawBox.getCenter(new THREE.Vector3())
        rawBboxMin.current = rawBox.min.clone()
      } else {
        rawBboxCenter.current = null
        rawBboxMin.current = null
      }

      loadedRef.current = result.scene
      groupRef.current.add(result.scene)
      applyCenterToScene(result.scene)
      applyWireframeToScene(result.scene, wireframeOverrideRef.current)
      setSmoothVersion((v) => v + 1)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.fileDataUrl])

  // Re-center without reloading when mode or manual origin changes
  useEffect(() => {
    if (!loadedRef.current) return
    applyCenterToScene(loadedRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.centerMode, gltf.originX, gltf.originY, gltf.originZ])

  // Apply smooth shading after load or when toggle changes
  useEffect(() => {
    if (!loadedRef.current) return
    loadedRef.current.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => {
        (m as THREE.MeshStandardMaterial).flatShading = !smoothShading
        m.needsUpdate = true
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smoothShading, smoothVersion])

  // Apply wireframe override only when shadingMode changes
  useEffect(() => {
    if (!loadedRef.current) return
    applyWireframeToScene(loadedRef.current, wireframeOverride)
  }, [wireframeOverride])

  // Sync transform from compiled scene
  useFrame(() => {
    if (!isDragging.current && groupRef.current) {
      groupRef.current.position.set(t.position[0], t.position[1], t.position[2])
      groupRef.current.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2])
      groupRef.current.scale.set(t.scale[0], t.scale[1], t.scale[2])
    }
  })

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return

    const gs = useGraphStore.getState()
    const RAD2DEG = 180 / Math.PI
    const pos = groupRef.current.position
    const rot = groupRef.current.rotation
    const scale = groupRef.current.scale

    const modeIndex = gizmoMode === 'translate' ? 0 : gizmoMode === 'rotate' ? 1 : 2
    const transformNode = gltf.transformNodeIds
      .map((id) => gs.nodes.find((n) => n.id === id))
      .find((n) => n?.type === 'transform' && ((n.data.mode as number) ?? 0) === modeIndex)

    if (transformNode) {
      if (gizmoMode === 'translate') {
        gs.updateNodeData(transformNode.id, { tx: pos.x, ty: pos.y, tz: pos.z })
      } else if (gizmoMode === 'rotate') {
        gs.updateNodeData(transformNode.id, { rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG })
      } else if (gizmoMode === 'scale') {
        gs.updateNodeData(transformNode.id, { sx: scale.x, sy: scale.y, sz: scale.z })
      }
    } else {
      const baseData = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
      const modeData =
        gizmoMode === 'translate' ? { mode: 0, tx: pos.x, ty: pos.y, tz: pos.z } :
        gizmoMode === 'rotate' ? { mode: 1, rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG } :
        { mode: 2, sx: scale.x, sy: scale.y, sz: scale.z }

      const lastId = gltf.transformNodeIds.length > 0
        ? gltf.transformNodeIds[gltf.transformNodeIds.length - 1]
        : gltf.id
      const outEdge = gs.edges.find((e) => e.source === lastId && e.sourceHandle === 'mesh')
      if (!outEdge) return

      const gltfGraphNode = gs.nodes.find((n) => n.id === gltf.id)
      const newId = `transform-${Date.now()}`

      gs.removeEdge(outEdge.id)
      gs.addNode({
        id: newId,
        type: 'transform',
        position: { x: (gltfGraphNode?.position.x ?? 0) + 220, y: gltfGraphNode?.position.y ?? 0 },
        data: { ...baseData, ...modeData },
      })
      gs.addEdge({ id: `e-${lastId}-${newId}`, source: lastId, sourceHandle: 'mesh', target: newId, targetHandle: 'mesh' })
      gs.addEdge({ id: `e-${newId}-${outEdge.target}`, source: newId, sourceHandle: 'mesh', target: outEdge.target, targetHandle: outEdge.targetHandle })
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      isDragging.current = false
    }))
  }

  const canGizmo = isEditorView && isSelected

  return (
    <>
      <group
        ref={groupRef}
        onClick={(e) => {
          if (!isEditorView) return
          e.stopPropagation()
          setSelectedNode(isSelected ? null : gltf.id)
        }}
      >
        {/* Origin indicator — fixed screen-space cross, always visible in editor */}
        <group ref={pivotRef}>
          {isEditorView && (
            <points renderOrder={999}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, 0]), 3]} />
              </bufferGeometry>
              <pointsMaterial
                size={14}
                sizeAttenuation={false}
                color="#ff3300"
                map={crossTex}
                transparent
                alphaTest={0.1}
                depthTest={false}
              />
            </points>
          )}
        </group>
      </group>
      {canGizmo && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode={gizmoMode}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

function PathObject({ path }: { path: CompiledPath }) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)
  const { controls } = useThree()

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const gizmoMode = useEditorStore((s) => s.gizmoMode)
  const isSelected = selectedNodeId === path.id

  const DEG2RAD = Math.PI / 180
  const RAD2DEG = 180 / Math.PI

  useFrame(() => {
    if (!isDragging.current && groupRef.current) {
      groupRef.current.position.set(path.position[0], path.position[1], path.position[2])
      groupRef.current.rotation.set(
        ((path.pathProps.rotationX as number) ?? 0) * DEG2RAD,
        ((path.pathProps.rotationY as number) ?? 0) * DEG2RAD,
        ((path.pathProps.rotationZ as number) ?? 0) * DEG2RAD,
      )
    }
  })

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return

    const gs = useGraphStore.getState()
    const pos = groupRef.current.position
    const rot = groupRef.current.rotation
    const modeIndex = gizmoMode === 'translate' ? 0 : gizmoMode === 'rotate' ? 1 : 0

    // Find existing Transform node for this mode in the path's transform chain
    const transformNode = (path.transformNodeIds ?? [])
      .map((id) => gs.nodes.find((n) => n.id === id))
      .find((n) => n?.type === 'transform' && ((n.data.mode as number) ?? 0) === modeIndex)

    if (transformNode) {
      if (gizmoMode === 'translate') {
        gs.updateNodeData(transformNode.id, { tx: pos.x, ty: pos.y, tz: pos.z })
      } else if (gizmoMode === 'rotate') {
        gs.updateNodeData(transformNode.id, { rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG })
      }
    } else {
      // Auto-create and insert a new Transform node into the path chain
      const baseData = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
      const modeData =
        gizmoMode === 'translate' ? { mode: 0, tx: pos.x, ty: pos.y, tz: pos.z } :
        gizmoMode === 'rotate' ? { mode: 1, rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG } :
        { mode: 0, tx: pos.x, ty: pos.y, tz: pos.z }

      // Insert after the last node in the transform chain (or after the path itself)
      const lastId = (path.transformNodeIds ?? []).length > 0
        ? path.transformNodeIds[path.transformNodeIds.length - 1]
        : path.id
      const outEdge = gs.edges.find((e) => e.source === lastId && e.sourceHandle === 'path')
      const pathGraphNode = gs.nodes.find((n) => n.id === path.id)
      const newId = `transform-${Date.now()}`

      if (outEdge) gs.removeEdge(outEdge.id)
      gs.addNode({
        id: newId,
        type: 'transform',
        position: { x: (pathGraphNode?.position.x ?? 0) + 220, y: pathGraphNode?.position.y ?? 0 },
        data: { ...baseData, ...modeData },
      })
      gs.addEdge({ id: `e-${lastId}-${newId}`, source: lastId, sourceHandle: 'path', target: newId, targetHandle: 'path' })
      if (outEdge) {
        gs.addEdge({ id: `e-${newId}-${outEdge.target}`, source: newId, sourceHandle: 'path', target: outEdge.target, targetHandle: outEdge.targetHandle })
      }
    }

    requestAnimationFrame(() => requestAnimationFrame(() => { isDragging.current = false }))
  }

  // Path line points relative to group origin (no offset — group handles position)
  const segs = (path.pathProps.segments as number) ?? 64
  const positions = useMemo(() => {
    // Compute points in local space (no offset, no rotation) — group handles both
    const zeroPath = {
      ...path,
      position: [0, 0, 0] as [number, number, number],
      pathProps: { ...path.pathProps, rotationX: 0, rotationY: 0, rotationZ: 0 },
    }
    const arr = new Float32Array((segs + 1) * 3)
    for (let i = 0; i <= segs; i++) {
      const [x, y, z] = evaluatePathPosition(zeroPath, i / segs)
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z
    }
    return arr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.pathType, path.pathProps.length, path.pathProps.radius, path.pathProps.sweepAngle,
      path.pathProps.lineAxis, path.pathProps.segments,
      path.pathProps.rotationX, path.pathProps.rotationY, path.pathProps.rotationZ])

  const lineColor = isSelected ? '#ff8800' : '#7C3AED'

  return (
    <>
      <group ref={groupRef} position={path.position}>
        {/* Clickable origin marker */}
        <mesh
          renderOrder={999}
          onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : path.id) }}
        >
          <octahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial color={lineColor} wireframe depthTest={false} />
        </mesh>
        {/* Path line */}
        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={lineColor} />
        </line>
      </group>
      {isSelected && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode={gizmoMode === 'scale' ? 'translate' : gizmoMode}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

export function SceneRenderer({
  editorShading = false,
  isEditorView = false,
}: {
  editorShading?: boolean
  isEditorView?: boolean
}) {
  const scene = useSceneStore((s) => s.scene)

  return (
    <>
      <EnvironmentLoader />
      {isEditorView && scene.paths.map((p) => (
        <PathObject key={p.id} path={p} />
      ))}
      {scene.lights.map((light) => (
        <LightObject key={light.id} light={light} isEditorView={isEditorView} meshes={scene.meshes} />
      ))}
      {scene.meshes.map((mesh) => (
        <MeshObject key={mesh.id} mesh={mesh} editorShading={editorShading} isEditorView={isEditorView} />
      ))}
      {scene.gltfObjects.map((gltf) => (
        <GltfObject key={gltf.id} gltf={gltf} editorShading={editorShading} isEditorView={isEditorView} smoothShading={scene.smoothShading} />
      ))}
      {isEditorView && scene.camera && (
        <CameraIcon camera={scene.camera} />
      )}
    </>
  )
}
