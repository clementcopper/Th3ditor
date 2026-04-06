import type { PropertyDef as ParameterDef } from '../../../types/properties'

interface Props {
  param: ParameterDef
  value: number
  onChange: (value: number) => void
}

export function SelectControl({ param, value, onChange }: Props) {
  const options = param.options ?? []

  // Toggle button group for 3 or fewer options
  if (options.length <= 3) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
        <div className="flex rounded-md border border-border-default overflow-hidden">
          {options.map((opt, i) => {
            const isActive = value === parseFloat(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => onChange(parseFloat(opt.value))}
                className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-base text-text-secondary hover:bg-surface-panel'
                } ${i > 0 ? 'border-l border-border-default' : ''}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
      <select
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="px-2 py-1.5 rounded-md border border-border-default bg-surface-base text-xs text-text-primary cursor-pointer hover:border-border-strong transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
