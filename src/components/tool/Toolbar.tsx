import { useShaderStore } from '../../store/shader-store'
import { Download, Share2 } from 'lucide-react'

interface Props {
  onExport?: () => void
  onShare?: () => void
}

export function Toolbar({ onExport, onShare }: Props) {
  const activePreset = useShaderStore((s) => s.activePreset)

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface-primary border-b border-border-default">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-text-primary">Shadertool</h1>
        <span className="text-xs text-text-tertiary">/</span>
        <span className="text-sm text-text-secondary">{activePreset.name}</span>
      </div>

      <div className="flex items-center gap-1">
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
