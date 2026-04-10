import { useEffect } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { NodeEditor } from '../graph/NodeEditor'
import { Viewport3D } from '../viewport/Viewport3D'
import { CameraView } from '../viewport/CameraView'
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
    { id: 'n4', type: 'scene/output', position: { x: 700, y: 80 }, data: {} },
    { id: 'n5', type: 'light', position: { x: 0, y: 380 }, data: { mode: 1 } },   // Directional
    { id: 'n6', type: 'camera', position: { x: 0, y: 560 }, data: {} },
  ])

  setEdges([
    { id: 'e1', source: 'n1', sourceHandle: 'geometry', target: 'n3', targetHandle: 'geometry' },
    { id: 'e2', source: 'n2', sourceHandle: 'material', target: 'n3', targetHandle: 'material' },
    { id: 'e3', source: 'n3', sourceHandle: 'mesh', target: 'n4', targetHandle: 'mesh' },
    { id: 'e4', source: 'n5', sourceHandle: 'light', target: 'n4', targetHandle: 'light' },
    { id: 'e5', source: 'n6', sourceHandle: 'camera', target: 'n4', targetHandle: 'camera' },
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
  const setScene = useSceneStore((s) => s.setScene)

  useEffect(() => {
    initDefaultGraph()
  }, [])

  // Compile only on structural changes — ignore node position updates (graph canvas drag)
  useEffect(() => {
    const compile = (nodes: import('../../types/node-graph').GraphNode[], edges: import('../../types/node-graph').GraphEdge[]) => {
      setScene(compileGraph(nodes, edges))
    }

    // Initial compile
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

      {/* Main: viewport (top) | graph + properties (bottom) */}
      <PanelGroup orientation="vertical" className="flex-1 min-h-0">

        {/* Viewport row: Editor | Camera */}
        <Panel defaultSize={55} minSize={20}>
          <PanelGroup orientation="horizontal" className="h-full">
            <Panel defaultSize={50} minSize={20}>
              <Viewport3D />
            </Panel>
            {resizeHandle('horizontal')}
            <Panel defaultSize={50} minSize={20}>
              <CameraView />
            </Panel>
          </PanelGroup>
        </Panel>

        {resizeHandle('vertical')}

        {/* Bottom row: node graph | properties */}
        <Panel defaultSize={45} minSize={15}>
          <PanelGroup orientation="horizontal" className="h-full">

            <Panel defaultSize={80} minSize={40}>
              <NodeEditor />
            </Panel>

            {resizeHandle('horizontal')}

            <Panel defaultSize={20} minSize={10}>
              <PropertiesPanel />
            </Panel>

          </PanelGroup>
        </Panel>

      </PanelGroup>

      <StatusBar />
    </div>
  )
}
