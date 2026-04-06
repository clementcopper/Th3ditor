import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeDef } from '../../graph-engine/node-registry'
import { PORT_COLORS, CATEGORY_COLORS, isVisible } from '../../graph-engine/type-system'
import { useGraphStore } from '../../store/graph-store'

function NodeRendererInner({ id, type, selected }: NodeProps) {
  const def = getNodeDef(type ?? '')
  const nodeData = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data ?? {})
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
  const headerLabel = (modeProp?.options && modeValue !== undefined)
    ? (modeProp.options[modeValue]?.label ?? def.label)
    : def.label

  return (
    <div
      className={`min-w-[140px] rounded-lg border bg-surface-primary shadow-lg ${
        selected ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-border-default'
      }`}
    >
      {/* Header with category color */}
      <div
        className="px-3 py-1.5 rounded-t-lg border-b border-border-default"
        style={{ backgroundColor: categoryColor + '15'}}
      >
        <span className="text-[11px] font-semibold text-text-primary">{headerLabel}</span>
      </div>

      {/* Ports */}
      <div className="flex justify-between px-1 py-2 gap-4">
        {/* Inputs */}
        <div className="flex flex-col gap-1.5">
          {visibleInputs.map((port) => (
            <div key={port.name} className="relative flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={port.name}
                className="!w-2.5 !h-2.5 !rounded-full !border-2 !border-surface-primary"
                style={{ background: PORT_COLORS[port.type], left: -5 }}
              />
              <span className="text-[10px] text-text-secondary ml-2">{port.label ?? port.name}</span>
            </div>
          ))}
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-1.5 items-end">
          {visibleOutputs.map((port) => (
            <div key={port.name} className="relative flex items-center">
              <span className="text-[10px] text-text-secondary mr-2">{port.label ?? port.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={port.name}
                className="!w-2.5 !h-2.5 !rounded-full !border-2 !border-surface-primary"
                style={{ background: PORT_COLORS[port.type], right: -5 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const NodeRenderer = memo(NodeRendererInner)
