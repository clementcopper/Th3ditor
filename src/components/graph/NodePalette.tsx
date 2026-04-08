import { useState, useMemo, useEffect, useRef } from 'react'
import { getAllNodeDefs } from '../../graph-engine/node-registry'
import { useGraphStore } from '../../store/graph-store'
import type { NodeDefinition } from '../../types/node-graph'


let nextId = 100

type ContextMenu = {
  screen: { x: number; y: number }
  flow: { x: number; y: number }
}

type Props = {
  contextMenu: ContextMenu | null
  onClose: () => void
}

export function NodePalette({ contextMenu, onClose }: Props) {
  const [search, setSearch] = useState('')
  const addNode = useGraphStore((s) => s.addNode)
  const addEdge = useGraphStore((s) => s.addEdge)
  const panelRef = useRef<HTMLDivElement>(null)

  const allDefs = useMemo(() => getAllNodeDefs(), [])

  const filtered = useMemo(() => {
    if (!search.trim()) return allDefs
    const q = search.toLowerCase()
    return allDefs.filter(
      (d) => d.label.toLowerCase().includes(q) || d.type.toLowerCase().includes(q),
    )
  }, [allDefs, search])

  const grouped = useMemo(() => {
    const map = new Map<string, NodeDefinition[]>()
    for (const def of filtered) {
      if (!map.has(def.category)) map.set(def.category, [])
      map.get(def.category)!.push(def)
    }
    return map
  }, [filtered])

  // Close on click outside
  useEffect(() => {
    if (!contextMenu) return
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid closing on the same click that opened it
    const t = setTimeout(() => window.addEventListener('pointerdown', onPointerDown), 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [contextMenu, onClose])

  // Reset search when menu closes
  useEffect(() => {
    if (!contextMenu) setSearch('')
  }, [contextMenu])

  if (!contextMenu) return null

  const handleAdd = (def: NodeDefinition) => {
    const { x: baseX, y: baseY } = contextMenu.flow

    if (def.type === 'object/mesh') {
      const geoId = `n${nextId++}`
      const matId = `n${nextId++}`
      const meshId = `n${nextId++}`
      addNode({ id: geoId, type: 'geometry', position: { x: baseX - 300, y: baseY - 50 }, data: {} })
      addNode({ id: matId, type: 'material', position: { x: baseX - 300, y: baseY + 80 }, data: {} })
      addNode({ id: meshId, type: 'object/mesh', position: { x: baseX, y: baseY }, data: {} })
      addEdge({ id: `e${nextId++}`, source: geoId, sourceHandle: 'geometry', target: meshId, targetHandle: 'geometry' })
      addEdge({ id: `e${nextId++}`, source: matId, sourceHandle: 'material', target: meshId, targetHandle: 'material' })
    } else {
      const id = `n${nextId++}`
      addNode({ id, type: def.type, position: { x: baseX, y: baseY }, data: {} })
    }
    onClose()
  }

  // Keep menu within viewport
  const menuWidth = 224
  const menuMaxHeight = 320
  const sx = Math.min(contextMenu.screen.x, window.innerWidth - menuWidth - 8)
  const sy = Math.min(contextMenu.screen.y, window.innerHeight - menuMaxHeight - 8)

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', left: sx, top: sy, width: menuWidth, zIndex: 2000 }}
      className="bg-surface-base border border-border-default shadow-xl overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Search */}
      <div className="p-2 border-b border-border-default">
        <input
          autoFocus
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
          }}
          className="w-full px-2 py-1.5 border border-border-default bg-surface-panel text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
        />
      </div>

      {/* List */}
      <div className="overflow-y-auto p-1" style={{ maxHeight: menuMaxHeight - 48 }}>
        {grouped.size === 0 && (
          <div className="px-2 py-3 text-xs text-text-muted text-center">No nodes found</div>
        )}
        {Array.from(grouped.entries()).map(([cat, defs]) => (
          defs.map((def) => (
            <button
              key={def.type}
              onClick={() => handleAdd(def)}
              className="w-full text-left px-2 py-1.5 text-xs text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
            >
              {def.label}
            </button>
          ))
        ))}
      </div>
    </div>
  )
}
