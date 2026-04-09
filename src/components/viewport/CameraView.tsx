import { useFrame, useThree, Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { SceneRenderer } from './SceneRenderer'
import { useSceneStore } from '../../store/scene-store'

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

function CameraViewContents() {
  const camera = useSceneStore((s) => s.scene.camera)

  if (!camera) return null

  const DEG2RAD = Math.PI / 180
  const isTarget = camera.mode === 1 && !!camera.targetNodeId

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={camera.position}
        rotation={isTarget ? undefined : [
          camera.rotation[0] * DEG2RAD,
          camera.rotation[1] * DEG2RAD,
          camera.rotation[2] * DEG2RAD,
        ]}
        fov={camera.fov}
        near={0.1}
        far={1000}
      />
      {isTarget && <CameraLookAt targetNodeId={camera.targetNodeId!} />}
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
