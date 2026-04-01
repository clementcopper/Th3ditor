import { create } from 'zustand'

export type ViewMode = 'split' | 'graph' | 'viewport'

interface EditorState {
  selectedNodeId: string | null
  viewMode: ViewMode
  setSelectedNode: (id: string | null) => void
  setViewMode: (mode: ViewMode) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedNodeId: null,
  viewMode: 'split',
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
}))
