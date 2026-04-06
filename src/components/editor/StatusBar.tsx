import { useGraphStore } from '../../store/graph-store'
import { useEditorStore } from '../../store/editor-store'

export function StatusBar() {
  const nodeCount = useGraphStore((s) => s.nodes.length)
  const edgeCount = useGraphStore((s) => s.edges.length)
  const selectedId = useEditorStore((s) => s.selectedNodeId)

  return (
    <div className="h-6 flex items-center px-3 gap-4 border-t border-border-default bg-surface-base shrink-0 text-[10px] text-text-muted">
      <span>{nodeCount} nodes</span>
      <span>{edgeCount} edges</span>
      {selectedId && <span>Selected: {selectedId}</span>}
    </div>
  )
}
