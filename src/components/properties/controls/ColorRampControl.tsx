import { useState, useRef } from 'react'
import { RgbaColorPicker } from 'react-colorful'
import type { PropertyDef } from '../../../types/properties'
import type { ColorRampStop } from '../../../types/properties'

interface Props {
  param: PropertyDef
  value: ColorRampStop[]
  onChange: (stops: ColorRampStop[]) => void
}

function stopToCss(c: [number, number, number, number]): string {
  return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3]})`
}

function gradientCss(stops: ColorRampStop[]): string {
  const sorted = [...stops].sort((a, b) => a.pos - b.pos)
  const parts = sorted.map((s) => `${stopToCss(s.color)} ${(s.pos * 100).toFixed(1)}%`)
  return `linear-gradient(to right, ${parts.join(', ')})`
}

function interpolateColor(stops: ColorRampStop[], pos: number): [number, number, number, number] {
  const sorted = [...stops].sort((a, b) => a.pos - b.pos)
  if (pos <= sorted[0].pos) return sorted[0].color
  if (pos >= sorted[sorted.length - 1].pos) return sorted[sorted.length - 1].color
  for (let i = 0; i < sorted.length - 1; i++) {
    if (pos >= sorted[i].pos && pos <= sorted[i + 1].pos) {
      const t = (pos - sorted[i].pos) / (sorted[i + 1].pos - sorted[i].pos)
      const a = sorted[i].color
      const b = sorted[i + 1].color
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]
    }
  }
  return [1, 1, 1, 1]
}

const DEFAULT_STOPS: ColorRampStop[] = [
  { pos: 0, color: [0, 0, 0, 1] },
  { pos: 1, color: [1, 1, 1, 1] },
]

export function ColorRampControl({ param, value, onChange }: Props) {
  const stops = value && value.length >= 2 ? value : DEFAULT_STOPS
  const [selectedIdx, setSelectedIdx] = useState<number>(0)
  const barRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ idx: number; startX: number; startPos: number } | null>(null)

  function getPosFromClientX(clientX: number): number {
    if (!barRef.current) return 0
    const rect = barRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function handleBarClick(e: React.MouseEvent) {
    const pos = getPosFromClientX(e.clientX)
    // Don't add stop if we're very close to an existing one (within 3%)
    for (const s of stops) {
      if (Math.abs(s.pos - pos) < 0.03) return
    }
    const color = interpolateColor(stops, pos)
    const newStops = [...stops, { pos, color }]
    onChange(newStops)
    setSelectedIdx(newStops.length - 1)
  }

  function handleStopPointerDown(e: React.PointerEvent, idx: number) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedIdx(idx)
    dragRef.current = { idx, startX: e.clientX, startPos: stops[idx].pos }
  }

  function handleStopPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !barRef.current) return
    const { idx, startX, startPos } = dragRef.current
    const rect = barRef.current.getBoundingClientRect()
    const delta = (e.clientX - startX) / rect.width
    const newPos = Math.max(0, Math.min(1, startPos + delta))
    onChange(stops.map((s, i) => (i === idx ? { ...s, pos: newPos } : s)))
  }

  function handleStopPointerUp() {
    dragRef.current = null
  }

  function handleDeleteStop(idx: number, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (stops.length <= 2) return
    const newStops = stops.filter((_, i) => i !== idx)
    onChange(newStops)
    setSelectedIdx(Math.min(selectedIdx, newStops.length - 1))
  }

  function handleColorChange(c: { r: number; g: number; b: number; a: number }) {
    onChange(stops.map((s, i) => i === selectedIdx
      ? { ...s, color: [c.r / 255, c.g / 255, c.b / 255, c.a] as [number, number, number, number] }
      : s
    ))
  }

  const selectedStop = stops[selectedIdx] ?? stops[0]

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>

      {/* Gradient bar — click to add stop */}
      <div
        ref={barRef}
        className="h-7 w-full cursor-crosshair border border-border-default"
        style={{ background: gradientCss(stops) }}
        onClick={handleBarClick}
        title="Click to add stop"
      />

      {/* Stop handles row */}
      <div className="relative h-5 w-full">
        {stops.map((stop, idx) => {
          const isSelected = selectedIdx === idx
          return (
            <div
              key={idx}
              className="absolute top-0 -translate-x-1/2 cursor-grab active:cursor-grabbing touch-none"
              style={{ left: `${stop.pos * 100}%`, zIndex: isSelected ? 10 : 1 }}
              onPointerDown={(e) => handleStopPointerDown(e, idx)}
              onPointerMove={handleStopPointerMove}
              onPointerUp={handleStopPointerUp}
              onContextMenu={(e) => handleDeleteStop(idx, e)}
            >
              {/* Triangle marker pointing up */}
              <div
                className="w-0 h-0 mx-auto"
                style={{
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderBottom: `7px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)'}`,
                }}
              />
              {/* Color swatch */}
              <div
                className={`w-[10px] h-[10px] border mx-auto -mt-0.5 ${isSelected ? 'border-accent' : 'border-border-default'}`}
                style={{ backgroundColor: stopToCss(stop.color) }}
              />
            </div>
          )
        })}
      </div>

      {/* Color picker for selected stop */}
      <div className="[&_.react-colorful]:!w-full [&_.react-colorful]:!h-[130px]">
        <RgbaColorPicker
          color={{
            r: Math.round(selectedStop.color[0] * 255),
            g: Math.round(selectedStop.color[1] * 255),
            b: Math.round(selectedStop.color[2] * 255),
            a: selectedStop.color[3],
          }}
          onChange={handleColorChange}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[9px] text-text-muted">
          Click gradient to add · Right-click to remove
        </p>
        <span className="text-[9px] text-text-tertiary">{stops.length} stops</span>
      </div>
    </div>
  )
}
