import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { SceneRenderer, LiveEvaluator } from './SceneRenderer'
import { SceneExplorer } from './SceneExplorer'
import { useEditorStore } from '../../store/editor-store'
import { useAnimationStore } from '../../store/animation-store'

// Module-level refs shared between HTML overlays and Canvas components
const viewCubeInnerRef: { current: HTMLDivElement | null } = { current: null }

// Saved camera state — updated every frame, used to restore position after projection switch
const savedCameraState = {
  position: [3, 2, 3] as [number, number, number],
  up: [0, 1, 0] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
}

function PlaybackOverlay() {
  const playing = useAnimationStore((s) => s.playing)
  const play = useAnimationStore((s) => s.play)
  const pause = useAnimationStore((s) => s.pause)
  const stop = useAnimationStore((s) => s.stop)
  const elapsed = useAnimationStore((s) => s.elapsed)

  const overlayBg = { background: 'color-mix(in oklch, var(--color-surface-base) 85%, transparent)' }

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 pointer-events-auto">
      <div
        className="flex items-center gap-1 px-2 py-1 border border-border-default"
        style={overlayBg}
      >
        <button
          onClick={play}
          className="font-semibold transition-colors cursor-pointer px-1"
          style={{
            fontSize: 11,
            color: playing ? 'var(--color-text-muted)' : 'var(--color-accent)',
          }}
        >
          ▶
        </button>
        <div className="w-px h-3 bg-border-default" />
        <button
          onClick={pause}
          className="font-semibold transition-colors cursor-pointer px-1"
          style={{
            fontSize: 11,
            color: !playing ? 'var(--color-text-muted)' : 'var(--color-accent)',
          }}
        >
          ⏸
        </button>
        <div className="w-px h-3 bg-border-default" />
        <button
          onClick={stop}
          className="transition-colors cursor-pointer px-1"
          style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}
        >
          ⏹
        </button>
        <div className="w-px h-3 bg-border-default" />
        <span className="font-mono text-text-muted w-10 text-right" style={{ fontSize: 9 }}>
          {elapsed.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}

function ViewCube() {
  const setSnapToView = useEditorStore((s) => s.setSnapToView)
  const [hovered, setHovered] = useState<string | null>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    viewCubeInnerRef.current = innerRef.current
    return () => { viewCubeInnerRef.current = null }
  }, [])

  const SIZE = 62
  const HALF = SIZE / 2

  const faces = [
    { id: 'front',  label: 'Front',  transform: `translateZ(${HALF}px)` },
    { id: 'back',   label: 'Back',   transform: `rotateY(180deg) translateZ(${HALF}px)` },
    { id: 'right',  label: 'Right',  transform: `rotateY(90deg) translateZ(${HALF}px)` },
    { id: 'left',   label: 'Left',   transform: `rotateY(-90deg) translateZ(${HALF}px)` },
    { id: 'top',    label: 'Top',    transform: `rotateX(90deg) translateZ(${HALF}px)` },
    { id: 'bottom', label: 'Bottom', transform: `rotateX(-90deg) translateZ(${HALF}px)` },
  ] as const

  return (
    <div
      className="absolute top-5 right-5 z-10 pointer-events-auto"
      style={{ width: SIZE, height: SIZE, perspective: 340 }}
    >
      <div
        ref={innerRef}
        style={{
          width: SIZE,
          height: SIZE,
          position: 'relative',
          transformStyle: 'preserve-3d',
          // Initial rotation is overwritten each frame by CameraRotationSync
          transform: 'rotateX(0deg) rotateY(0deg)',
        }}
      >
        {faces.map((face) => {
          const isHovered = hovered === face.id
          return (
            <div
              key={face.id}
              onClick={() => setSnapToView(face.id)}
              onMouseEnter={() => setHovered(face.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'absolute',
                width: SIZE,
                height: SIZE,
                transform: face.transform,
                backfaceVisibility: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
                border: '1px solid',
                borderColor: isHovered
                  ? 'var(--color-accent)'
                  : 'color-mix(in oklch, var(--color-border-default) 70%, transparent)',
                background: isHovered
                  ? 'color-mix(in oklch, var(--color-accent) 22%, var(--color-surface-base))'
                  : 'color-mix(in oklch, var(--color-surface-base) 88%, transparent)',
                color: isHovered ? 'var(--color-accent)' : 'var(--color-text-muted)',
                transition: 'background 0.12s, color 0.12s, border-color 0.12s',
              }}
            >
              {face.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Syncs ViewCube rotation with OrbitControls each frame — no React state, no re-renders.
// Also caches camera state so ProjectionSwitchHandler can restore it after a camera swap.
function CameraRotationSync() {
  const { camera, controls } = useThree()

  useFrame(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctrl = controls as any
    if (!ctrl) return

    // Save current camera state for projection-switch restore
    savedCameraState.position = camera.position.toArray() as [number, number, number]
    savedCameraState.up = camera.up.toArray() as [number, number, number]
    if (ctrl.target) savedCameraState.target = ctrl.target.toArray() as [number, number, number]

    // Update ViewCube CSS rotation
    const el = viewCubeInnerRef.current
    if (!el) return
    const polar: number = ctrl.getPolarAngle?.() ?? Math.PI / 2
    const azimuth: number = ctrl.getAzimuthalAngle?.() ?? 0
    const rotX = (polar - Math.PI / 2) * (180 / Math.PI)
    const rotY = -azimuth * (180 / Math.PI)
    el.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`
  })

  return null
}

// Restores camera position/target when the camera object is swapped (perspective ↔ orthographic).
// Watches the camera reference from useThree — it changes whenever React mounts a new camera component.
function ProjectionSwitchHandler() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const isFirstMount = useRef(true)

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    // New camera mounted — restore saved position, up, and orbit target
    camera.position.set(...savedCameraState.position)
    camera.up.set(...savedCameraState.up)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctrl = controls as any
    ctrl.target?.set(...savedCameraState.target)
    ctrl.update?.()
  }, [camera]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
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
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 pointer-events-auto">
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

function CameraSnapper() {
  const snapToView = useEditorStore((s) => s.snapToView)
  const setSnapToView = useEditorStore((s) => s.setSnapToView)
  const { camera, controls } = useThree()

  useEffect(() => {
    if (!snapToView || !controls) return
    const dist = 10
    const configs = {
      top:    { pos: [0, dist, 0]   as [number, number, number], up: [0, 0, -1] as [number, number, number] },
      bottom: { pos: [0, -dist, 0]  as [number, number, number], up: [0, 0, 1]  as [number, number, number] },
      right:  { pos: [dist, 0, 0]   as [number, number, number], up: [0, 1, 0]  as [number, number, number] },
      left:   { pos: [-dist, 0, 0]  as [number, number, number], up: [0, 1, 0]  as [number, number, number] },
      front:  { pos: [0, 0, dist]   as [number, number, number], up: [0, 1, 0]  as [number, number, number] },
      back:   { pos: [0, 0, -dist]  as [number, number, number], up: [0, 1, 0]  as [number, number, number] },
    }
    const { pos, up } = configs[snapToView]
    camera.position.set(...pos)
    camera.up.set(...up)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctrl = controls as any
    ctrl.target?.set(0, 0, 0)
    ctrl.update?.()
    setSnapToView(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapToView])

  return null
}

export function Viewport3D() {
  const projectionMode = useEditorStore((s) => s.projectionMode)

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--color-surface-viewport)' }}>
      {/* Overlays */}
      <SceneExplorer />
      <ViewCube />
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
        <CameraSnapper />
        <CameraRotationSync />
        <ProjectionSwitchHandler />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
