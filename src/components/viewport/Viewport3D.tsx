import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { SceneRenderer } from './SceneRenderer'

export function Viewport3D() {
  return (
    <div className="w-full h-full bg-[#1a1a2e]">
      <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
        <color attach="background" args={['#1a1a2e']} />

        {/* Lights */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        {/* Grid */}
        <Grid
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#2a2a4a"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#3a3a5a"
          fadeDistance={15}
          infiniteGrid
        />

        {/* Scene from compiled graph */}
        <SceneRenderer />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
