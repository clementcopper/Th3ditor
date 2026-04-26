import { memo } from 'react'
import { Handle, Position, useEdges, type NodeProps } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { getNodeDef } from '../../graph-engine/node-registry'
import { PORT_COLORS, CATEGORY_COLORS, isVisible } from '../../graph-engine/type-system'
import { useGraphStore } from '../../store/graph-store'
import { useEvaluatorStore } from '../../store/evaluator-store'
import { getNodeIcon } from '../../utils/node-icons'

const EMPTY_DATA: Record<string, unknown> = {}

function NodeRendererInner({ id, type, selected }: NodeProps) {
  const def = getNodeDef(type ?? '')
  const nodeData = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data ?? EMPTY_DATA)
  const colorModeNodeIds = useGraphStore(useShallow((s) => s.nodes.filter((n) => n.data.colorMode).map((n) => n.id)))
  // Reactive channel values for shader/color mode 0 swatch (connected shader/math sources)
  const shaderChannelValues = useGraphStore(useShallow((s) => {
    const result: { r?: number; g?: number; b?: number } = {}
    for (const edge of s.edges) {
      if (edge.target !== id) continue
      if (edge.targetHandle !== 'r' && edge.targetHandle !== 'g' && edge.targetHandle !== 'b') continue
      const src = s.nodes.find((n) => n.id === edge.source)
      if (!src) continue
      const raw = (src.data.value as number) ?? 0
      result[edge.targetHandle as 'r' | 'g' | 'b'] = src.data.colorMode ? raw / 255 : raw
    }
    return result
  }))
  const values = useEvaluatorStore((s) => s.values)
  const colorValues = useEvaluatorStore((s) => s.colorValues)
  const edges = useEdges()
  if (!def) return null

  const getData = (uniform: string) => {
    const val = nodeData[uniform]
    return val !== undefined ? val : def.defaults[uniform]
  }

  const visibleInputs = def.inputs.filter((p) => isVisible(p.visibleWhen, getData))
  const visibleOutputs = def.outputs.filter((p) => isVisible(p.visibleWhen, getData))
  const categoryColor = CATEGORY_COLORS[def.category] ?? '#9ca3af'

  // Header: mode prop replaces label entirely (e.g. geometry → "Box")
  // Other select props append to label (e.g. shader/math → "Shader Math: Fract")
  const modeProp = def.properties.find((p) => p.uniform === 'mode' && p.type === 'select')
  const modeValue = modeProp ? Number(getData('mode') ?? 0) : undefined
  const fallbackSelectProp = !modeProp ? def.properties.find((p) => p.type === 'select' && !p.noHeader) : undefined
  const fallbackValue = fallbackSelectProp ? Number(getData(fallbackSelectProp.uniform) ?? 0) : undefined
  const modeLabel = modeProp?.options?.find((o) => Number(o.value) === modeValue)?.label ?? ''
  const baseLabel = modeProp?.options && modeValue !== undefined
    ? modeProp.appendToHeader
      ? `${def.label}: ${modeLabel}`
      : (modeLabel || def.label)
    : fallbackSelectProp?.options && fallbackValue !== undefined
      ? `${def.label}: ${fallbackSelectProp.options.find((o) => Number(o.value) === fallbackValue)?.label ?? ''}`
      : def.label

  // For mesh and light nodes, prepend type prefix and append custom label
  const customLabel = nodeData.label as string | undefined
  const hasTypePrefix = type === 'object/mesh' || type === 'light'
  const headerLabel = hasTypePrefix && customLabel
    ? `${baseLabel}: ${customLabel}`
    : baseLabel

  // For texture/image nodes, show filename + image preview in the body
  const imageFile = type === 'texture' && modeValue === 0
    ? nodeData.imageFile as { name: string; dataUrl?: string } | '' | undefined
    : undefined
  const imageFileName = typeof imageFile === 'object' && imageFile ? imageFile.name : undefined
  const imageDataUrl = typeof imageFile === 'object' && imageFile ? imageFile.dataUrl : undefined

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
      <div className="flex justify-between items-start px-1 py-2 gap-1">
        {/* Inputs — min-w reserves space for float value display so swatch left edge stays stable */}
        <div className="flex flex-col gap-1.5">
          {visibleInputs.map((port) => {
            let portValue: number | undefined
            if (port.type === 'float') {
              const edge = edges.find((e) => e.target === id && e.targetHandle === port.name)
              if (edge) portValue = values.get(`${edge.source}:${edge.sourceHandle}`)
              // Fallback: path-computed values are stored under own node id (e.g. camera on path)
              if (portValue === undefined) portValue = values.get(`${id}:${port.name}`)
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
                {portValue !== undefined && (() => {
                  const srcEdge = edges.find((e) => e.target === id && e.targetHandle === port.name)
                  const isColorMode = srcEdge ? colorModeNodeIds.includes(srcEdge.source) : false
                  return (
                    <span className={`text-[10px] font-mono leading-none text-accent inline-block text-left tabular-nums ${isColorMode ? 'w-5' : 'w-10'}`}>
                      {isColorMode ? portValue.toFixed(0) : portValue.toFixed(2)}
                    </span>
                  )
                })()}
              </div>
            )
          })}
        </div>

        {/* Color preview swatch */}
        {(type === 'color' || type === 'color/mix' || type === 'color/hsl') && (() => {
          const toRgb = (c: [number,number,number,number] | undefined) =>
            c ? `rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})` : undefined

          if (type === 'color/mix') {
            // Find connected colorA/colorB edges and look up evaluated colors
            const aEdge = edges.find((e) => e.target === id && e.targetHandle === 'colorA')
            const bEdge = edges.find((e) => e.target === id && e.targetHandle === 'colorB')
            if (!aEdge && !bEdge) return null

            const colorA = aEdge ? colorValues.get(`${aEdge.source}:${aEdge.sourceHandle}`) : undefined
            const colorB = bEdge ? colorValues.get(`${bEdge.source}:${bEdge.sourceHandle}`) : undefined

            // Compute mixed color
            let mixed: [number,number,number,number] | undefined
            if (colorA && colorB) {
              const t = Math.min(1, Math.max(0, (getData('t') as number) ?? 0.5))
              mixed = [
                colorA[0] + (colorB[0]-colorA[0])*t,
                colorA[1] + (colorB[1]-colorA[1])*t,
                colorA[2] + (colorB[2]-colorA[2])*t,
                colorA[3] + (colorB[3]-colorA[3])*t,
              ]
            } else {
              mixed = colorA ?? colorB
            }

            const bg = toRgb(mixed)
            if (!bg) return null
            return <div className="w-10 h-10 shrink-0 self-center" style={{ background: bg }} />
          }

          // color / color/hsl — prefer live evaluated color, fall back to static property
          const live = colorValues.get(`${id}:color`)
          const c = live ?? getData('color') as [number,number,number,number] | undefined
          const bg = toRgb(c)
          if (!bg) return null
          return <div className="w-10 h-10 shrink-0 self-center" style={{ background: bg }} />
        })()}

        {/* Shader Color preview swatch */}
        {type === 'shader/color' && (() => {
          const colorMode = Number(getData('colorMode') ?? 0)
          const toRgb = (c: number[]) =>
            `rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})`

          if (colorMode === 1) {
            // Mix: single blended color at factor t
            const a = getData('colorA') as number[] | undefined ?? [1,0,0]
            const b = getData('colorB') as number[] | undefined ?? [0,0,1]
            const t = Math.min(1, Math.max(0, (getData('t') as number) ?? 0.5))
            const mixed = [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]
            return <div className="w-10 h-10 shrink-0 self-center" style={{ background: toRgb(mixed) }} />
          }

          if (colorMode === 2) {
            // Ramp: gradient from stops
            const stops = getData('stops') as { pos: number; color: number[] }[] | undefined
            if (!stops || stops.length < 2) return null
            const sorted = [...stops].sort((a, b) => a.pos - b.pos)
            const parts = sorted.map((s) => `${toRgb(s.color)} ${Math.round(s.pos * 100)}%`)
            const bg = `linear-gradient(to right, ${parts.join(', ')})`
            return <div className="w-10 h-10 shrink-0 self-center" style={{ background: bg }} />
          }

          // Mode 0: solid color — use live channel values if any R/G/B port is connected
          const anyChannel = shaderChannelValues.r !== undefined || shaderChannelValues.g !== undefined || shaderChannelValues.b !== undefined
          if (anyChannel) {
            const r = shaderChannelValues.r ?? 0
            const g = shaderChannelValues.g ?? 0
            const b = shaderChannelValues.b ?? 0
            return <div className="w-10 h-10 shrink-0 self-center" style={{ background: toRgb([r, g, b]) }} />
          }
          const c = getData('color') as number[] | undefined ?? [1,1,1]
          return <div className="w-10 h-10 shrink-0 self-center" style={{ background: toRgb(c) }} />
        })()}

        {/* Outputs */}
        <div className="flex flex-col gap-1.5 items-end">
          {visibleOutputs.map((port) => {
            const portValue = port.type === 'float' ? values.get(`${id}:${port.name}`) : undefined
            return (
              <div key={port.name} className="relative flex items-center gap-1">
                {portValue !== undefined && (
                  <span className={`text-[10px] font-mono text-accent inline-block text-right tabular-nums ${nodeData.colorMode ? 'w-5' : 'w-10'}`}>
                    {nodeData.colorMode ? portValue.toFixed(0) : portValue.toFixed(2)}
                  </span>
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

      {/* Image preview + filename for texture/image nodes */}
      {(imageDataUrl || imageFileName) && (
        <div className="pb-1.5">
          {imageDataUrl && (
            <img
              src={imageDataUrl}
              draggable={false}
              className="w-full max-h-16 object-contain block"
              alt=""
            />
          )}
          {imageFileName && (
            <div className="px-2 pt-0.5">
              <span className="text-[9px] text-text-muted font-mono truncate block leading-none">{imageFileName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const NodeRenderer = memo(NodeRendererInner)
