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
        <div className="flex border border-border-default overflow-hidden">
          {options.map((opt, i) => {
            const isActive = value === parseFloat(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => onChange(parseFloat(opt.value))}
                className={`flex-1 px-2 h-7 text-xs font-medium transition-colors cursor-pointer ${
                  isActive ? '' : 'bg-surface-base text-text-secondary hover:bg-surface-panel'
                } ${i > 0 ? 'border-l border-border-default' : ''}`}
                style={isActive ? {
                  color: 'var(--color-accent)',
                  background: 'color-mix(in oklch, var(--color-accent) 15%, transparent)',
                } : {}}
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
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full appearance-none px-2 pr-7 h-7 border border-border-default bg-surface-base text-xs text-text-primary cursor-pointer hover:bg-surface-panel transition-colors"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-2 top-0 bottom-0 flex items-center pointer-events-none">
          <span className="text-text-muted text-[10px]">▾</span>
        </div>
      </div>
    </div>
  )
}
