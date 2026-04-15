import { create } from 'zustand'
import type { GraphNode, GraphEdge } from '../types/node-graph'

// Module-level history (outside Zustand state to avoid triggering renders on every snapshot)
const _history: Array<{ nodes: GraphNode[]; edges: GraphEdge[] }> = []
const _future:  Array<{ nodes: GraphNode[]; edges: GraphEdge[] }> = []
const MAX_HISTORY = 50


interface GraphState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  canUndo: boolean
  canRedo: boolean

  // Node CRUD
  addNode: (node: GraphNode) => void
  removeNode: (id: string) => void
  updateNodeData: (id: string, data: Record<string, unknown>) => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void

  // Edge CRUD
  addEdge: (edge: GraphEdge) => void
  removeEdge: (id: string) => void

  // Bulk
  setNodes: (nodes: GraphNode[]) => void
  setEdges: (edges: GraphEdge[]) => void

  // History
  snapshot: () => void
  undo: () => void
  redo: () => void
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  canUndo: false,
  canRedo: false,

  snapshot: () => {
    const { nodes, edges } = get()
    _history.push({ nodes, edges })
    if (_history.length > MAX_HISTORY) _history.shift()
    _future.length = 0
    set({ canUndo: true, canRedo: false })
  },

  undo: () => {
    if (_history.length === 0) return
    const { nodes, edges } = get()
    _future.push({ nodes, edges })
    const prev = _history.pop()!
    set({ nodes: prev.nodes, edges: prev.edges, canUndo: _history.length > 0, canRedo: true })
  },

  redo: () => {
    if (_future.length === 0) return
    const { nodes, edges } = get()
    _history.push({ nodes, edges })
    const next = _future.pop()!
    set({ nodes: next.nodes, edges: next.edges, canUndo: true, canRedo: _future.length > 0 })
  },

  addNode: (node) => {
    get().snapshot()
    set((s) => ({ nodes: [...s.nodes, node] }))
  },

  removeNode: (id) => {
    get().snapshot()
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    }))
  },

  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
      ),
    })),

  updateNodePosition: (id, position) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    })),

  addEdge: (edge) => {
    get().snapshot()
    set((s) => ({ edges: [...s.edges, edge] }))
  },

  removeEdge: (id) => {
    get().snapshot()
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }))
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}))
