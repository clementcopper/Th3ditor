import { useGraphStore } from '../../store/graph-store'
import { useEditorStore } from '../../store/editor-store'
import { getNodeDef } from '../../graph-engine/node-registry'
import { CATEGORY_COLORS } from '../../graph-engine/type-system'

export function SceneExplorer() {
  const nodes = useGraphStore((s) => s.nodes)
  const selectedId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)

  return (
    <div
      className="absolute top-3 left-3 z-10 pointer-events-auto"
      style={{ minWidth: 140 }}
    >
      <div
        className="border border-border-default"
        style={{ background: 'color-mix(in oklch, var(--color-surface-base) 85%, transparent)' }}
      >
        <div className="px-2 py-1 border-b border-border-default">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">Scene</span>
        </div>
        <div className="flex flex-col">
          {nodes.map((node) => {
            const def = getNodeDef(node.type)
            const label = def?.label ?? node.type
            const color = CATEGORY_COLORS[def?.category ?? 'scene'] ?? '#888'
            const isSelected = node.id === selectedId
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNode(isSelected ? null : node.id)}
                className="flex items-center gap-1.5 px-2 py-1 text-left hover:bg-surface-elevated transition-colors cursor-pointer"
                style={{ background: isSelected ? 'color-mix(in oklch, var(--color-accent) 15%, transparent)' : undefined }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className={`text-[10px] ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
