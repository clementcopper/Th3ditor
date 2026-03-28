import { useShaderStore } from '../../store/shader-store'
import { Play, Pause } from 'lucide-react'

export function PlaybackBar() {
  const isPlaying = useShaderStore((s) => s.isPlaying)
  const togglePlaying = useShaderStore((s) => s.togglePlaying)

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-surface-primary border border-border-default rounded-lg px-1 py-1 shadow-md">
      <button
        onClick={togglePlaying}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
          isPlaying
            ? 'text-text-secondary hover:bg-surface-secondary'
            : 'bg-brand-500 text-white hover:bg-brand-600'
        }`}
        title={isPlaying ? 'Pause animation' : 'Play animation'}
      >
        {isPlaying ? <Pause size={13} /> : <Play size={13} />}
        {isPlaying ? 'Pause' : 'Play'}
      </button>
    </div>
  )
}
