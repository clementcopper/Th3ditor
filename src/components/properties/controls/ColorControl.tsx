import { RgbColorPicker } from 'react-colorful'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { PropertyDef as ParameterDef } from '../../../types/properties'
import {
  type RGBA,
  rgbaToHex8,
  rgbaToHex6,
  hexToRgba,
} from '../../../utils/color'
import { SliderControl } from './SliderControl'

interface Props {
  param: ParameterDef
  value: [number, number, number] | [number, number, number, number]
  onChange: (value: [number, number, number, number]) => void
  onBeforeChange?: () => void
  hiddenChannels?: Set<string>
}

function makeChannelParam(label: string, min: number, max: number): ParameterDef {
  return { type: 'float', uniform: '', label, min, max, step: 1, default: 0 }
}

export function ColorControl({ param, value, onChange, onBeforeChange, hiddenChannels }: Props) {
  const rgba: RGBA = value.length === 4 ? value as RGBA : [value[0], value[1], value[2], 1]
  const inline = param.inline ?? false
  const [open, setOpen] = useState(false)
  const [hexInput, setHexInput] = useState(rgbaToHex6(rgba))
  const ref = useRef<HTMLDivElement>(null)
  const inlineSnapped = useRef(false)
  const inlineIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (!inline && open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [inline, open])

  useEffect(() => {
    setHexInput(rgbaToHex6(rgba))
  }, [rgba[0], rgba[1], rgba[2]]) // eslint-disable-line react-hooks/exhaustive-deps

  const fireBeforeChange = useCallback(() => {
    if (inline) {
      if (!inlineSnapped.current) { onBeforeChange?.(); inlineSnapped.current = true }
      if (inlineIdleTimer.current) clearTimeout(inlineIdleTimer.current)
      inlineIdleTimer.current = setTimeout(() => { inlineSnapped.current = false }, 500)
    }
  }, [inline, onBeforeChange])

  const handlePickerChange = useCallback(
    (color: { r: number; g: number; b: number }) => {
      fireBeforeChange()
      onChange([color.r / 255, color.g / 255, color.b / 255, rgba[3]])
    },
    [onChange, fireBeforeChange, rgba],
  )

  const handleHexCommit = useCallback(
    (hex: string) => {
      let clean = hex.trim()
      if (!clean.startsWith('#')) clean = '#' + clean
      if (/^#[0-9a-fA-F]{6,8}$/.test(clean)) {
        fireBeforeChange()
        const newRgba = hexToRgba(clean)
        newRgba[3] = rgba[3]
        onChange(newRgba)
        setHexInput(clean.slice(0, 7))
      }
    },
    [rgba, onChange, fireBeforeChange],
  )

  const hex8 = rgbaToHex8(rgba)
  const displayHex = rgbaToHex6(rgba)
  const pickerColor = {
    r: Math.round(rgba[0] * 255),
    g: Math.round(rgba[1] * 255),
    b: Math.round(rgba[2] * 255),
  }

  const channels: { label: string; val: number; param: ParameterDef; onCh: (v: number) => void }[] = [
    { label: 'R', val: Math.round(rgba[0] * 255), param: makeChannelParam('R', 0, 255),
      onCh: (v) => { fireBeforeChange(); onChange([v / 255, rgba[1], rgba[2], rgba[3]]) } },
    { label: 'G', val: Math.round(rgba[1] * 255), param: makeChannelParam('G', 0, 255),
      onCh: (v) => { fireBeforeChange(); onChange([rgba[0], v / 255, rgba[2], rgba[3]]) } },
    { label: 'B', val: Math.round(rgba[2] * 255), param: makeChannelParam('B', 0, 255),
      onCh: (v) => { fireBeforeChange(); onChange([rgba[0], rgba[1], v / 255, rgba[3]]) } },
  ]

  const pickerContent = (
    <>
      {/* 2D saturation/brightness + hue */}
      <div className="mb-2 [&_.react-colorful]:!w-full [&_.react-colorful]:!h-[160px]">
        <RgbColorPicker color={pickerColor} onChange={handlePickerChange} />
      </div>

      {/* HEX — full width */}
      <div className="flex flex-col gap-1 mb-2">
        <label className="text-xs font-semibold text-text-secondary">Hex</label>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={(e) => handleHexCommit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleHexCommit((e.target as HTMLInputElement).value) }}
          className="w-full h-7 px-2 border border-border-default bg-surface-elevated text-[11px] font-mono text-text-primary text-center outline-none"
          maxLength={7}
        />
      </div>

      {/* R G B — one SliderControl row each (hidden when port connected) */}
      <div className="flex flex-col gap-1.5">
        {channels.filter(({ label }) => !hiddenChannels?.has(label.toLowerCase())).map(({ label, val, param: cp, onCh }) => (
          <SliderControl
            key={label}
            param={cp}
            value={val}
            onChange={onCh}
            onBeforeChange={fireBeforeChange}
          />
        ))}
      </div>
    </>
  )

  if (inline) {
    return <div className="flex flex-col gap-1">{pickerContent}</div>
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>

      <button
        onClick={() => { if (!open) onBeforeChange?.(); setOpen(!open) }}
        className="flex items-center gap-2 px-2 h-7 border border-border-default bg-surface-base hover:bg-surface-panel transition-colors cursor-pointer"
      >
        <div className="relative w-5 h-5 border border-border-default overflow-hidden">
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
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-surface-panel border border-border-default shadow-xl p-3">
          {pickerContent}
        </div>
      )}
    </div>
  )
}
