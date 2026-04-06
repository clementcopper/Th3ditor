import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useGraphStore } from '../../store/graph-store'
import { useEditorStore } from '../../store/editor-store'
import { NodeRenderer } from './NodeRenderer'
import { DataEdge } from './DataEdge'
import { NodePalette } from './NodePalette'
import { getAllNodeDefs, getNodeDef } from '../../graph-engine/node-registry'
import { canConnect } from '../../graph-engine/type-system'

export function NodeEditor() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const addEdge = useGraphStore((s) => s.addEdge)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)

  const nodeTypes = useMemo(() => {
    const types: Record<string, typeof NodeRenderer> = {}
    for (const def of getAllNodeDefs()) {
      types[def.type] = NodeRenderer
    }
    return types
  }, [])

  const edgeTypes = useMemo(() => ({
    data: DataEdge,
  }), [])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, nodes as any) as any
      setNodes(updated)
    },
    [nodes, setNodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updated = applyEdgeChanges(changes, edges as any) as any
      setEdges(updated)
    },
    [edges, setEdges],
  )

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source)
      const targetNode = nodes.find((n) => n.id === connection.target)
      if (!sourceNode || !targetNode) return false

      const sourceDef = getNodeDef(sourceNode.type)
      const targetDef = getNodeDef(targetNode.type)
      if (!sourceDef || !targetDef) return false

      const sourcePort = sourceDef.outputs.find((p) => p.name === connection.sourceHandle)
      const targetPort = targetDef.inputs.find((p) => p.name === connection.targetHandle)
      if (!sourcePort || !targetPort) return false

      return canConnect(sourcePort.type, targetPort.type)
    },
    [nodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return
      addEdge({
        id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
        source: connection.source!,
        sourceHandle: connection.sourceHandle!,
        target: connection.target!,
        targetHandle: connection.targetHandle!,
      })
    },
    [addEdge, isValidConnection],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      setSelectedNode(node.id)
    },
    [setSelectedNode],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  return (
    <div className="w-full h-full relative">
      <NodePalette />
      <ReactFlow
        nodes={nodes as any}
        edges={edges as any}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection as any}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'data', animated: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border-default)" />
      </ReactFlow>
    </div>
  )
}
