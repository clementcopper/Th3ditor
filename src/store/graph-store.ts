import { create } from 'zustand'
import type { GraphNode, GraphEdge } from '../types/node-graph'

interface GraphState {
  nodes: GraphNode[]
  edges: GraphEdge[]

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
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],

  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes, node] })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    })),

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

  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges, edge] })),

  removeEdge: (id) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}))
