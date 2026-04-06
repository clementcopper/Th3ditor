import { create } from 'zustand'

interface EvaluatorState {
  /** Evaluated float values keyed by "nodeId:portName" */
  values: Map<string, number>
  setValues: (v: Map<string, number>) => void
}

export const useEvaluatorStore = create<EvaluatorState>((set) => ({
  values: new Map(),
  setValues: (v) => set({ values: new Map(v) }),
}))
