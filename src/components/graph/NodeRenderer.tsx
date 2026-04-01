import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeDef } from '../../graph-engine/node-registry'
import { PORT_COLORS } from '../../graph-engine/type-system'

function NodeRendererInner({ type, selected }: NodeProps) {
  const def = getNodeDef(type ?? '')
  if (!def) return null

  return (
    <div
      className={`min-w-[140px] rounded-lg border bg-surface-primary shadow-lg ${
        selected ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-border-default'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-1.5 rounded-t-lg bg-surface-secondary border-b border-border-default">
        <span className="text-[11px] font-semibold text-text-primary">{def.label}</span>
      </div>

      {/* Ports */}
      <div className="flex justify-between px-1 py-2 gap-4">
        {/* Inputs */}
        <div className="flex flex-col gap-1.5">
          {def.inputs.map((port) => (
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
          {def.outputs.map((port) => (
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
