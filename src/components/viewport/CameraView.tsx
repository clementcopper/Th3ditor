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
 * Euler conversion of lookAt matrices causes gimbal-lock discontinuities on
 * XY / YZ orbits — quaternion application is always smooth.
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

    // Use orbit-plane normal as up — tangent is always ⊥ up, no gimbal lock possible
    // World-Y up gives the most natural-looking orbit (camera yaws/pitches visibly).
    // Fallback to world-Z when tangent is nearly vertical to avoid lookAt singularity.
    const worldUp = new THREE.Vector3(0, 1, 0)
    const up = Math.abs(dir.dot(worldUp)) > 0.999
      ? new THREE.Vector3(0, 0, -1)
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
