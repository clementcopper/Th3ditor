import { useShaderStore } from '../../store/shader-store'
import { SliderControl } from './controls/SliderControl'
import { ColorControl } from './controls/ColorControl'
import { ToggleControl } from './controls/ToggleControl'
import { SelectControl } from './controls/SelectControl'
import { RotateCcw } from 'lucide-react'

export function ParameterPanel() {
  const activePreset = useShaderStore((s) => s.activePreset)
  const parameters = useShaderStore((s) => s.parameters)
  const setParameter = useShaderStore((s) => s.setParameter)
  const resetParameters = useShaderStore((s) => s.resetParameters)

  // Group parameters by their group field
  const groups = new Map<string, typeof activePreset.parameters>()
  for (const param of activePreset.parameters) {
    const group = param.group ?? 'General'
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(param)
  }

  return (
    <div className="flex flex-col h-full bg-surface-primary border-l border-border-default">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <h3 className="text-sm font-semibold text-text-primary">Parameters</h3>
        <button
          onClick={resetParameters}
          className="p-1.5 rounded-md hover:bg-surface-secondary transition-colors text-text-tertiary hover:text-text-primary cursor-pointer"
          title="Reset to defaults"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {Array.from(groups.entries()).map(([groupName, params]) => (
          <div key={groupName}>
            <h4 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              {groupName}
            </h4>
            <div className="space-y-3">
              {params.map((param) => {
                const value = parameters[param.uniform]
                if (param.type === 'color') {
                  // Support both vec3 [r,g,b] and vec4 [r,g,b,a]
                  const colorValue = value as number[]
                  const rgba: [number, number, number, number] = colorValue.length === 4
                    ? colorValue as [number, number, number, number]
                    : [colorValue[0], colorValue[1], colorValue[2], 1]
                  return (
                    <ColorControl
                      key={param.uniform}
                      param={param}
                      value={rgba}
                      onChange={(v) => setParameter(param.uniform, v)}
                    />
                  )
                }
                if (param.type === 'bool') {
                  return (
                    <ToggleControl
                      key={param.uniform}
                      param={param}
                      value={value as boolean}
                      onChange={(v) => setParameter(param.uniform, v)}
                    />
                  )
                }
                if (param.type === 'select') {
                  return (
                    <SelectControl
                      key={param.uniform}
                      param={param}
                      value={value as number}
                      onChange={(v) => setParameter(param.uniform, v)}
                    />
                  )
                }
                if (param.type === 'float' || param.type === 'int') {
                  return (
                    <SliderControl
                      key={param.uniform}
                      param={param}
                      value={value as number}
                      onChange={(v) => setParameter(param.uniform, v)}
                    />
                  )
                }
                return null
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
