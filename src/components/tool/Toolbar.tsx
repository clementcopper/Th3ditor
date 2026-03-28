import { useShaderStore, type RenderQuality } from '../../store/shader-store'
import { Download, Share2 } from 'lucide-react'

interface Props {
  onExport?: () => void
  onShare?: () => void
}

const QUALITY_OPTIONS: { id: RenderQuality; label: string }[] = [
  { id: 'ultra-low', label: '0.25x' },
  { id: 'low', label: '0.5x' },
  { id: 'medium', label: '1x' },
  { id: 'high', label: '1.5x' },
]

export function Toolbar({ onExport, onShare }: Props) {
  const activePreset = useShaderStore((s) => s.activePreset)
  const renderQuality = useShaderStore((s) => s.renderQuality)
  const setRenderQuality = useShaderStore((s) => s.setRenderQuality)

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface-primary border-b border-border-default">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-text-primary">Shadertool</h1>
        <span className="text-xs text-text-tertiary">/</span>
        <span className="text-sm text-text-secondary">{activePreset.name}</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Render quality */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-text-tertiary uppercase">Quality</span>
          <div className="flex gap-0.5 bg-surface-secondary rounded-md p-0.5">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRenderQuality(opt.id)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors cursor-pointer ${
                  renderQuality === opt.id
                    ? 'bg-surface-primary text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-border-default" />

        <button
          onClick={onShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors cursor-pointer"
        >
          <Share2 size={14} />
          Share
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors cursor-pointer"
        >
          <Download size={14} />
          Export
        </button>
      </div>
    </div>
  )
}
