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
import { FileControl } from './controls/FileControl'
import type { PropertyDef } from '../../types/properties'

function NodeRefControl({
  prop,
  value,
  onChange,
}: {
  prop: PropertyDef
  value: string
  onChange: (v: string) => void
}) {
  const nodes = useGraphStore((s) => s.nodes)
  const options = nodes.filter((n) =>
    (prop.categories ?? []).includes(getNodeDef(n.type)?.category as string)
  )
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-text-secondary">{prop.label}</span>
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none text-xs bg-surface-base text-text-primary px-2 pr-7 h-7 border border-border-default hover:bg-surface-panel focus:outline-none focus:border-accent cursor-pointer transition-colors"
        >
          <option value="">— None —</option>
          {options.map((n) => (
            <option key={n.id} value={n.id}>
              {(n.data.label as string) || n.type}
            </option>
          ))}
        </select>
        <div className="absolute right-2 top-0 bottom-0 flex items-center pointer-events-none">
          <span className="text-text-muted text-[10px]">▾</span>
        </div>
      </div>
    </div>
  )
}

export function PropertiesPanel() {
  const selectedId = useEditorStore((s) => s.selectedNodeId)
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === selectedId))
  const connectedEdges = useGraphStore(
    useShallow((s) => s.edges.filter((e) => e.target === selectedId))
  )
  const connectedInputPorts = new Set(connectedEdges.map((e) => e.targetHandle))
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const evalValues = useEvaluatorStore((s) => s.values)
  const colorValues = useEvaluatorStore((s) => s.colorValues)

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

        {/* Mix node: show connected input colors as read-only swatches */}
        {node.type === 'color/mix' && (() => {
          const toRgb = (c: [number,number,number,number]) =>
            `rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})`
          const aEdge = connectedEdges.find((e) => e.targetHandle === 'colorA')
          const bEdge = connectedEdges.find((e) => e.targetHandle === 'colorB')
          if (!aEdge && !bEdge) return null
          const colorA = aEdge ? colorValues.get(`${aEdge.source}:${aEdge.sourceHandle}`) : undefined
          const colorB = bEdge ? colorValues.get(`${bEdge.source}:${bEdge.sourceHandle}`) : undefined
          return (
            <div className="flex flex-col gap-1.5">
              {colorA && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text-secondary">A</span>
                  <div className="h-7 border border-border-default" style={{ background: toRgb(colorA) }} />
                </div>
              )}
              {colorB && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text-secondary">B</span>
                  <div className="h-7 border border-border-default" style={{ background: toRgb(colorB) }} />
                </div>
              )}
            </div>
          )
        })()}

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
                }, connectedInputPorts)) return null

                // If linked port is connected, show read-only value instead of control
                if (prop.linkedPort && connectedInputPorts.has(prop.linkedPort)) {
                  const edge = connectedEdges.find((e) => e.targetHandle === prop.linkedPort)
                  const connectedValue = edge ? evalValues.get(`${edge.source}:${edge.sourceHandle}`) : undefined
                  return (
                    <div key={prop.uniform} className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-text-secondary">{prop.label}</span>
                      <div className="h-7 flex items-center justify-center border border-border-default bg-accent/15">
                        <span className="text-xs font-mono text-accent">
                          {connectedValue !== undefined ? connectedValue.toFixed(2) : '—'}
                        </span>
                      </div>
                    </div>
                  )
                }

                // If linkedPath and path port is connected, show path-computed value as display
                if (prop.linkedPath && connectedInputPorts.has('path')) {
                  const pathValue = evalValues.get(`${selectedId}:${prop.uniform}`)
                  return (
                    <div key={prop.uniform} className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-text-secondary">{prop.label}</span>
                      <div className="h-7 flex items-center justify-center border border-border-default bg-accent/15">
                        <span className="text-xs font-mono text-accent">
                          {pathValue !== undefined ? pathValue.toFixed(2) : '—'}
                        </span>
                      </div>
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
                  case 'select': {
                    // Filter options where visibleWhenPortDisconnected points to a connected port
                    const filteredOptions = prop.options?.filter(
                      (o) => !o.visibleWhenPortDisconnected || !connectedInputPorts.has(o.visibleWhenPortDisconnected)
                    )
                    const filteredProp = filteredOptions !== prop.options
                      ? { ...prop, options: filteredOptions }
                      : prop
                    return (
                      <SelectControl
                        key={prop.uniform}
                        param={filteredProp}
                        value={getValue(prop) as number}
                        onChange={(v) => handleChange(prop.uniform, v)}
                      />
                    )
                  }
                  case 'noderef':
                    return (
                      <NodeRefControl
                        key={prop.uniform}
                        prop={prop}
                        value={(getValue(prop) as string) ?? ''}
                        onChange={(v) => handleChange(prop.uniform, v || undefined)}
                      />
                    )
                  case 'file':
                    return (
                      <FileControl
                        key={prop.uniform}
                        param={prop}
                        value={getValue(prop)}
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
