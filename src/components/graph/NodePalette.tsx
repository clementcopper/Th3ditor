import { useState, useMemo } from 'react'
import { getAllNodeDefs } from '../../graph-engine/node-registry'
import { useGraphStore } from '../../store/graph-store'
import type { NodeDefinition } from '../../types/node-graph'

const CATEGORY_LABELS: Record<string, string> = {
  geometry: 'Geometry',
  material: 'Material',
  object: 'Object',
  transform: 'Transform',
  light: 'Light',
  camera: 'Camera',
  shader: 'Shader',
  math: 'Math',
  color: 'Color',
  texture: 'Texture',
  time: 'Time',
  input: 'Input',
  effect: 'Effect',
  scene: 'Scene',
}

let nextId = 100

export function NodePalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const addNode = useGraphStore((s) => s.addNode)

  const allDefs = useMemo(() => getAllNodeDefs(), [])

  const filtered = useMemo(() => {
    if (!search.trim()) return allDefs
    const q = search.toLowerCase()
    return allDefs.filter(
      (d) => d.label.toLowerCase().includes(q) || d.type.toLowerCase().includes(q),
    )
  }, [allDefs, search])

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, NodeDefinition[]>()
    for (const def of filtered) {
      if (!map.has(def.category)) map.set(def.category, [])
      map.get(def.category)!.push(def)
    }
    return map
  }, [filtered])

  const handleAdd = (def: NodeDefinition) => {
    const id = `n${nextId++}`
    addNode({
      id,
      type: def.type,
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: {},
    })
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="absolute top-2 left-2 z-10">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-md bg-surface-base border border-border-default shadow-md text-xs font-semibold text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
        >
          + Add Node
        </button>
      ) : (
        <div className="w-56 bg-surface-base border border-border-default rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border-default">
            <input
              autoFocus
              type="text"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setSearch('') }
              }}
              className="w-full px-2 py-1.5 rounded border border-border-default bg-surface-panel text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
            />
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto p-1">
            {grouped.size === 0 && (
              <div className="px-2 py-3 text-xs text-text-muted text-center">No nodes found</div>
            )}
            {Array.from(grouped.entries()).map(([cat, defs]) => (
              <div key={cat}>
                <div className="px-2 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  {CATEGORY_LABELS[cat] ?? cat}
                </div>
                {defs.map((def) => (
                  <button
                    key={def.type}
                    onClick={() => handleAdd(def)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
                  >
                    {def.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Close */}
          <div className="p-1 border-t border-border-default">
            <button
              onClick={() => { setOpen(false); setSearch('') }}
              className="w-full px-2 py-1 text-[10px] text-text-muted hover:text-text-secondary cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
