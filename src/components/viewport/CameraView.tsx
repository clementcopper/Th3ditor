import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { SceneRenderer } from './SceneRenderer'
import { useSceneStore } from '../../store/scene-store'

function CameraViewContents() {
  const camera = useSceneStore((s) => s.scene.camera)

  if (!camera) return null

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={camera.position}
        fov={camera.fov}
        near={0.1}
        far={1000}
      />
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
        <color attach="background" args={['oklch(0.16 0.008 48)']} />
        <CameraViewContents />
      </Canvas>
    </div>
  )
}
