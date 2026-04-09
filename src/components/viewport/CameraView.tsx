import { useFrame, useThree, Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { SceneRenderer } from './SceneRenderer'
import { useSceneStore } from '../../store/scene-store'
import { evaluatePathTangent } from '../../graph-engine/path-utils'

function CameraLookAt({ targetNodeId }: { targetNodeId: string }) {
  const { camera } = useThree()

  useFrame(() => {
    const scene = useSceneStore.getState().scene
    const target = scene.meshes.find((m) => m.id === targetNodeId)
    if (!target) return
    const [x, y, z] = target.transform.position
    camera.lookAt(x, y, z)
  })

  return null
}

/**
 * Applies Look Ahead orientation directly as a quaternion, bypassing euler angles.
 * Uses the orbit-plane normal as up — the tangent of a circle path is always ⊥ to the
 * plane normal, so lookAt is never degenerate and the quaternion is smooth for all θ.
 */
function CameraPathLookAhead() {
  const { camera } = useThree()

  useFrame(() => {
    const scene = useSceneStore.getState().scene
    const cam = scene.camera
    if (!cam?.pathNodeId || !cam.pathLookAhead) return

    const path = scene.paths.find((p) => p.id === cam.pathNodeId)
    if (!path) return

    const t = cam.pathProgress ?? 0
    const tangent = evaluatePathTangent(path, t)
    const dir = new THREE.Vector3(tangent[0], tangent[1], tangent[2]).normalize()

    // Plane-normal as up: for circle/arc paths the tangent is always ⊥ to the plane
    // normal, so lookAt is never degenerate and the quaternion is continuous for all θ.
    // World-Y based up is impossible for vertical circles (XY/YZ) — any such choice
    // produces a 180° flip per half-orbit (the up vector has period π, not 2π).
    const planeAxis = (path.pathProps?.circleAxis as number) ?? 1
    const up =
      path.pathType !== 'line'
        ? planeAxis === 0
          ? new THREE.Vector3(0, 0, -1)  // XY plane
          : planeAxis === 2
            ? new THREE.Vector3(1, 0, 0) // YZ plane
            : new THREE.Vector3(0, 1, 0) // XZ plane
        : new THREE.Vector3(0, 1, 0)     // line → world up

    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, up)
    camera.quaternion.setFromRotationMatrix(m)
  })

  return null
}

function CameraViewContents() {
  const camera = useSceneStore((s) => s.scene.camera)

  if (!camera) return null

  const DEG2RAD = Math.PI / 180
  const isTarget = camera.mode === 1 && !!camera.targetNodeId
  const hasPathLookAhead = !!camera.pathNodeId && !!camera.pathLookAhead

  return (
    <>
      {/* When look-ahead or target mode is active, do NOT pass rotation —
          it would override the quaternion set by CameraPathLookAhead / CameraLookAt each frame */}
      <PerspectiveCamera
        makeDefault
        position={camera.position}
        {...(!(hasPathLookAhead || isTarget) ? {
          rotation: [
            camera.rotation[0] * DEG2RAD,
            camera.rotation[1] * DEG2RAD,
            camera.rotation[2] * DEG2RAD,
          ],
        } : {})}
        fov={camera.fov}
        near={0.1}
        far={1000}
      />
      {isTarget && <CameraLookAt targetNodeId={camera.targetNodeId!} />}
      <SceneRenderer />
      {/* Must be after SceneRenderer so its useFrame runs after LiveEvaluator,
          ensuring the quaternion override is the last write before gl.render() */}
      {hasPathLookAhead && <CameraPathLookAhead />}
    </>
  )
}

export function CameraView() {
  const hasCamera = useSceneStore((s) => !!s.scene.camera)

  return (
    <div className="w-full h-full relative" style={{ background: 'oklch(0.16 0.008 48)' }}>
      {!hasCamera && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-xs text-text-muted">No Camera Node</span>
        </div>
      )}
      <Canvas>
        <color attach="background" args={['#191614']} />
        <CameraViewContents />
      </Canvas>
    </div>
  )
}
