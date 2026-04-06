import type { PropertyDef as ParameterDef } from '../../../types/properties'

interface Props {
  param: ParameterDef
  value: boolean
  onChange: (value: boolean) => void
}

export function ToggleControl({ param, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
      <button
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative ${
          value ? 'bg-brand-500' : 'bg-border-default'
        }`}
      >
        <div
          className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-0.75 transition-transform ${
            value ? 'translate-x-4.5' : 'translate-x-0.75'
          }`}
        />
      </button>
    </div>
  )
}
