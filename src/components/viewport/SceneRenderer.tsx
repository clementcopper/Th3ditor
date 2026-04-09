import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/scene-store'
import { useGraphStore } from '../../store/graph-store'
import { useAnimationStore } from '../../store/animation-store'
import { useEditorStore } from '../../store/editor-store'
import { evaluateFloatPort, type EvalContext } from '../../graph-engine/evaluator'
import { getNodeDef } from '../../graph-engine/node-registry'
import { useEvaluatorStore } from '../../store/evaluator-store'
import { evaluatePathPosition } from '../../graph-engine/path-utils'
import type { CompiledMesh, CompiledLight, CompiledCamera, CompiledPath } from '../../types/node-graph'

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
          // Push live position into evaluator store for PropertiesPanel display
          cache.set(`${light.id}:positionX`, pos[0])
          cache.set(`${light.id}:positionY`, pos[1])
          cache.set(`${light.id}:positionZ`, pos[2])
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
          // Push live position into evaluator store for PropertiesPanel display
          cache.set(`${scene.camera!.nodeId}:positionX`, pos[0])
          cache.set(`${scene.camera!.nodeId}:positionY`, pos[1])
          cache.set(`${scene.camera!.nodeId}:positionZ`, pos[2])
        }
      }
    }

    if (changed) {
      useSceneStore.getState().setScene({ meshes: newMeshes, paths: scene.paths, lights: newLights, camera: newCamera })
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

function PathObject({ path }: { path: CompiledPath }) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)
  const { controls } = useThree()

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const isSelected = selectedNodeId === path.id

  useFrame(() => {
    if (!isDragging.current && groupRef.current) {
      groupRef.current.position.set(path.position[0], path.position[1], path.position[2])
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
    updateNodeData(path.id, { positionX: p.x, positionY: p.y, positionZ: p.z })
    requestAnimationFrame(() => requestAnimationFrame(() => { isDragging.current = false }))
  }

  // Path line points relative to group origin (no offset — group handles position)
  const segs = (path.pathProps.segments as number) ?? 64
  const positions = useMemo(() => {
    const zeroPath = { ...path, position: [0, 0, 0] as [number, number, number] }
    const arr = new Float32Array((segs + 1) * 3)
    for (let i = 0; i <= segs; i++) {
      const [x, y, z] = evaluatePathPosition(zeroPath, i / segs)
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z
    }
    return arr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.pathType, path.pathProps.length, path.pathProps.radius, path.pathProps.sweepAngle,
      path.pathProps.lineAxis, path.pathProps.circleAxis, path.pathProps.segments])

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
          mode="translate"
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
      {isEditorView && scene.paths.map((p) => (
        <PathObject key={p.id} path={p} />
      ))}
      {scene.lights.map((light) => (
        <LightObject key={light.id} light={light} isEditorView={isEditorView} meshes={scene.meshes} />
      ))}
      {scene.meshes.map((mesh) => (
        <MeshObject key={mesh.id} mesh={mesh} editorShading={editorShading} isEditorView={isEditorView} />
      ))}
      {isEditorView && scene.camera && (
        <CameraIcon camera={scene.camera} />
      )}
    </>
  )
}
