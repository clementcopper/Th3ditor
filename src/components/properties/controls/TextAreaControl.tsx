import type { PropertyDef as ParameterDef } from '../../../types/properties'

interface Props {
  param: ParameterDef
  value: string
  onChange: (value: string) => void
}

export function TextAreaControl({ param, value, onChange }: Props) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newValue)
      // Restore cursor after state update
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="w-full min-h-32 resize-y font-mono text-xs text-text-primary bg-surface-base border border-border-default px-2 py-1.5 outline-none focus:border-accent/60 leading-relaxed"
        style={{ tabSize: 2 }}
      />
    </div>
  )
}
