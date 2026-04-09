import { RgbaColorPicker } from 'react-colorful'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { PropertyDef as ParameterDef } from '../../../types/properties'
import {
  type RGBA,
  type ColorSpace,
  rgbaToHex8,
  rgbaToHex6,
  hexToRgba,
  rgbaToColorFields,
  colorFieldsToRgba,
} from '../../../utils/color'

interface Props {
  param: ParameterDef
  value: [number, number, number] | [number, number, number, number]
  onChange: (value: [number, number, number, number]) => void
}

const COLOR_SPACES: { id: ColorSpace; label: string }[] = [
  { id: 'hex', label: 'HEX' },
  { id: 'rgb', label: 'RGB' },
  { id: 'hsl', label: 'HSL' },
  { id: 'oklch', label: 'OKLCH' },
]

export function ColorControl({ param, value, onChange }: Props) {
  const rgba: RGBA = value.length === 4 ? value as RGBA : [value[0], value[1], value[2], 1]
  const [open, setOpen] = useState(false)
  const [space, setSpace] = useState<ColorSpace>('hex')
  const [hexInput, setHexInput] = useState(rgbaToHex6(rgba))
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Sync hex input when value changes externally
  useEffect(() => {
    setHexInput(rgbaToHex6(rgba))
  }, [rgba[0], rgba[1], rgba[2]]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePickerChange = useCallback(
    (color: { r: number; g: number; b: number; a: number }) => {
      onChange([color.r / 255, color.g / 255, color.b / 255, color.a])
    },
    [onChange],
  )

  const handleFieldChange = useCallback(
    (index: number, val: number) => {
      const fields = rgbaToColorFields(rgba, space)
      const newValues = [...fields.values]
      newValues[index] = val
      onChange(colorFieldsToRgba(newValues, space, hexInput))
    },
    [rgba, space, hexInput, onChange],
  )

  const handleHexCommit = useCallback(
    (hex: string) => {
      let clean = hex.trim()
      if (!clean.startsWith('#')) clean = '#' + clean
      if (/^#[0-9a-fA-F]{6,8}$/.test(clean)) {
        const newRgba = hexToRgba(clean)
        newRgba[3] = rgba[3] // preserve alpha
        onChange(newRgba)
        setHexInput(clean.slice(0, 7))
      }
    },
    [rgba, onChange],
  )

  const hex8 = rgbaToHex8(rgba)
  const displayHex = rgbaToHex6(rgba)
  const fields = rgbaToColorFields(rgba, space)

  // Picker color in {r,g,b,a} format for react-colorful
  const pickerColor = {
    r: Math.round(rgba[0] * 255),
    g: Math.round(rgba[1] * 255),
    b: Math.round(rgba[2] * 255),
    a: rgba[3],
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>

      {/* Swatch + hex display */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 h-7 border border-border-default bg-surface-base hover:bg-surface-panel transition-colors cursor-pointer"
      >
        <div className="relative w-5 h-5 rounded border border-border-default overflow-hidden">
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
          <span className="text-xs font-mono text-text-tertiary">{Math.round(rgba[3] * 100)}%</span>
        )}
      </button>

      {/* Picker popover */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 bg-surface-panel border border-border-default shadow-xl p-3 w-[240px]">
          {/* Color picker */}
          <div className="mb-3 [&_.react-colorful]:!w-full [&_.react-colorful]:!h-[160px]">
            <RgbaColorPicker color={pickerColor} onChange={handlePickerChange} />
          </div>

          {/* Color space tabs */}
          <div className="flex border border-border-default overflow-hidden mb-3">
            {COLOR_SPACES.map((cs, i) => {
              const isActive = space === cs.id
              return (
                <button
                  key={cs.id}
                  onClick={() => setSpace(cs.id)}
                  className={`flex-1 h-7 text-xs font-medium transition-colors cursor-pointer ${
                    isActive ? '' : 'bg-surface-base text-text-secondary hover:bg-surface-panel'
                  } ${i > 0 ? 'border-l border-border-default' : ''}`}
                  style={isActive ? {
                    color: 'var(--color-accent)',
                    background: 'color-mix(in oklch, var(--color-accent) 15%, transparent)',
                  } : {}}
                >
                  {cs.label}
                </button>
              )
            })}
          </div>

          {/* Value inputs */}
          <div className="flex gap-1.5">
            {space === 'hex' ? (
              <>
                {/* HEX input */}
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-text-tertiary text-center">HEX</span>
                  <input
                    type="text"
                    value={hexInput}
                    onChange={(e) => setHexInput(e.target.value)}
                    onBlur={(e) => handleHexCommit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleHexCommit((e.target as HTMLInputElement).value)
                    }}
                    className="w-full px-1.5 py-1 rounded border border-border-default bg-surface-elevated text-[11px] font-mono text-text-primary text-center"
                    maxLength={9}
                  />
                </div>
                {/* Alpha */}
                <div className="w-12 flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-text-tertiary text-center">A</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(rgba[3] * 100)}
                    onChange={(e) => {
                      const newAlpha = Math.min(100, Math.max(0, Number(e.target.value))) / 100
                      onChange([rgba[0], rgba[1], rgba[2], newAlpha])
                    }}
                    className="w-full px-1 py-1 rounded border border-border-default bg-surface-elevated text-[11px] font-mono text-text-primary text-center"
                  />
                </div>
              </>
            ) : (
              /* RGB / HSL / OKLCH fields */
              fields.labels.map((label, i) => (
                <div key={label} className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-text-tertiary text-center">{label}</span>
                  <input
                    type="number"
                    min={fields.ranges[i][0]}
                    max={fields.ranges[i][1]}
                    step={fields.steps[i]}
                    value={fields.values[i]}
                    onChange={(e) => handleFieldChange(i, Number(e.target.value))}
                    className="w-full px-1 py-1 rounded border border-border-default bg-surface-elevated text-[11px] font-mono text-text-primary text-center"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
