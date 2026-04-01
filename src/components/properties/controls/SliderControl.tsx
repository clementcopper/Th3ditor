import { useState, useRef, useCallback, useEffect } from 'react'
import type { PropertyDef as ParameterDef } from '../../../types/properties'

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
  const fieldRef = useRef<HTMLDivElement>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const snap = (v: number) => Math.round(v / step) * step
  const fillPercent = ((value - min) / (max - min)) * 100

  // Determine display precision from step
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2

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
    const range = max - min
    const sensitivity = range / 300
    const newVal = snap(clamp(dragStartValue.current + dx * sensitivity))
    onChange(newVal)
  }, [min, max, step, onChange])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    if (!hasMoved.current) {
      setIsEditing(true)
      setEditText(value.toFixed(decimals))
    }
  }, [value, decimals])

  const commitEdit = useCallback(() => {
    setIsEditing(false)
    const parsed = parseFloat(editText)
    if (!isNaN(parsed)) {
      onChange(snap(clamp(parsed)))
    }
  }, [editText, onChange, min, max, step])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
      <div
        ref={fieldRef}
        className="relative h-7 rounded border border-border-default overflow-hidden select-none"
        style={{ cursor: isEditing ? 'text' : 'ew-resize' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Fill bar */}
        <div
          className="absolute inset-y-0 left-0 bg-brand-500/15 pointer-events-none transition-[width] duration-75"
          style={{ width: `${fillPercent}%` }}
        />
        {/* Fill edge accent */}
        <div
          className="absolute inset-y-0 bg-brand-500/40 pointer-events-none transition-[left] duration-75"
          style={{ left: `${fillPercent}%`, width: '3px' }}
        />

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
            className="absolute inset-0 w-full h-full text-xs font-mono text-center bg-surface-secondary text-text-primary px-2 outline-none border-none"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-mono text-text-primary">
              {value.toFixed(decimals)}{param.suffix ?? ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
