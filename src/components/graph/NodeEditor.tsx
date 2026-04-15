import { useCallback, useMemo, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  useNodesInitialized,
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

type ContextMenu = { screen: { x: number; y: number }; flow: { x: number; y: number } }
type SelectionBox = { x: number; y: number; w: number; h: number }

/** Fits the view once after nodes are fully initialized. */
function FitViewOnInit() {
  const { fitView } = useReactFlow()
  const initialized = useNodesInitialized()
  const hasFitted = useRef(false)

  useEffect(() => {
    if (initialized && !hasFitted.current) {
      hasFitted.current = true
      fitView({ padding: 0.2 })
    }
  }, [initialized, fitView])

  return null
}

/**
 * Handles right-mouse interactions (inside ReactFlow for useReactFlow access):
 * - Short right-click → context menu
 * - Right-drag → selection box
 */
function RightMouseHandler({
  containerRef,
  selStart,
  selBoxRef,
  setSelBox,
  setContextMenu,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  selStart: React.MutableRefObject<{ x: number; y: number } | null>
  selBoxRef: React.MutableRefObject<SelectionBox | null>
  setSelBox: (box: SelectionBox | null) => void
  setContextMenu: (menu: ContextMenu | null) => void
}) {
  const { getNodes, setNodes: rfSetNodes, getViewport, screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!selStart.current) return
      const s = selStart.current
      const box: SelectionBox = {
        x: Math.min(e.clientX, s.x),
        y: Math.min(e.clientY, s.y),
        w: Math.abs(e.clientX - s.x),
        h: Math.abs(e.clientY - s.y),
      }
      selBoxRef.current = box
      setSelBox({ ...box })
    }

    function onMouseUp(e: MouseEvent) {
      if (e.button !== 2) return
      const box = selBoxRef.current
      const start = selStart.current

      selStart.current = null
      selBoxRef.current = null
      setSelBox(null)

      if (!start) return

      const dx = Math.abs(e.clientX - start.x)
      const dy = Math.abs(e.clientY - start.y)

      if (dx < 5 && dy < 5) {
        // Short click → context menu
        const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        setContextMenu({ screen: { x: e.clientX, y: e.clientY }, flow })
        return
      }

      // Drag → selection box
      if (!box || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const { x: vpX, y: vpY, zoom } = getViewport()

      const allNodes = getNodes()
      const selectedIds = new Set(
        allNodes
          .filter((node) => {
            const nx = node.position.x * zoom + vpX + containerRect.left
            const ny = node.position.y * zoom + vpY + containerRect.top
            const nw = ((node as any).measured?.width ?? 160) * zoom
            const nh = ((node as any).measured?.height ?? 80) * zoom
            return nx < box.x + box.w && nx + nw > box.x &&
                   ny < box.y + box.h && ny + nh > box.y
          })
          .map((n) => n.id)
      )
      rfSetNodes(allNodes.map((n) => ({ ...n, selected: selectedIds.has(n.id) })))
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [containerRef, selStart, selBoxRef, setSelBox, setContextMenu, getNodes, getViewport, rfSetNodes, screenToFlowPosition])

  return null
}

export function NodeEditor() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const addEdge = useGraphStore((s) => s.addEdge)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)

  const containerRef = useRef<HTMLDivElement>(null)
  const selStart = useRef<{ x: number; y: number } | null>(null)
  const selBoxRef = useRef<SelectionBox | null>(null)
  const [selBox, setSelBox] = useState<SelectionBox | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  const altDragOrigin = useRef<{ nodeId: string; position: { x: number; y: number } } | null>(null)

  const nodeTypes = useMemo(() => {
    const types: Record<string, typeof NodeRenderer> = {}
    for (const def of getAllNodeDefs()) {
      types[def.type] = NodeRenderer
    }
    return types
  }, [])

  const edgeTypes = useMemo(() => ({ data: DataEdge }), [])

  const snapshot = useGraphStore((s) => s.snapshot)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) snapshot()
      const updated = applyNodeChanges(changes, nodes as any) as any
      setNodes(updated)
    },
    [nodes, setNodes, snapshot],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) snapshot()
      const updated = applyEdgeChanges(changes, edges as any) as any
      setEdges(updated)
    },
    [edges, setEdges, snapshot],
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
      // Auto-switch texture node to Normal mode when connecting to its 'source' port
      if (connection.targetHandle === 'source') {
        const targetNode = nodes.find((n) => n.id === connection.target)
        if (targetNode?.type === 'texture') updateNodeData(connection.target!, { mode: 2 })
      }
      addEdge({
        id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
        source: connection.source!,
        sourceHandle: connection.sourceHandle!,
        target: connection.target!,
        targetHandle: connection.targetHandle!,
      })
    },
    [addEdge, isValidConnection, nodes, updateNodeData],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => { setSelectedNode(node.id) },
    [setSelectedNode],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setContextMenu(null)
  }, [setSelectedNode])

  // Alt+drag: record origin on drag start; also snapshot for undo
  const onNodeDragStart = useCallback((e: React.MouseEvent, node: any) => {
    useGraphStore.getState().snapshot()
    if (!e.altKey) return
    altDragOrigin.current = { nodeId: node.id, position: { ...node.position } }
  }, [])

  // Alt+drag: on release — snap original back, place fresh duplicate at drop position
  const onNodeDragStop = useCallback((_e: React.MouseEvent, node: any) => {
    if (!altDragOrigin.current || altDragOrigin.current.nodeId !== node.id) return
    const { position: origin } = altDragOrigin.current
    altDragOrigin.current = null

    const { nodes: cur, setNodes: storeSet } = useGraphStore.getState()
    storeSet([
      // Restore original to start position (keeps its edges)
      ...cur.filter(n => n.id !== node.id),
      { ...cur.find(n => n.id === node.id)!, position: origin },
      // Fresh duplicate at drop position (no edges)
      { id: `n${Date.now()}`, type: node.type, position: { ...node.position }, data: { ...node.data } },
    ])
  }, [])

  // Right-click on container (not on node/edge) starts right-mouse tracking
  const onContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 2) return
    const target = e.target as HTMLElement
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return
    e.preventDefault()
    selStart.current = { x: e.clientX, y: e.clientY }
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      onMouseDown={onContainerMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
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
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        fitView
        minZoom={0.25}
        maxZoom={2.00}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'data', animated: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border-default)" />
        <FitViewOnInit />
        <RightMouseHandler
          containerRef={containerRef}
          selStart={selStart}
          selBoxRef={selBoxRef}
          setSelBox={setSelBox}
          setContextMenu={setContextMenu}
        />
      </ReactFlow>

      {/* Right-drag selection box */}
      {selBox && selBox.w > 2 && selBox.h > 2 && (
        <div
          style={{
            position: 'fixed',
            left: selBox.x,
            top: selBox.y,
            width: selBox.w,
            height: selBox.h,
            border: '1px solid var(--color-accent)',
            background: 'color-mix(in oklch, var(--color-accent) 10%, transparent)',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}

      {/* Right-click context menu */}
      <NodePalette
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
      />
    </div>
  )
}
