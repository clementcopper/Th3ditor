import { useEffect, useRef, useState } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle, type PanelImperativeHandle } from 'react-resizable-panels'
import { CaretUp, CaretDown, CaretLeft, CaretRight, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import { NodeEditor } from '../graph/NodeEditor'
import { Viewport3D, PlaybackOverlay } from '../viewport/Viewport3D'
import { CameraView } from '../viewport/CameraView'
import { PropertiesPanel } from '../properties/PropertiesPanel'
import { SceneExplorer } from '../viewport/SceneExplorer'
import { EditorToolbar } from './EditorToolbar'
import { StatusBar } from './StatusBar'
import { useGraphStore } from '../../store/graph-store'
import { useSceneStore } from '../../store/scene-store'
import { compileGraph } from '../../graph-engine/compiler'

function initDefaultGraph() {
  const { nodes, setNodes, setEdges } = useGraphStore.getState()
  if (nodes.length > 0) return
  setNodes([
    { id: 'n1', type: 'geometry', position: { x: 0, y: 0 }, data: { mode: 0 } },
    { id: 'n2', type: 'material', position: { x: 0, y: 200 }, data: {} },
    { id: 'n3', type: 'object/mesh', position: { x: 300, y: 80 }, data: {} },
    { id: 'n4', type: 'scene/output', position: { x: 700, y: 80 }, data: {} },
    { id: 'n5', type: 'light', position: { x: 0, y: 380 }, data: { mode: 1, positionX: 3, positionY: 3, positionZ: 3 } },
    { id: 'n6', type: 'camera', position: { x: 0, y: 560 }, data: { positionX: 0, positionY: 0, positionZ: 5 } },
  ])
  setEdges([
    { id: 'e1', source: 'n1', sourceHandle: 'geometry', target: 'n3', targetHandle: 'geometry' },
    { id: 'e2', source: 'n2', sourceHandle: 'material', target: 'n3', targetHandle: 'material' },
    { id: 'e3', source: 'n3', sourceHandle: 'mesh', target: 'n4', targetHandle: 'mesh' },
    { id: 'e4', source: 'n5', sourceHandle: 'light', target: 'n4', targetHandle: 'light' },
    { id: 'e5', source: 'n6', sourceHandle: 'camera', target: 'n4', targetHandle: 'camera' },
  ])
}

const overlayBg = { background: 'color-mix(in oklch, var(--color-surface-base) 85%, transparent)' }
const CAM_STACK_THRESHOLD = 820

/** Camera max mode overlay — mirrors 3D viewport stacking logic for playbar + minimize button. */
function CamMaxOverlay({ onMinimize }: { onMinimize: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [stacked, setStacked] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setStacked(entry.contentRect.width < CAM_STACK_THRESHOLD)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 z-10">
      <CameraView />
      <PlaybackOverlay stacked={stacked} />
      <ViewportMaximizeBtn maximized={true} onClick={onMinimize} stacked={stacked} />
    </div>
  )
}

/** Maximize / minimize button styled to match ViewportControlsOverlay — use as extraButton or standalone. */
function ViewportMaximizeBtn({ maximized, onClick, stacked = false }: { maximized: boolean; onClick: () => void; stacked?: boolean }) {
  return (
    <div
      className="absolute right-3 z-10 pointer-events-auto flex items-center border border-border-default transition-[bottom] duration-150"
      style={{ ...overlayBg, height: 26, bottom: stacked ? (12 + 26 + 8) : 12 }}
    >
      <button
        onClick={onClick}
        title={maximized ? 'Restore' : 'Maximize'}
        className={`px-2 h-full flex items-center text-xs font-medium transition-colors cursor-pointer ${
          maximized ? 'hover:bg-surface-panel' : 'text-text-muted hover:text-text-primary hover:bg-surface-panel'
        }`}
        style={maximized ? {
          color: 'var(--color-accent)',
          background: 'color-mix(in oklch, var(--color-accent) 12%, transparent)',
        } : undefined}
      >
        {maximized ? <ArrowsIn size={10} weight="bold" /> : <ArrowsOut size={10} weight="bold" />}
      </button>
    </div>
  )
}

function PanelHandle({ orientation, disabled = false }: { orientation: 'horizontal' | 'vertical'; disabled?: boolean }) {
  return (
    <PanelResizeHandle
      disabled={disabled}
      className={
        orientation === 'horizontal'
          ? `w-[3px] shrink-0 bg-border-default transition-colors ${disabled ? '' : 'hover:bg-accent cursor-col-resize'}`
          : `h-[3px] shrink-0 bg-border-default transition-colors ${disabled ? '' : 'hover:bg-accent cursor-row-resize'}`
      }
    />
  )
}

/**
 * Collapse/expand button that visually merges with the panel border.
 * horizontal=true → sits on a horizontal border (graph panel); false → vertical border (right panel).
 */
function BorderCollapseBtn({ open, onClick, horizontal, flip = false }: {
  open: boolean
  onClick: () => void
  horizontal: boolean
  flip?: boolean
}) {
  const effective = flip ? !open : open
  const icon = horizontal
    ? (effective ? <CaretDown size={7} weight="bold" /> : <CaretUp size={7} weight="bold" />)
    : (effective ? <CaretRight size={7} weight="bold" /> : <CaretLeft size={7} weight="bold" />)

  return (
    <button
      onClick={onClick}
      className={`${horizontal ? 'panel-collapse-btn-h' : 'panel-collapse-btn-v'} flex items-center justify-center bg-border-default text-surface-base hover:bg-accent transition-colors`}
      style={horizontal ? { width: 28, height: 12 } : { width: 12, height: 28 }}
    >
      {icon}
    </button>
  )
}

const plainHandle = (orientation: 'horizontal' | 'vertical', disabled = false) => (
  <PanelHandle orientation={orientation} disabled={disabled} />
)

export function EditorLayout() {
  const setScene = useSceneStore((s) => s.setScene)

  const graphRef = useRef<PanelImperativeHandle>(null)
  const rightRef = useRef<PanelImperativeHandle>(null)
  const sceneRef = useRef<PanelImperativeHandle>(null)

  const [maximizedViewport, setMaximizedViewport] = useState<'vp3d' | 'cam' | null>('vp3d')
  const [graphOpen, setGraphOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [sceneOpen, setSceneOpen] = useState(true)

  function toggle(ref: React.RefObject<PanelImperativeHandle | null>, open: boolean, setOpen: (v: boolean) => void) {
    if (open) { ref.current?.collapse(); setOpen(false) }
    else      { ref.current?.expand();   setOpen(true)  }
  }

  function toggleMaximize(vp: 'vp3d' | 'cam') {
    setMaximizedViewport(prev => prev === vp ? null : vp)
  }

  useEffect(() => { initDefaultGraph() }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (!(e.metaKey || e.ctrlKey)) return
      const { undo, redo } = useGraphStore.getState()
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const compile = (nodes: import('../../types/node-graph').GraphNode[], edges: import('../../types/node-graph').GraphEdge[]) => {
      setScene(compileGraph(nodes, edges))
    }
    const { nodes, edges } = useGraphStore.getState()
    compile(nodes, edges)
    let prevNodes = nodes
    let prevEdges = edges
    return useGraphStore.subscribe((state) => {
      const { nodes, edges } = state
      const edgesChanged = edges !== prevEdges
      const structuralChange = edgesChanged ||
        nodes.length !== prevNodes.length ||
        nodes.some((n, i) => n.id !== prevNodes[i]?.id || n.type !== prevNodes[i]?.type || n.data !== prevNodes[i]?.data)
      prevNodes = nodes
      prevEdges = edges
      if (structuralChange) compile(nodes, edges)
    })
  }, [setScene])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-base">
      <EditorToolbar />

      <PanelGroup orientation="horizontal" className="flex-1 min-h-0">

        <Panel defaultSize={87} minSize={20}>
          <PanelGroup orientation="vertical" className="h-full">

            {/* Viewport row */}
            <Panel defaultSize={55} minSize={10}>
              <div className="relative w-full h-full">
                <PanelGroup orientation="horizontal" className="h-full">

                  {/* 3D Viewport — hidden when maximized to avoid 3rd WebGL context */}
                  <Panel defaultSize={50} minSize={10}>
                    <div className="relative w-full h-full overflow-hidden">
                      {maximizedViewport !== 'vp3d' && (
                        <Viewport3D extraButton={
                          <button
                            onClick={() => toggleMaximize('vp3d')}
                            title="Maximize"
                            className="px-2 h-full flex items-center text-xs font-medium transition-colors cursor-pointer text-text-muted hover:text-text-primary hover:bg-surface-panel"
                          >
                            <ArrowsOut size={10} weight="bold" />
                          </button>
                        } />
                      )}
                    </div>
                  </Panel>

                  {plainHandle('horizontal', maximizedViewport !== null)}

                  {/* Camera Viewport — hidden when maximized to avoid 3rd WebGL context */}
                  <Panel defaultSize={50} minSize={10}>
                    <div className="relative w-full h-full overflow-hidden">
                      {maximizedViewport !== 'cam' && <CameraView />}
                      {maximizedViewport === null && (
                        <ViewportMaximizeBtn maximized={false} onClick={() => toggleMaximize('cam')} />
                      )}
                    </div>
                  </Panel>

                </PanelGroup>

                {/* Maximized overlays */}
                {maximizedViewport === 'vp3d' && (
                  <div className="absolute inset-0 z-10">
                    <Viewport3D extraButton={
                      <button
                        onClick={() => toggleMaximize('vp3d')}
                        title="Restore"
                        className="px-2 h-full flex items-center text-xs font-medium transition-colors cursor-pointer hover:bg-surface-panel"
                        style={{
                          color: 'var(--color-accent)',
                          background: 'color-mix(in oklch, var(--color-accent) 12%, transparent)',
                        }}
                      >
                        <ArrowsIn size={10} weight="bold" />
                      </button>
                    } />
                  </div>
                )}
                {maximizedViewport === 'cam' && (
                  <CamMaxOverlay onMinimize={() => toggleMaximize('cam')} />
                )}
              </div>
            </Panel>

            <PanelHandle orientation="vertical" disabled={!graphOpen} />

            {/* Node Graph */}
            <Panel
              panelRef={graphRef}
              defaultSize={45} minSize={10}
              collapsible collapsedSize={12}
              onResize={(s) => setGraphOpen(s.inPixels > 12)}
            >
              <div className="relative w-full h-full">
                {graphOpen && <NodeEditor />}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
                  <BorderCollapseBtn
                    open={graphOpen}
                    onClick={() => toggle(graphRef, graphOpen, setGraphOpen)}
                    horizontal={true}
                  />
                </div>
              </div>
            </Panel>

          </PanelGroup>
        </Panel>

        <PanelHandle orientation="horizontal" disabled={!rightOpen} />

        {/* Right column */}
        <Panel
          panelRef={rightRef}
          defaultSize={13} minSize={1}
          collapsible collapsedSize={12}
          onResize={(s) => setRightOpen(s.inPixels > 12)}
        >
          <div className="relative w-full h-full overflow-hidden">
            <PanelGroup orientation="vertical" className="h-full">
              <Panel
                panelRef={sceneRef}
                defaultSize={25} minSize={5}
                collapsible collapsedSize={12}
                onResize={(s) => setSceneOpen(s.inPixels > 12)}
              >
                <div className="relative w-full h-full">
                  {sceneOpen && rightOpen && <div className="h-full overflow-y-auto"><SceneExplorer /></div>}
                  {rightOpen && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
                      <BorderCollapseBtn
                        open={sceneOpen}
                        onClick={() => toggle(sceneRef, sceneOpen, setSceneOpen)}
                        horizontal={true}
                        flip={true}
                      />
                    </div>
                  )}
                </div>
              </Panel>
              <PanelHandle orientation="vertical" disabled={!sceneOpen} />
              <Panel defaultSize={75} minSize={20}>
                {rightOpen && <PropertiesPanel />}
              </Panel>
            </PanelGroup>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
              <BorderCollapseBtn
                open={rightOpen}
                onClick={() => toggle(rightRef, rightOpen, setRightOpen)}
                horizontal={false}
              />
            </div>
          </div>
        </Panel>

      </PanelGroup>

      <StatusBar />
    </div>
  )
}
