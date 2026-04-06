import { useEffect } from 'react'
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-primary">
      {/* Top Toolbar */}
      <EditorToolbar />

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Viewport (top) + Graph (bottom) */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* 3D Viewport — ~62% height */}
          <div className="flex-[62] min-h-0 border-b border-border-default">
            <Viewport3D />
          </div>

          {/* Node Graph — ~38% height */}
          <div className="flex-[38] min-h-0">
            <NodeEditor />
          </div>
        </div>

        {/* Right: Properties Panel — fixed 280px */}
        <div className="w-[280px] shrink-0 border-l border-border-default overflow-hidden">
          <PropertiesPanel />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}
