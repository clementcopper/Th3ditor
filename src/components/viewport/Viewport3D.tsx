import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { Play, Pause, Stop } from '@phosphor-icons/react'
import { SceneRenderer, LiveEvaluator } from './SceneRenderer'
import { useEditorStore } from '../../store/editor-store'
import { useAnimationStore } from '../../store/animation-store'
import { useSceneStore } from '../../store/scene-store'

// Module-level refs shared between HTML overlays and Canvas components
const viewCubeInnerRef: { current: HTMLDivElement | null } = { current: null }

// Saved camera state — updated every frame, used to restore position after projection switch
const savedCameraState = {
  position: [3, 2, 3] as [number, number, number],
  up: [0, 1, 0] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
}

const SCRUBBER_DURATION = 30 // seconds

export function PlaybackOverlay({ extra, positioned = true, stacked = false }: { extra?: React.ReactNode, positioned?: boolean, stacked?: boolean } = {}) {
  // Only `playing` triggers re-render (on play/pause/stop) — not elapsed (60fps)
  const playing = useAnimationStore((s) => s.playing)
  const play = useAnimationStore((s) => s.play)
  const pause = useAnimationStore((s) => s.pause)
  const stop = useAnimationStore((s) => s.stop)
  const setElapsed = useAnimationStore((s) => s.setElapsed)

  const scrubberRef = useRef<HTMLInputElement>(null)
  const timeDisplayRef = useRef<HTMLSpanElement>(null)
  const isScrubbingRef = useRef(false)

  // Imperative DOM updates — bypasses React reconciliation every frame
  useEffect(() => {
    return useAnimationStore.subscribe((state) => {
      const pos = state.elapsed % SCRUBBER_DURATION
      const pct = (pos / SCRUBBER_DURATION) * 100
      // Don't overwrite scrubber position while user is dragging
      if (scrubberRef.current && !isScrubbingRef.current) {
        scrubberRef.current.value = String(pos)
        scrubberRef.current.style.background =
          `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-border-default) ${pct}%)`
      }
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${state.elapsed.toFixed(1)}s`
      }
    })
  }, [])

  function handleScrubStart() { isScrubbingRef.current = true }

  function handleScrubEnd(e: React.PointerEvent<HTMLInputElement>) {
    isScrubbingRef.current = false
    pause()
    setElapsed(parseFloat((e.target as HTMLInputElement).value))
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    // Update background fill live while dragging
    const val = parseFloat(e.target.value)
    const pct = (val / SCRUBBER_DURATION) * 100
    e.target.style.background =
      `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-border-default) ${pct}%)`
    pause()
    setElapsed(val)
  }

  function handleWheel(e: React.WheelEvent<HTMLInputElement>) {
    e.preventDefault()
    const current = useAnimationStore.getState().elapsed % SCRUBBER_DURATION
    const delta = e.deltaY > 0 ? 0.1 : -0.1
    const next = Math.min(SCRUBBER_DURATION, Math.max(0, current + delta))
    pause()
    setElapsed(next)
  }

  const overlayBg = { background: 'color-mix(in oklch, var(--color-surface-base) 85%, transparent)' }

  const bar = (
    <div
      className="flex items-center gap-2 px-2 border border-border-default"
      style={{ ...overlayBg, height: 26 }}
    >
        <button
          onClick={playing ? pause : play}
          className="transition-colors cursor-pointer flex items-center justify-center"
          style={{ color: 'var(--color-accent)' }}
        >
          {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
        </button>
        <button
          onClick={stop}
          className="transition-colors cursor-pointer flex items-center justify-center"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Stop size={14} weight="fill" />
        </button>
        <div className="w-px h-3 bg-border-default" />
        <input
          ref={scrubberRef}
          type="range"
          min={0}
          max={SCRUBBER_DURATION}
          step={0.05}
          defaultValue={0}
          onPointerDown={handleScrubStart}
          onPointerUp={handleScrubEnd}
          onChange={handleScrub}
          onWheel={handleWheel}
          className={`timeline-scrubber ${stacked ? 'flex-1' : 'w-40'}`}
          style={{
            background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-border-default) 0%)`,
          }}
        />
        <span
          ref={timeDisplayRef}
          className="text-xs font-mono text-text-muted w-10 text-right tabular-nums"
        >
          0.0s
        </span>
        {extra && <><div className="w-px h-3 bg-border-default" />{extra}</>}
      </div>
  )

  if (!positioned) return bar

  if (stacked) return (
    <div className="absolute left-3 right-3 z-10 pointer-events-auto transition-[bottom] duration-150" style={{ bottom: 12 + 26 + 8 }}>
      {bar}
    </div>
  )

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
      {bar}
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
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.02em',
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

function ViewportControlsOverlay({ extra }: { extra?: React.ReactNode }) {
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
    <>
      {/* Shading */}
      <div className="flex items-center border border-border-default" style={{ ...overlayBg, height: 26 }}>
        {(['shaded', 'wireframe'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setShadingMode(mode)}
            className={`px-2 h-full text-xs font-medium transition-colors cursor-pointer capitalize ${
              shadingMode === mode ? '' : 'text-text-muted hover:text-text-primary hover:bg-surface-panel'
            }`}
            style={shadingMode === mode ? {
              color: 'var(--color-accent)',
              background: 'color-mix(in oklch, var(--color-accent) 12%, transparent)',
            } : undefined}
          >
            {mode}
          </button>
        ))}
      </div>
      {/* Projection */}
      <div className="flex items-center border border-border-default" style={{ ...overlayBg, height: 26 }}>
        {(['perspective', 'orthographic'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setProjectionMode(mode)}
            className={`px-2 h-full text-xs font-medium transition-colors cursor-pointer capitalize ${
              projectionMode === mode ? '' : 'text-text-muted hover:text-text-primary hover:bg-surface-panel'
            }`}
            style={projectionMode === mode ? {
              color: 'var(--color-accent)',
              background: 'color-mix(in oklch, var(--color-accent) 12%, transparent)',
            } : undefined}
          >
            {mode === 'perspective' ? 'Persp' : 'Ortho'}
          </button>
        ))}
      </div>
      {extra && (
        <div className="flex items-center border border-border-default" style={{ ...overlayBg, height: 26 }}>
          {extra}
        </div>
      )}
    </>
  )
}

function CameraSnapper() {
  const snapToView = useEditorStore((s) => s.snapToView)
  const setSnapToView = useEditorStore((s) => s.setSnapToView)
  const { camera, controls } = useThree()

  useEffect(() => {
    if (!snapToView || !controls) return
    const dist = 10
    const eps = 0.001
    const configs = {
      top:    { pos: [eps, dist, 0]   as [number, number, number], up: [0, 1, 0] as [number, number, number] },
      bottom: { pos: [eps, -dist, 0]  as [number, number, number], up: [0, 1, 0] as [number, number, number] },
      right:  { pos: [dist, 0, 0]    as [number, number, number], up: [0, 1, 0] as [number, number, number] },
      left:   { pos: [-dist, 0, 0]   as [number, number, number], up: [0, 1, 0] as [number, number, number] },
      front:  { pos: [0, 0, dist]    as [number, number, number], up: [0, 1, 0] as [number, number, number] },
      back:   { pos: [0, 0, -dist]   as [number, number, number], up: [0, 1, 0] as [number, number, number] },
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

function EditorBackground() {
  const hdrBgActive = useSceneStore((s) => !!s.scene.envMapDataUrl && s.scene.showEnvBackground)
  if (hdrBgActive) return null
  return <color attach="background" args={['#1e1b18']} />
}

// Playbar approx half-width + controls width + right margin — below this they'd overlap
const STACK_THRESHOLD = 820

export function Viewport3D({ extraButton, hidePlaybar }: { extraButton?: React.ReactNode, hidePlaybar?: boolean } = {}) {
  const projectionMode = useEditorStore((s) => s.projectionMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const [stacked, setStacked] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setStacked(entry.contentRect.width < STACK_THRESHOLD)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ background: 'var(--color-surface-viewport)' }}>
      {/* Overlays */}
      <ViewCube />
      {/* Controls — always bottom-right */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 pointer-events-auto">
        <ViewportControlsOverlay extra={extraButton} />
      </div>
      {/* Playbar — centered normally, full-width above controls when stacked */}
      {!hidePlaybar && <PlaybackOverlay stacked={stacked} />}

      {/* 3D Canvas */}
      <Canvas shadows="soft" gl={{ antialias: true }}>
        <EditorBackground />

        {projectionMode === 'perspective'
          ? <PerspectiveCamera makeDefault position={[3, 2, 3]} fov={50} />
          : <OrthographicCamera makeDefault position={[3, 2, 3]} zoom={80} />
        }

        {/* Editor ambient lights */}
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[5, 5, 5]} intensity={1.2} castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.1} shadow-camera-far={50}
          shadow-camera-left={-12} shadow-camera-right={12}
          shadow-camera-top={12} shadow-camera-bottom={-12}
        />

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
