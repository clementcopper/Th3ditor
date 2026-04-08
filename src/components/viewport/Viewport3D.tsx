import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { SceneRenderer, LiveEvaluator } from './SceneRenderer'
import { SceneExplorer } from './SceneExplorer'
import { useEditorStore } from '../../store/editor-store'
import { useAnimationStore } from '../../store/animation-store'

function PlaybackOverlay() {
  const playing = useAnimationStore((s) => s.playing)
  const toggle = useAnimationStore((s) => s.toggle)
  const reset = useAnimationStore((s) => s.reset)
  const elapsed = useAnimationStore((s) => s.elapsed)

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 pointer-events-auto">
      <div
        className="flex items-center gap-1 px-2 py-1 border border-border-default"
        style={{ background: 'color-mix(in oklch, var(--color-surface-base) 85%, transparent)' }}
      >
        <button
          onClick={toggle}
          className="text-[10px] font-semibold text-text-primary hover:text-accent transition-colors cursor-pointer px-1"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div className="w-px h-3 bg-border-default" />
        <button
          onClick={reset}
          className="text-[10px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer px-1"
        >
          ↺
        </button>
        <div className="w-px h-3 bg-border-default" />
        <span className="text-[9px] font-mono text-text-muted w-10 text-right">{elapsed.toFixed(1)}s</span>
      </div>
    </div>
  )
}

function ViewportControlsOverlay() {
  const shadingMode = useEditorStore((s) => s.shadingMode)
  const setShadingMode = useEditorStore((s) => s.setShadingMode)
  const projectionMode = useEditorStore((s) => s.projectionMode)
  const setProjectionMode = useEditorStore((s) => s.setProjectionMode)
  const setGizmoMode = useEditorStore((s) => s.setGizmoMode)

  // T / R / S keyboard shortcuts for gizmo mode (skip when typing in inputs)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 't' || e.key === 'T') setGizmoMode('translate')
      else if (e.key === 'r' || e.key === 'R') setGizmoMode('rotate')
      else if (e.key === 's' || e.key === 'S') setGizmoMode('scale')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setGizmoMode])

  const overlayBg = { background: 'color-mix(in oklch, var(--color-surface-base) 85%, transparent)' }

  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 pointer-events-auto">
      {/* Shading */}
      <div className="flex items-center border border-border-default" style={overlayBg}>
        {(['shaded', 'wireframe'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setShadingMode(mode)}
            className="px-2 py-1 text-[9px] font-semibold transition-colors cursor-pointer capitalize"
            style={{
              color: shadingMode === mode ? 'var(--color-accent)' : 'var(--color-text-muted)',
              background: shadingMode === mode ? 'color-mix(in oklch, var(--color-accent) 12%, transparent)' : undefined,
            }}
          >
            {mode}
          </button>
        ))}
      </div>
      {/* Projection */}
      <div className="flex items-center border border-border-default" style={overlayBg}>
        {(['perspective', 'orthographic'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setProjectionMode(mode)}
            className="px-2 py-1 text-[9px] font-semibold transition-colors cursor-pointer capitalize"
            style={{
              color: projectionMode === mode ? 'var(--color-accent)' : 'var(--color-text-muted)',
              background: projectionMode === mode ? 'color-mix(in oklch, var(--color-accent) 12%, transparent)' : undefined,
            }}
          >
            {mode === 'perspective' ? 'Persp' : 'Ortho'}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Viewport3D() {
  const projectionMode = useEditorStore((s) => s.projectionMode)

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--color-surface-viewport)' }}>
      {/* Overlays */}
      <SceneExplorer />
      <ViewportControlsOverlay />
      <PlaybackOverlay />

      {/* 3D Canvas */}
      <Canvas>
        <color attach="background" args={['#1e1b18']} />

        {projectionMode === 'perspective'
          ? <PerspectiveCamera makeDefault position={[3, 2, 3]} fov={50} />
          : <OrthographicCamera makeDefault position={[3, 2, 3]} zoom={80} />
        }

        {/* Editor ambient lights */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        <Grid
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#4a4540"
          sectionSize={2}
          sectionThickness={1.2}
          sectionColor="#6a6055"
          fadeDistance={40}
          fadeStrength={0.3}
          infiniteGrid
        />

        <SceneRenderer editorShading isEditorView />
        <LiveEvaluator />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
