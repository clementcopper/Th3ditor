import { useState, useRef, useCallback, useEffect } from 'react'
import type { ParameterDef } from '../../../engine/types'

interface Props {
  param: ParameterDef
  value: number
  onChange: (value: number) => void
}

export function SliderControl({ param, value, onChange }: Props) {
  const min = param.min ?? 0
  const max = param.max ?? 1
  const step = param.step ?? 0.01

  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartValue = useRef(0)
  const hasMoved = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const snap = (v: number) => Math.round(v / step) * step

  // Drag-to-scrub on the input field
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isEditing) return
    isDragging.current = true
    hasMoved.current = false
    dragStartX.current = e.clientX
    dragStartValue.current = value
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [value, isEditing])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStartX.current
    if (Math.abs(dx) > 2) hasMoved.current = true
    // Scale drag: range of values across ~300px
    const range = max - min
    const sensitivity = range / 300
    const newVal = snap(clamp(dragStartValue.current + dx * sensitivity))
    onChange(newVal)
  }, [min, max, step, onChange])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    // If no drag happened, enter text edit mode
    if (!hasMoved.current) {
      setIsEditing(true)
      setEditText(value.toFixed(2))
    }
  }, [value])

  // Commit text edit
  const commitEdit = useCallback(() => {
    setIsEditing(false)
    const parsed = parseFloat(editText)
    if (!isNaN(parsed)) {
      onChange(snap(clamp(parsed)))
    }
  }, [editText, onChange, min, max, step])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setIsEditing(false)
            }}
            className="w-16 text-xs font-mono text-right bg-surface-secondary text-text-primary px-1.5 py-0.5 rounded border border-border-default outline-none focus:border-brand-500"
          />
        ) : (
          <span
            className="text-xs font-mono text-text-tertiary px-1.5 py-0.5 rounded cursor-ew-resize hover:bg-surface-secondary hover:text-text-primary transition-colors select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {value.toFixed(2)}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-border-default
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500
          [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm"
      />
    </div>
  )
}
