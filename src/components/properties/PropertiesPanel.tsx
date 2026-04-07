import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../../store/editor-store'
import { useGraphStore } from '../../store/graph-store'
import { useEvaluatorStore } from '../../store/evaluator-store'
import { getNodeDef } from '../../graph-engine/node-registry'
import { isVisible } from '../../graph-engine/type-system'
import { SliderControl } from './controls/SliderControl'
import { ColorControl } from './controls/ColorControl'
import { ToggleControl } from './controls/ToggleControl'
import { SelectControl } from './controls/SelectControl'
import type { PropertyDef } from '../../types/properties'

export function PropertiesPanel() {
  const selectedId = useEditorStore((s) => s.selectedNodeId)
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === selectedId))
  const connectedEdges = useGraphStore(
    useShallow((s) => s.edges.filter((e) => e.target === selectedId))
  )
  const connectedInputPorts = new Set(connectedEdges.map((e) => e.targetHandle))
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const evalValues = useEvaluatorStore((s) => s.values)

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <span className="text-xs text-text-muted">Select a node to edit properties</span>
      </div>
    )
  }

  const def = getNodeDef(node.type)
  if (!def || def.properties.length === 0) {
    return (
      <div className="h-full p-4">
        <div className="text-xs font-semibold text-text-primary mb-2">{def?.label ?? node.type}</div>
        <span className="text-xs text-text-muted">No editable properties</span>
      </div>
    )
  }

  const getValue = (prop: PropertyDef) => {
    const val = node.data[prop.uniform]
    return val !== undefined ? val : prop.default
  }

  const handleChange = (uniform: string, value: unknown) => {
    updateNodeData(node.id, { [uniform]: value })
  }

  // Group properties
  const groups = new Map<string, PropertyDef[]>()
  for (const prop of def.properties) {
    const group = prop.group ?? ''
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(prop)
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-default">
        <span className="text-xs font-semibold text-text-primary">{def.label}</span>
        <span className="text-[10px] text-text-muted ml-2">{node.id}</span>
      </div>

      {/* Properties */}
      <div className="p-4 flex flex-col gap-3">
        {Array.from(groups.entries()).map(([group, props]) => (
          <div key={group}>
            {group && (
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">{group}</div>
            )}
            <div className="flex flex-col gap-2">
              {props.map((prop) => {
                // visibleWhen check
                if (!isVisible(prop.visibleWhen, (u) => {
                  const p = def.properties.find((p) => p.uniform === u)
                  return p ? getValue(p) : undefined
                })) return null

                // If linked port is connected, show read-only value instead of control
                if (prop.linkedPort && connectedInputPorts.has(prop.linkedPort)) {
                  const edge = connectedEdges.find((e) => e.targetHandle === prop.linkedPort)
                  const connectedValue = edge ? evalValues.get(`${edge.source}:${edge.sourceHandle}`) : undefined
                  return (
                    <div key={prop.uniform} className="flex items-center gap-2">
                      <span className="text-[10px] text-text-muted shrink-0">{prop.label}</span>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5"
                        style={{ color: 'var(--color-accent)', background: 'color-mix(in oklch, var(--color-accent) 12%, transparent)' }}
                      >
                        → {connectedValue !== undefined ? connectedValue.toFixed(2) : '—'}
                      </span>
                    </div>
                  )
                }

                switch (prop.type) {
                  case 'float':
                  case 'int':
                    return (
                      <SliderControl
                        key={prop.uniform}
                        param={prop}
                        value={getValue(prop) as number}
                        onChange={(v) => handleChange(prop.uniform, v)}
                      />
                    )
                  case 'color':
                    return (
                      <ColorControl
                        key={prop.uniform}
                        param={prop}
                        value={getValue(prop) as [number, number, number, number]}
                        onChange={(v) => handleChange(prop.uniform, v)}
                      />
                    )
                  case 'bool':
                    return (
                      <ToggleControl
                        key={prop.uniform}
                        param={prop}
                        value={getValue(prop) as boolean}
                        onChange={(v) => handleChange(prop.uniform, v)}
                      />
                    )
                  case 'select':
                    return (
                      <SelectControl
                        key={prop.uniform}
                        param={prop}
                        value={getValue(prop) as number}
                        onChange={(v) => handleChange(prop.uniform, v)}
                      />
                    )
                  default:
                    return null
                }
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
