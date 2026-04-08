import { create } from 'zustand'

export type ViewMode = 'split' | 'graph' | 'viewport'
export type ShadingMode = 'shaded' | 'wireframe'
export type ProjectionMode = 'perspective' | 'orthographic'
export type GizmoMode = 'translate' | 'rotate' | 'scale'
export type SnapView = 'top' | 'bottom' | 'right' | 'left' | 'front' | 'back' | null

interface EditorState {
  selectedNodeId: string | null
  viewMode: ViewMode
  shadingMode: ShadingMode
  projectionMode: ProjectionMode
  gizmoMode: GizmoMode
  snapToView: SnapView
  setSelectedNode: (id: string | null) => void
  setViewMode: (mode: ViewMode) => void
  setShadingMode: (mode: ShadingMode) => void
  setProjectionMode: (mode: ProjectionMode) => void
  setGizmoMode: (mode: GizmoMode) => void
  setSnapToView: (view: SnapView) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedNodeId: null,
  viewMode: 'split',
  shadingMode: 'shaded',
  projectionMode: 'perspective',
  gizmoMode: 'translate',
  snapToView: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setShadingMode: (mode) => set({ shadingMode: mode }),
  setProjectionMode: (mode) => set({ projectionMode: mode }),
  setGizmoMode: (mode) => set({ gizmoMode: mode }),
  setSnapToView: (view) => set({ snapToView: view }),
}))
