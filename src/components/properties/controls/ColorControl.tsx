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
      <div className="mb-2 [&_.react-colorful]:!w-full [&_.react-colorful]:!h-[160px]">
        <RgbaColorPicker color={pickerColor} onChange={handlePickerChange} />
      </div>

      {/* Row 1: R G B */}
      <div className="flex gap-1.5 mb-1.5">
        {(['r', 'g', 'b'] as const).map((ch, i) => (
          <div key={ch} className="flex-1 flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold text-text-muted text-center uppercase">{ch}</span>
            <input
              type="number"
              min={0}
              max={255}
              step={1}
              value={Math.round(rgba[i] * 255)}
              onChange={(e) => handleChannelChange(ch, Number(e.target.value))}
              className="w-full px-1 py-1 border border-border-default bg-surface-elevated text-[11px] font-mono text-text-primary text-center"
            />
          </div>
        ))}
      </div>

      {/* Row 2: HEX field + Alpha % */}
      <div className="flex gap-1.5">
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-text-muted text-center uppercase">Hex</span>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={(e) => handleHexCommit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleHexCommit((e.target as HTMLInputElement).value)
            }}
            className="w-full px-1.5 py-1 border border-border-default bg-surface-elevated text-[11px] font-mono text-text-primary text-center"
            maxLength={9}
          />
        </div>
        <div className="w-14 flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-text-muted text-center uppercase">A %</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={Math.round(rgba[3] * 100)}
            onChange={(e) => {
              fireBeforeChange()
              const a = Math.min(100, Math.max(0, Number(e.target.value))) / 100
              onChange([rgba[0], rgba[1], rgba[2], a])
            }}
            className="w-full px-1 py-1 border border-border-default bg-surface-elevated text-[11px] font-mono text-text-primary text-center"
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

      {/* Picker popover */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 bg-surface-panel border border-border-default shadow-xl p-3 w-[240px]">
          {pickerContent}
        </div>
      )}
    </div>
  )
}
