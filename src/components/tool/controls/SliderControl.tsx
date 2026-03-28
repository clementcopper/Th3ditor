import type { ParameterDef } from '../../../engine/types'

interface Props {
  param: ParameterDef
  value: number
  onChange: (value: number) => void
}

export function SliderControl({ param, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
        <span className="text-xs font-mono text-text-tertiary">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={param.min ?? 0}
        max={param.max ?? 1}
        step={param.step ?? 0.01}
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
