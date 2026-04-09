import { memo } from 'react'
import { Handle, Position, useEdges, type NodeProps } from '@xyflow/react'
import { getNodeDef } from '../../graph-engine/node-registry'
import { PORT_COLORS, CATEGORY_COLORS, isVisible } from '../../graph-engine/type-system'
import { useGraphStore } from '../../store/graph-store'
import { useEvaluatorStore } from '../../store/evaluator-store'
import { getNodeIcon } from '../../utils/node-icons'

const EMPTY_DATA: Record<string, unknown> = {}

function NodeRendererInner({ id, type, selected }: NodeProps) {
  const def = getNodeDef(type ?? '')
  const nodeData = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data ?? EMPTY_DATA)
  const values = useEvaluatorStore((s) => s.values)
  const edges = useEdges()
  if (!def) return null

  const getData = (uniform: string) => {
    const val = nodeData[uniform]
    return val !== undefined ? val : def.defaults[uniform]
  }

  const visibleInputs = def.inputs.filter((p) => isVisible(p.visibleWhen, getData))
  const visibleOutputs = def.outputs.filter((p) => isVisible(p.visibleWhen, getData))
  const categoryColor = CATEGORY_COLORS[def.category] ?? '#9ca3af'

  // Header shows subtype name (e.g. "Add") instead of category (e.g. "Math")
  const modeValue = getData('mode') as number | undefined
  const modeProp = def.properties.find((p) => p.uniform === 'mode' && p.type === 'select')
  const baseLabel = (modeProp?.options && modeValue !== undefined)
    ? (modeProp.options[modeValue]?.label ?? def.label)
    : def.label

  // For mesh and light nodes, prepend type prefix and append custom label
  const customLabel = nodeData.label as string | undefined
  const hasTypePrefix = type === 'object/mesh' || type === 'light'
  const headerLabel = hasTypePrefix && customLabel
    ? `${baseLabel}: ${customLabel}`
    : baseLabel

  const Icon = getNodeIcon(type ?? '', def.category, nodeData)

  return (
    <div
      className={`min-w-[140px] rounded-lg border bg-surface-base shadow-lg ${
        selected ? 'border-accent ring-1 ring-accent/30' : 'border-border-default'
      }`}
    >
      {/* Header with category color */}
      <div
        className="px-3 py-1.5 rounded-t-lg border-b border-border-default flex items-center gap-1.5"
        style={{ backgroundColor: categoryColor + '15'}}
      >
        <span className="flex items-center shrink-0"><Icon size={11} weight="fill" color={categoryColor} /></span>
        <span className="text-[11px] font-semibold text-text-primary leading-none">{headerLabel}</span>
      </div>

      {/* Ports */}
      <div className="flex justify-between px-1 py-2 gap-4">
        {/* Inputs */}
        <div className="flex flex-col gap-1.5">
          {visibleInputs.map((port) => {
            let portValue: number | undefined
            if (port.type === 'float') {
              const edge = edges.find((e) => e.target === id && e.targetHandle === port.name)
              if (edge) portValue = values.get(`${edge.source}:${edge.sourceHandle}`)
            }
            return (
              <div key={port.name} className="relative flex items-center gap-1">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={port.name}
                  className="!w-2.5 !h-2.5 !rounded-full !border-2 !border-surface-base"
                  style={{ background: PORT_COLORS[port.type], left: -5 }}
                />
                <span className="text-[10px] text-text-muted ml-2 leading-none">{port.label ?? port.name}</span>
                {portValue !== undefined && (
                  <span className="text-[10px] font-mono leading-none text-accent">{portValue.toFixed(2)}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-1.5 items-end">
          {visibleOutputs.map((port) => {
            const portValue = port.type === 'float' ? values.get(`${id}:${port.name}`) : undefined
            return (
              <div key={port.name} className="relative flex items-center gap-1">
                {portValue !== undefined && (
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-accent)' }}>{portValue.toFixed(2)}</span>
                )}
                <span className="text-[10px] text-text-muted mr-2 leading-none">{port.label ?? port.name}</span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={port.name}
                  className="!w-2.5 !h-2.5 !rounded-full !border-2 !border-surface-base"
                  style={{ background: PORT_COLORS[port.type], right: -5 }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const NodeRenderer = memo(NodeRendererInner)
