import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSceneStore } from '../../store/scene-store'
import { useGraphStore } from '../../store/graph-store'
import { useAnimationStore } from '../../store/animation-store'
import { evaluateFloatPort, type EvalContext } from '../../graph-engine/evaluator'
import { getNodeDef } from '../../graph-engine/node-registry'
import { useEvaluatorStore } from '../../store/evaluator-store'
import type { CompiledMesh, CompiledLight } from '../../types/node-graph'

function toThreeColor(color?: unknown): string {
  const c = color as [number, number, number, number] | undefined
  if (!c) return '#ffffff'
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`
}

function MeshObject({ mesh }: { mesh: CompiledMesh }) {
  const gp = mesh.geometryProps
  const mp = mesh.materialProps
  const t = mesh.transform

  return (
    <mesh position={t.position} rotation={t.rotation} scale={t.scale}>
      {mesh.geometryType === 'box' && (
        <boxGeometry args={[gp.width as number, gp.height as number, gp.depth as number]} />
      )}
      {mesh.geometryType === 'sphere' && (
        <sphereGeometry args={[gp.radius as number, gp.widthSegments as number, gp.heightSegments as number]} />
      )}
      {mesh.geometryType === 'plane' && (
        <planeGeometry args={[gp.width as number, gp.height as number]} />
      )}
      {mesh.geometryType === 'torus' && (
        <torusGeometry args={[gp.radius as number, gp.tube as number, 16, 48]} />
      )}
      {mesh.geometryType === 'cylinder' && (
        <cylinderGeometry args={[gp.radiusTop as number, gp.radiusBottom as number, gp.height as number, gp.radialSegments as number]} />
      )}

      <meshStandardMaterial
        color={toThreeColor(mp.color)}
        metalness={(mp.metalness as number) ?? 0.1}
        roughness={(mp.roughness as number) ?? 0.5}
        wireframe={(mp.wireframe as boolean) ?? false}
      />
    </mesh>
  )
}

function LightObject({ light }: { light: CompiledLight }) {
  const p = light.props
  const color = toThreeColor(p.color)
  const intensity = (p.intensity as number) ?? 1
  const pos: [number, number, number] = [
    (p.positionX as number) ?? 0,
    (p.positionY as number) ?? 0,
    (p.positionZ as number) ?? 0,
  ]

  switch (light.lightType) {
    case 'ambient':
      return <ambientLight color={color} intensity={intensity} />
    case 'directional':
      return <directionalLight color={color} intensity={intensity} position={pos} />
    case 'point':
      return <pointLight color={color} intensity={intensity} position={pos} distance={(p.distance as number) ?? 0} />
    default:
      return null
  }
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

    // Throttled update of evaluator store for edge labels (~10fps)
    const now = performance.now()
    if (cache.size > 0 && now - lastStoreUpdate.current > 100) {
      lastStoreUpdate.current = now
      useEvaluatorStore.getState().setValues(cache)
    }

    // Scene updates only when playing
    if (!playing) return

    const hasDynamic = nodes.some(
      (n) => n.type === 'time' || n.type === 'input' || n.type === 'math',
    )
    if (!hasDynamic) return

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
          matProps[edge.targetHandle] = val
          meshChanged = true
        } else if (targetNode.type === 'geometry') {
          geoProps[edge.targetHandle] = val
          meshChanged = true
        } else if (targetNode.type === 'transform') {
          const targetDef = getNodeDef(targetNode.type)
          const targetProps = { ...(targetDef?.defaults ?? {}), ...targetNode.data }
          const mode = (targetProps.mode as number) ?? 0
          const prop = edge.targetHandle

          if (mode === 0) {
            // Translate
            if (prop === 'x') { transform.position = [...transform.position]; transform.position[0] = val; meshChanged = true }
            if (prop === 'y') { transform.position = [...transform.position]; transform.position[1] = val; meshChanged = true }
            if (prop === 'z') { transform.position = [...transform.position]; transform.position[2] = val; meshChanged = true }
          } else if (mode === 1) {
            // Rotate
            const DEG2RAD = Math.PI / 180
            if (prop === 'x') { transform.rotation = [...transform.rotation]; transform.rotation[0] = val * DEG2RAD; meshChanged = true }
            if (prop === 'y') { transform.rotation = [...transform.rotation]; transform.rotation[1] = val * DEG2RAD; meshChanged = true }
            if (prop === 'z') { transform.rotation = [...transform.rotation]; transform.rotation[2] = val * DEG2RAD; meshChanged = true }
          } else if (mode === 2) {
            // Scale
            if (prop === 'x') { transform.scale = [...transform.scale]; transform.scale[0] = val; meshChanged = true }
            if (prop === 'y') { transform.scale = [...transform.scale]; transform.scale[1] = val; meshChanged = true }
            if (prop === 'z') { transform.scale = [...transform.scale]; transform.scale[2] = val; meshChanged = true }
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

      for (const edge of edges) {
        if (edge.target !== light.id) continue

        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        props[edge.targetHandle] = val
        lightChanged = true
      }

      if (lightChanged) {
        changed = true
        return { ...light, props }
      }
      return light
    })

    if (changed) {
      useSceneStore.getState().setScene({ meshes: newMeshes, lights: newLights })
    }
  })

  return null
}

export function SceneRenderer() {
  const scene = useSceneStore((s) => s.scene)

  return (
    <>
      <LiveEvaluator />
      {scene.lights.map((light) => (
        <LightObject key={light.id} light={light} />
      ))}
      {scene.meshes.map((mesh) => (
        <MeshObject key={mesh.id} mesh={mesh} />
      ))}
    </>
  )
}
