import type { PropertyDef as ParameterDef } from '../../../types/properties'

interface Props {
  param: ParameterDef
  value: boolean
  onChange: (value: boolean) => void
}

export function ToggleControl({ param, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
      <div className="flex border border-border-default overflow-hidden">
        {(['Off', 'On'] as const).map((label, i) => {
          const isActive = value === (i === 1)
          return (
            <button
              key={label}
              onClick={() => onChange(i === 1)}
              className={`flex-1 h-7 text-xs font-medium transition-colors cursor-pointer ${
                isActive ? '' : 'bg-surface-base text-text-secondary hover:bg-surface-panel'
              } ${i > 0 ? 'border-l border-border-default' : ''}`}
              style={isActive ? {
                color: 'var(--color-accent)',
                background: 'color-mix(in oklch, var(--color-accent) 15%, transparent)',
              } : {}}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
