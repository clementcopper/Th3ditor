import { useEffect } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { NodeEditor } from '../graph/NodeEditor'
import { Viewport3D } from '../viewport/Viewport3D'
import { PropertiesPanel } from '../properties/PropertiesPanel'
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
    { id: 'n4', type: 'scene/output', position: { x: 550, y: 80 }, data: {} },
  ])

  setEdges([
    { id: 'e1', source: 'n1', sourceHandle: 'geometry', target: 'n3', targetHandle: 'geometry' },
    { id: 'e2', source: 'n2', sourceHandle: 'material', target: 'n3', targetHandle: 'material' },
    { id: 'e3', source: 'n3', sourceHandle: 'mesh', target: 'n4', targetHandle: 'mesh' },
  ])
}

const resizeHandle = (orientation: 'horizontal' | 'vertical') => (
  <PanelResizeHandle
    className={
      orientation === 'horizontal'
        ? 'w-[3px] bg-border-default hover:bg-accent transition-colors cursor-col-resize shrink-0'
        : 'h-[3px] bg-border-default hover:bg-accent transition-colors cursor-row-resize shrink-0'
    }
  />
)

export function EditorLayout() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const setScene = useSceneStore((s) => s.setScene)

  useEffect(() => {
    initDefaultGraph()
  }, [])

  useEffect(() => {
    const compiled = compileGraph(nodes, edges)
    setScene(compiled)
  }, [nodes, edges, setScene])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-base">
      <EditorToolbar />

      {/* Main: left column (viewport + graph) | properties */}
      <PanelGroup orientation="horizontal" className="flex-1 min-h-0">

        {/* Left column: viewport + graph */}
        <Panel defaultSize={80} minSize={40}>
          <PanelGroup orientation="vertical" className="h-full">

            {/* 3D Viewport */}
            <Panel defaultSize={62} minSize={20}>
              <Viewport3D />
            </Panel>

            {resizeHandle('vertical')}

            {/* Node Graph */}
            <Panel defaultSize={38} minSize={15}>
              <NodeEditor />
            </Panel>

          </PanelGroup>
        </Panel>

        {resizeHandle('horizontal')}

        {/* Properties Panel */}
        <Panel defaultSize={20} minSize={10}>
          <PropertiesPanel />
        </Panel>

      </PanelGroup>

      <StatusBar />
    </div>
  )
}
