import { useAnimationStore } from '../../store/animation-store'

export function EditorToolbar() {
  const playing = useAnimationStore((s) => s.playing)
  const toggle = useAnimationStore((s) => s.toggle)
  const reset = useAnimationStore((s) => s.reset)
  const elapsed = useAnimationStore((s) => s.elapsed)

  return (
    <div className="h-12 flex items-center px-4 border-b border-border-default bg-surface-base shrink-0 gap-4">
      <span className="text-sm font-semibold text-text-primary tracking-wide">Web Visual Studio</span>

      <div className="flex-1" />

      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="px-3 py-1 rounded-md border border-border-default bg-surface-panel text-xs font-semibold text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={reset}
          className="px-2 py-1 rounded-md border border-border-default bg-surface-panel text-xs text-text-secondary hover:bg-surface-elevated transition-colors cursor-pointer"
        >
          Reset
        </button>
        <span className="text-[10px] font-mono text-text-muted w-16 text-right">
          {elapsed.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}
