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

// Display order for categories
const CATEGORY_ORDER: NodeDefinition['category'][] = [
  'scene', 'object', 'geometry', 'material', 'transform',
  'light', 'camera', 'path', 'shader', 'texture', 'color',
  'math', 'time', 'input', 'effect',
]

const CATEGORY_LABELS: Record<NodeDefinition['category'], string> = {
  scene: 'Scene', object: 'Object', geometry: 'Geometry', material: 'Material',
  transform: 'Transform', light: 'Light', camera: 'Camera', path: 'Path',
  shader: 'Shader', texture: 'Texture', color: 'Color', math: 'Math',
  time: 'Time', input: 'Input', effect: 'Effect',
}

// Category groups for filter buttons
const FILTER_GROUPS: Record<string, NodeDefinition['category'][]> = {
  '3D':     ['scene', 'object', 'geometry', 'material', 'transform', 'light', 'camera', 'path', 'texture', 'color', 'math', 'time', 'input'],
  'Shader': ['shader'],
}

export function NodePalette({ contextMenu, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const addNode = useGraphStore((s) => s.addNode)
  const addEdge = useGraphStore((s) => s.addEdge)
  const panelRef = useRef<HTMLDivElement>(null)

  const allDefs = useMemo(() => getAllNodeDefs().filter((d) => !d.hidden), [])

  const filtered = useMemo(() => {
    let defs = allDefs
    // Apply category filters — union of all active groups; if none active show all
    if (activeFilters.size > 0) {
      const allowed = new Set<NodeDefinition['category']>()
      for (const label of activeFilters) {
        for (const cat of FILTER_GROUPS[label] ?? []) allowed.add(cat)
      }
      defs = defs.filter((d) => allowed.has(d.category))
    }
    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase()
      defs = defs.filter(
        (d) => d.label.toLowerCase().includes(q) || d.type.toLowerCase().includes(q),
      )
    }
    return defs
  }, [allDefs, search, activeFilters])

  // Group by category, respecting display order
  const grouped = useMemo(() => {
    const map = new Map<NodeDefinition['category'], NodeDefinition[]>()
    for (const def of filtered) {
      if (!map.has(def.category)) map.set(def.category, [])
      map.get(def.category)!.push(def)
    }
    const result: [NodeDefinition['category'], NodeDefinition[]][] = []
    for (const cat of CATEGORY_ORDER) {
      if (map.has(cat)) result.push([cat, map.get(cat)!])
    }
    for (const [cat, defs] of map.entries()) {
      if (!CATEGORY_ORDER.includes(cat)) result.push([cat, defs])
    }
    return result
  }, [filtered])

  // Close on click outside
  useEffect(() => {
    if (!contextMenu) return
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const t = setTimeout(() => window.addEventListener('pointerdown', onPointerDown), 50)
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', onPointerDown) }
  }, [contextMenu, onClose])

  // Reset only search on close — filter state persists
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
      addNode({ id: `n${nextId++}`, type: def.type, position: { x: baseX, y: baseY }, data: {} })
    }
    onClose()
  }

  // Keep menu within viewport
  const menuWidth = 224
  const menuMaxHeight = 420
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
      <div className="p-2 pb-1.5 border-b border-border-default">
        <input
          autoFocus
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
          className="w-full px-2 py-1.5 border border-border-default bg-surface-panel text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
        />
        {/* Filter toggles */}
        <div className="flex gap-1 mt-1.5">
          {Object.keys(FILTER_GROUPS).map((label) => {
            const active = activeFilters.has(label)
            return (
              <button
                key={label}
                onClick={() => setActiveFilters((prev) => {
                  const next = new Set(prev)
                  active ? next.delete(label) : next.add(label)
                  return next
                })}
                className={`flex-1 h-6 text-[10px] font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'border-accent text-accent bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)]'
                    : 'border-border-default text-text-muted hover:text-text-primary hover:bg-surface-panel'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Node list */}
      <div className="overflow-y-auto p-1" style={{ maxHeight: menuMaxHeight - 72 }}>
        {grouped.length === 0 && (
          <div className="px-2 py-3 text-xs text-text-muted text-center">No nodes found</div>
        )}
        {grouped.map(([cat, defs]) => (
          <div key={cat}>
            <div className="px-2 py-0.5 mt-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {CATEGORY_LABELS[cat] ?? cat}
            </div>
            {defs.map((def) => (
              <button
                key={def.type}
                onClick={() => handleAdd(def)}
                className="w-full text-left px-3 py-1 text-xs text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
              >
                {def.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
