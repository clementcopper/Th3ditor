import { useEffect, useState } from 'react'
import { ArrowCounterClockwise, ArrowClockwise, FolderOpen, FloppyDisk } from '@phosphor-icons/react'
import { useGraphStore } from '../../store/graph-store'
import { saveProject, loadProjectFromFile } from '../../utils/project'

export function EditorToolbar() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    return useGraphStore.subscribe((state) => {
      setCanUndo(state.canUndo)
      setCanRedo(state.canRedo)
    })
  }, [])

  const handleSave = () => saveProject(nodes, edges)

  const handleOpen = async () => {
    try {
      const data = await loadProjectFromFile()
      setNodes(data.nodes)
      setEdges(data.edges)
    } catch {
      // user cancelled or invalid file — silent
    }
  }

  return (
    <div className="h-10 flex items-center px-4 gap-1 border-b border-border-default bg-surface-base shrink-0">
      <button
        onClick={handleOpen}
        title="Open project"
        className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
      >
        <FolderOpen size={14} />
      </button>
      <button
        onClick={handleSave}
        title="Save project"
        className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
      >
        <FloppyDisk size={14} />
      </button>

      <div className="w-px h-5 bg-border-default mx-1" />

      <button
        onClick={() => useGraphStore.getState().undo()}
        title="Undo (⌘Z)"
        style={{ opacity: canUndo ? 1 : 0.3 }}
        className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
      >
        <ArrowCounterClockwise size={14} />
      </button>
      <button
        onClick={() => useGraphStore.getState().redo()}
        title="Redo (⌘⇧Z)"
        style={{ opacity: canRedo ? 1 : 0.3 }}
        className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
      >
        <ArrowClockwise size={14} />
      </button>

      <span className="ml-auto text-sm font-semibold text-text-accent tracking-wide">Thr3ditor</span>
    </div>
  )
}
