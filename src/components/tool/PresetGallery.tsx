import { presets } from '../../presets'
import { useShaderStore } from '../../store/shader-store'
import type { ShaderPreset } from '../../engine/types'

const categoryLabels: Record<string, string> = {
  gradient: 'Gradients',
  noise: 'Noise & Textures',
  pointcloud: 'Point Clouds',
  geometric: 'Geometric',
  organic: 'Organic',
  atmospheric: 'Atmospheric',
  abstract: 'Abstract',
}

export function PresetGallery() {
  const activePreset = useShaderStore((s) => s.activePreset)
  const setActivePreset = useShaderStore((s) => s.setActivePreset)

  // Group by category
  const categories = new Map<string, ShaderPreset[]>()
  for (const preset of presets) {
    if (!categories.has(preset.category)) categories.set(preset.category, [])
    categories.get(preset.category)!.push(preset)
  }

  return (
    <div className="flex flex-col h-full bg-surface-primary border-r border-border-default">
      <div className="px-4 py-3 border-b border-border-default">
        <h3 className="text-sm font-semibold text-text-primary">Presets</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {Array.from(categories.entries()).map(([cat, catPresets]) => (
          <div key={cat}>
            <h4 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-1">
              {categoryLabels[cat] ?? cat}
            </h4>
            <div className="space-y-1">
              {catPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setActivePreset(preset)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                    activePreset.id === preset.id
                      ? 'bg-brand-500 text-white'
                      : 'text-text-primary hover:bg-surface-secondary'
                  }`}
                >
                  <div className="font-medium">{preset.name}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      activePreset.id === preset.id ? 'text-white/70' : 'text-text-tertiary'
                    }`}
                  >
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
