import { RgbaColorPicker } from 'react-colorful'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { PropertyDef as ParameterDef } from '../../../types/properties'
import {
  type RGBA,
  rgbaToHex8,
  rgbaToHex6,
  hexToRgba,
} from '../../../utils/color'

interface Props {
  param: ParameterDef
  value: [number, number, number] | [number, number, number, number]
  onChange: (value: [number, number, number, number]) => void
  onBeforeChange?: () => void
}

function ChannelSlider({ label, value, min, max, onChange, onDragStart }: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  onDragStart?: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const startRef = useRef<{ x: number; v: number } | null>(null)
  const movedRef = useRef(false)
  const firedRef = useRef(false)
  const fillPct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, v: value }
    movedRef.current = false
    firedRef.current = false
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!startRef.current || !(e.buttons & 1)) return
    const delta = e.clientX - startRef.current.x
    if (Math.abs(delta) > 1) {
      if (!firedRef.current) { onDragStart?.(); firedRef.current = true }
      movedRef.current = true
    }
    onChange(Math.max(min, Math.min(max, Math.round(startRef.current.v + delta * (max - min) / 150))))
  }

  function handlePointerUp() {
    if (!movedRef.current) { setEditVal(String(value)); setIsEditing(true) }
    startRef.current = null
  }

  function commitEdit() {
    const n = parseInt(editVal, 10)
    if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)))
    setIsEditing(false)
  }

  return (
    <div className="flex-1 flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold text-text-muted text-center uppercase">{label}</span>
      <div
        className="relative h-6 border border-border-default overflow-hidden select-none"
        style={{ cursor: isEditing ? 'text' : 'ew-resize' }}
        onPointerDown={isEditing ? undefined : handlePointerDown}
        onPointerMove={isEditing ? undefined : handlePointerMove}
        onPointerUp={isEditing ? undefined : handlePointerUp}
      >
        <div className="absolute inset-y-0 left-0 bg-accent/15 pointer-events-none" style={{ width: `${fillPct}%` }} />
        <div className="absolute inset-y-0 bg-accent/40 pointer-events-none" style={{ left: `${fillPct}%`, width: '2px' }} />
        {isEditing ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
              if (e.key === 'Escape') setIsEditing(false)
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                const n = parseInt(editVal, 10)
                if (!isNaN(n)) {
                  const v = Math.max(min, Math.min(max, n + (e.key === 'ArrowUp' ? 1 : -1)))
                  setEditVal(String(v))
                  onChange(v)
                }
              }
            }}
            className="absolute inset-0 w-full bg-transparent text-center text-[11px] font-mono text-text-primary outline-none border-none px-0"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono text-text-primary pointer-events-none">
            {value}
          </span>
        )}
      </div>
    </div>
  )
}

export function ColorControl({ param, value, onChange, onBeforeChange }: Props) {
  const rgba: RGBA = value.length === 4 ? value as RGBA : [value[0], value[1], value[2], 1]
  const inline = param.inline ?? false
  const [open, setOpen] = useState(false)
  const [hexInput, setHexInput] = useState(rgbaToHex6(rgba))
  const ref = useRef<HTMLDivElement>(null)
  // Snapshot-once-per-gesture tracking (for inline mode)
  const inlineSnapped = useRef(false)
  const inlineIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on outside click (dropdown mode only)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (!inline && open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [inline, open])

  // Sync hex input when value changes externally
  useEffect(() => {
    setHexInput(rgbaToHex6(rgba))
  }, [rgba[0], rgba[1], rgba[2]]) // eslint-disable-line react-hooks/exhaustive-deps

  // For inline mode: snapshot only on first interaction per gesture, reset after 500ms idle
  const fireBeforeChange = useCallback(() => {
    if (inline) {
      if (!inlineSnapped.current) {
        onBeforeChange?.()
        inlineSnapped.current = true
      }
      if (inlineIdleTimer.current) clearTimeout(inlineIdleTimer.current)
      inlineIdleTimer.current = setTimeout(() => { inlineSnapped.current = false }, 500)
    }
    // Dropdown mode: snapshot fired once on open (see button click handler)
  }, [inline, onBeforeChange])

  const handlePickerChange = useCallback(
    (color: { r: number; g: number; b: number; a: number }) => {
      fireBeforeChange()
      onChange([color.r / 255, color.g / 255, color.b / 255, color.a])
    },
    [onChange, fireBeforeChange],
  )

  const handleChannelChange = useCallback(
    (ch: 'r' | 'g' | 'b', val255: number) => {
      fireBeforeChange()
      const v = Math.min(255, Math.max(0, Math.round(val255))) / 255
      const next: RGBA = [rgba[0], rgba[1], rgba[2], rgba[3]]
      next[ch === 'r' ? 0 : ch === 'g' ? 1 : 2] = v
      onChange(next)
    },
    [rgba, onChange, fireBeforeChange],
  )

  const handleHexCommit = useCallback(
    (hex: string) => {
      let clean = hex.trim()
      if (!clean.startsWith('#')) clean = '#' + clean
      if (/^#[0-9a-fA-F]{6,8}$/.test(clean)) {
        fireBeforeChange()
        const newRgba = hexToRgba(clean)
        newRgba[3] = rgba[3] // preserve alpha
        onChange(newRgba)
        setHexInput(clean.slice(0, 7))
      }
    },
    [rgba, onChange, fireBeforeChange],
  )

  const hex8 = rgbaToHex8(rgba)
  const displayHex = rgbaToHex6(rgba)

  // Picker color in {r,g,b,a} format for react-colorful
  const pickerColor = {
    r: Math.round(rgba[0] * 255),
    g: Math.round(rgba[1] * 255),
    b: Math.round(rgba[2] * 255),
    a: rgba[3],
  }

  const pickerContent = (
    <>
      {/* Color picker (2D saturation/brightness + hue + alpha sliders) */}
      <div className="mb-2 [&_.react-colorful]:!w-full [&_.react-colorful]:!h-[160px] [&_.react-colorful__pointer]:!w-6 [&_.react-colorful__pointer]:!h-6 [&_.react-colorful__pointer]:![border-width:1px]">
        <RgbaColorPicker color={pickerColor} onChange={handlePickerChange} />
      </div>

      {/* Row 1: R G B sliders */}
      <div className="flex gap-1.5 mb-1.5">
        {(['r', 'g', 'b'] as const).map((ch, i) => (
          <ChannelSlider
            key={ch}
            label={ch}
            value={Math.round(rgba[i] * 255)}
            min={0}
            max={255}
            onChange={(v) => handleChannelChange(ch, v)}
            onDragStart={fireBeforeChange}
          />
        ))}
      </div>

      {/* Row 2: Alpha slider + HEX (narrow) */}
      <div className="flex gap-1.5">
        <ChannelSlider
          label="A %"
          value={Math.round(rgba[3] * 100)}
          min={0}
          max={100}
          onChange={(v) => { fireBeforeChange(); onChange([rgba[0], rgba[1], rgba[2], v / 100]) }}
          onDragStart={fireBeforeChange}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-text-muted text-center uppercase">Hex</span>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={(e) => handleHexCommit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleHexCommit((e.target as HTMLInputElement).value)
            }}
            className="w-[66px] h-6 px-1.5 border border-border-default bg-surface-elevated text-[11px] font-mono text-text-primary text-center"
            maxLength={9}
          />
        </div>
      </div>
    </>
  )

  if (inline) {
    return (
      <div className="flex flex-col gap-1">
        {pickerContent}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>

      {/* Swatch + hex display */}
      <button
        onClick={() => { if (!open) onBeforeChange?.(); setOpen(!open) }}
        className="flex items-center gap-2 px-2 h-7 border border-border-default bg-surface-base hover:bg-surface-panel transition-colors cursor-pointer"
      >
        <div className="relative w-5 h-5 border border-border-default overflow-hidden">
          {/* Checkerboard for alpha */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
              backgroundSize: '6px 6px',
              backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
            }}
          />
          <div className="absolute inset-0" style={{ backgroundColor: hex8 }} />
        </div>
        <span className="text-xs font-mono text-text-secondary">{displayHex}</span>
        {rgba[3] < 1 && (
          <span className="text-xs font-mono text-text-muted">{Math.round(rgba[3] * 100)}%</span>
        )}
      </button>

      {/* Picker popover — matches header width via left-0 right-0 */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-surface-panel border border-border-default shadow-xl p-3">
          {pickerContent}
        </div>
      )}
    </div>
  )
}
