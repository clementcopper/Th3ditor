import { useState, useRef, useCallback, useEffect } from 'react'
import type { PropertyDef as ParameterDef } from '../../../types/properties'

interface Props {
  param: ParameterDef
  value: number
  onChange: (value: number) => void
  onBeforeChange?: () => void
}

export function SliderControl({ param, value, onChange, onBeforeChange }: Props) {
  const min = param.min ?? 0
  const max = param.max ?? 1
  const step = param.step ?? 0.01
  const hardMinVal = param.hardMin ?? min
  const hardMaxVal = param.hardMax ?? max

  const clampDrag = (v: number) => Math.min(max, Math.max(min, v))
  const clampTyped = (v: number) => Math.min(hardMaxVal, Math.max(hardMinVal, v))
  const snap = (v: number) => Math.round(v / step) * step
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const fillPercent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  const [localText, setLocalText] = useState(() => value.toFixed(decimals))
  const inputFocused = useRef(false)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartValue = useRef(0)
  const wheelSnapped = useRef(false)
  const wheelIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  // Sync text display when value changes externally (not while user is typing)
  useEffect(() => {
    if (!inputFocused.current) setLocalText(value.toFixed(decimals))
  }, [value, decimals])

  const commitEdit = useCallback(() => {
    inputFocused.current = false
    const parsed = parseFloat(localText)
    if (!isNaN(parsed)) {
      onBeforeChange?.()
      onChange(snap(clampTyped(parsed)))
    } else {
      setLocalText(value.toFixed(decimals))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localText, onChange, onBeforeChange, value, decimals])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    onBeforeChange?.()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartValue.current = value
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [value, onBeforeChange])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStartX.current
    const newVal = snap(clampDrag(dragStartValue.current + dx * (max - min) / 300))
    onChange(newVal)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step, onChange])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  useEffect(() => {
    const el = sliderRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!wheelSnapped.current) { onBeforeChange?.(); wheelSnapped.current = true }
      if (wheelIdleTimer.current) clearTimeout(wheelIdleTimer.current)
      wheelIdleTimer.current = setTimeout(() => { wheelSnapped.current = false }, 500)
      onChange(snap(clampTyped(value + (e.deltaY < 0 ? 1 : -1) * step)))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, step, onChange])

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
      <div className="flex gap-1.5 h-7">
        {/* Drag slider */}
        <div
          ref={sliderRef}
          className="relative flex-1 h-full border border-border-default overflow-hidden select-none cursor-ew-resize"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className="absolute inset-y-0 left-0 bg-accent/15 pointer-events-none transition-[width] duration-75"
            style={{ width: `${fillPercent}%` }}
          />
          <div
            className="absolute inset-y-0 bg-accent/40 pointer-events-none transition-[left] duration-75"
            style={{ left: `${fillPercent}%`, width: '3px' }}
          />
        </div>
        {/* Value input */}
        <input
          ref={inputRef}
          type="text"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onFocus={() => { inputFocused.current = true; inputRef.current?.select() }}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
            if (e.key === 'Escape') { setLocalText(value.toFixed(decimals)); inputRef.current?.blur() }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              const n = parseFloat(localText)
              if (!isNaN(n)) {
                const v = snap(clampTyped(n + (e.key === 'ArrowUp' ? step : -step)))
                setLocalText(v.toFixed(decimals))
                onBeforeChange?.()
                onChange(v)
              }
            }
          }}
          className="w-12 h-full shrink-0 border border-border-default bg-surface-elevated text-xs font-mono text-text-primary text-center outline-none px-1"
        />
      </div>
    </div>
  )
}
