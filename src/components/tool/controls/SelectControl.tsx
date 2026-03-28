import type { ParameterDef } from '../../../engine/types'

interface Props {
  param: ParameterDef
  value: number
  onChange: (value: number) => void
}

export function SelectControl({ param, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
      <select
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="px-2 py-1.5 rounded-md border border-border-default bg-surface-primary text-xs text-text-primary cursor-pointer hover:border-border-strong transition-colors"
      >
        {param.options?.map((opt, i) => (
          <option key={opt.value} value={i}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
