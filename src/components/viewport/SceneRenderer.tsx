import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSceneStore } from '../../store/scene-store'
import { useGraphStore } from '../../store/graph-store'
import { useAnimationStore } from '../../store/animation-store'
import { evaluateFloatPort, type EvalContext } from '../../graph-engine/evaluator'
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
      {mesh.geometryType === 'geometry/box' && (
        <boxGeometry args={[gp.width as number, gp.height as number, gp.depth as number]} />
      )}
      {mesh.geometryType === 'geometry/sphere' && (
        <sphereGeometry args={[gp.radius as number, gp.widthSegments as number, gp.heightSegments as number]} />
      )}
      {mesh.geometryType === 'geometry/plane' && (
        <planeGeometry args={[gp.width as number, gp.height as number]} />
      )}
      {mesh.geometryType === 'geometry/torus' && (
        <torusGeometry args={[gp.radius as number, gp.tube as number, 16, 48]} />
      )}
      {mesh.geometryType === 'geometry/cylinder' && (
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
    case 'light/ambient':
      return <ambientLight color={color} intensity={intensity} />
    case 'light/directional':
      return <directionalLight color={color} intensity={intensity} position={pos} />
    case 'light/point':
      return <pointLight color={color} intensity={intensity} position={pos} distance={(p.distance as number) ?? 0} />
    default:
      return null
  }
}

/**
 * LiveEvaluator runs inside the R3F render loop.
 * It evaluates all dynamic float connections (time/math/input nodes)
 * and re-compiles the scene with the evaluated values.
 */
function LiveEvaluator() {
  const mouseRef = useRef({ x: 0, y: 0 })
  const { size } = useThree()

  // Track mouse position
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  useFrame((_, delta) => {
    const animStore = useAnimationStore.getState()
    if (!animStore.playing) return

    const newElapsed = animStore.elapsed + delta
    animStore.setElapsed(newElapsed)

    const nodes = useGraphStore.getState().nodes
    const edges = useGraphStore.getState().edges
    const scene = useSceneStore.getState().scene

    // Check if any dynamic nodes exist
    const hasDynamic = nodes.some(
      (n) => n.type.startsWith('time/') || n.type.startsWith('input/') || n.type.startsWith('math/'),
    )
    if (!hasDynamic) return

    const ctx: EvalContext = {
      elapsed: newElapsed,
      delta,
      mouseX: mouseRef.current.x,
      mouseY: mouseRef.current.y,
      screenW: size.width,
      screenH: size.height,
    }

    const cache = new Map<string, number>()

    // Evaluate float inputs only on nodes that belong to each mesh's chain
    let changed = false
    const newMeshes = scene.meshes.map((mesh) => {
      let meshChanged = false
      const matProps = { ...mesh.materialProps }
      const geoProps = { ...mesh.geometryProps }
      const transform = { ...mesh.transform }

      // IDs of nodes that belong to this mesh
      const ownedNodeIds = new Set([mesh.id, mesh.geometryNodeId, mesh.materialNodeId, ...mesh.transformNodeIds])

      for (const edge of edges) {
        // Only consider edges targeting nodes owned by this mesh
        if (!ownedNodeIds.has(edge.target)) continue

        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue

        // Only evaluate if source is a dynamic float producer
        if (!sourceNode.type.startsWith('time/') && !sourceNode.type.startsWith('math/') && !sourceNode.type.startsWith('input/')) continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        const targetNode = nodes.find((n) => n.id === edge.target)
        if (!targetNode) continue

        if (targetNode.type.startsWith('material/')) {
          matProps[edge.targetHandle] = val
          meshChanged = true
        } else if (targetNode.type.startsWith('geometry/')) {
          geoProps[edge.targetHandle] = val
          meshChanged = true
        } else if (targetNode.type.startsWith('transform/')) {
          const prop = edge.targetHandle
          if (targetNode.type === 'transform/translate') {
            if (prop === 'x') { transform.position = [...transform.position]; transform.position[0] = val; meshChanged = true }
            if (prop === 'y') { transform.position = [...transform.position]; transform.position[1] = val; meshChanged = true }
            if (prop === 'z') { transform.position = [...transform.position]; transform.position[2] = val; meshChanged = true }
          } else if (targetNode.type === 'transform/rotate') {
            const DEG2RAD = Math.PI / 180
            if (prop === 'x') { transform.rotation = [...transform.rotation]; transform.rotation[0] = val * DEG2RAD; meshChanged = true }
            if (prop === 'y') { transform.rotation = [...transform.rotation]; transform.rotation[1] = val * DEG2RAD; meshChanged = true }
            if (prop === 'z') { transform.rotation = [...transform.rotation]; transform.rotation[2] = val * DEG2RAD; meshChanged = true }
          } else if (targetNode.type === 'transform/scale') {
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
        if (!sourceNode.type.startsWith('time/') && !sourceNode.type.startsWith('math/') && !sourceNode.type.startsWith('input/')) continue

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
