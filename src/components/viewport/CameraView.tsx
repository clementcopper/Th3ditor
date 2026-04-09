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

    // World-Y up feels natural (scene stays upright). Fallback to world-X when tangent is
    // nearly parallel to world-Y (XY/YZ circles at top/bottom). World-X is ≈ the same as
    // what world-Y produces just outside the threshold, so the transition is smooth (<3°).
    // Previously used world-Z as fallback — that caused a ~90° jump at the threshold.
    const worldUp = new THREE.Vector3(0, 1, 0)
    const up = Math.abs(dir.dot(worldUp)) > 0.999
      ? new THREE.Vector3(1, 0, 0)
      : worldUp

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
      {/* Always provide a valid rotation — CameraPathLookAhead overrides via quaternion each frame */}
      <PerspectiveCamera
        makeDefault
        position={camera.position}
        rotation={[
          camera.rotation[0] * DEG2RAD,
          camera.rotation[1] * DEG2RAD,
          camera.rotation[2] * DEG2RAD,
        ]}
        fov={camera.fov}
        near={0.1}
        far={1000}
      />
      {isTarget && <CameraLookAt targetNodeId={camera.targetNodeId!} />}
      {hasPathLookAhead && <CameraPathLookAhead />}
      <SceneRenderer />
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
