import { useState } from 'react'
import { useGraphStore } from '../../store/graph-store'
import { useEditorStore } from '../../store/editor-store'
import { getNodeDef } from '../../graph-engine/node-registry'
import { CATEGORY_COLORS } from '../../graph-engine/type-system'
import { getNodeIcon } from '../../utils/node-icons'
import type { GraphNode } from '../../types/node-graph'

const SCENE_CATEGORIES = new Set(['object', 'light', 'camera', 'path'])

const LIGHT_TYPE_LABELS = ['Ambient', 'Directional', 'Point']
const PATH_TYPE_LABELS = ['Line', 'Circle', 'Arc']

function NodeIcon({ node, color }: { node: GraphNode; color: string }) {
  const def = getNodeDef(node.type)
  if (!def) return null
  const Icon = getNodeIcon(node.type, def.category, node.data)
  return <Icon size={12} weight="fill" color={color} />
}

export function getNodeDisplayName(node: GraphNode): string {
  const customLabel = node.data.label as string | undefined
  if (node.type === 'object/mesh') {
    return customLabel ? `Mesh: ${customLabel}` : 'Mesh'
  }
  if (node.type === 'light') {
    const def = getNodeDef(node.type)
    const defaultMode = (def?.defaults.mode as number) ?? 1
    const mode = (node.data.mode as number) ?? defaultMode
    const typeLabel = LIGHT_TYPE_LABELS[mode] ?? 'Light'
    return customLabel ? `${typeLabel}: ${customLabel}` : typeLabel
  }
  if (node.type === 'path') {
    const mode = (node.data.mode as number) ?? 0
    const typeLabel = PATH_TYPE_LABELS[mode] ?? 'Path'
    return customLabel ? `${typeLabel}: ${customLabel}` : typeLabel
  }
  return customLabel ?? (getNodeDef(node.type)?.label ?? node.type)
}

export function SceneExplorer() {
  const nodes = useGraphStore((s) => s.nodes)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const selectedId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const sceneNodes = nodes.filter((node) => {
    const def = getNodeDef(node.type)
    return def && SCENE_CATEGORIES.has(def.category)
  })

  function startRename(node: GraphNode) {
    setRenamingId(node.id)
    setRenameValue((node.data.label as string) ?? '')
  }

  function commitRename(nodeId: string) {
    const trimmed = renameValue.trim()
    updateNodeData(nodeId, { label: trimmed || undefined })
    setRenamingId(null)
  }

  return (
    <div
      className="absolute top-3 left-3 z-10 pointer-events-auto"
      style={{ minWidth: 160 }}
    >
      <div
        className="border border-border-default"
        style={{ background: 'color-mix(in oklch, var(--color-surface-base) 85%, transparent)' }}
      >
        <div className="px-2 py-1 border-b border-border-default">
          <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Scene</span>
        </div>
        <div className="flex flex-col">
          {sceneNodes.length === 0 && (
            <span className="px-2 py-1.5 text-[10px] text-text-muted italic">No objects</span>
          )}
          {sceneNodes.map((node) => {
            const def = getNodeDef(node.type)
            const color = CATEGORY_COLORS[def?.category ?? 'scene'] ?? '#888'
            const isSelected = node.id === selectedId
            const isRenaming = renamingId === node.id

            return (
              <div
                key={node.id}
                className="flex items-center gap-1.5 px-2 py-1"
                style={{ background: isSelected ? 'color-mix(in oklch, var(--color-accent) 15%, transparent)' : undefined }}
              >
                <span className="shrink-0 leading-none flex items-center">
                  <NodeIcon node={node} color={color} />
                </span>
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(node.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(node.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="text-xs font-medium bg-transparent text-text-primary outline-none border-b border-accent flex-1 min-w-0"
                    placeholder="Name…"
                  />
                ) : (
                  <button
                    onClick={() => setSelectedNode(isSelected ? null : node.id)}
                    onDoubleClick={() => startRename(node)}
                    className={`text-xs font-medium text-left flex-1 min-w-0 truncate cursor-pointer ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}
                  >
                    {getNodeDisplayName(node)}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
