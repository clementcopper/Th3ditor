import { create } from 'zustand'

type RGBA = [number, number, number, number]

interface EvaluatorState {
  /** Evaluated float values keyed by "nodeId:portName" */
  values: Map<string, number>
  /** Evaluated color values keyed by "nodeId:portName" */
  colorValues: Map<string, RGBA>
  setValues: (floats: Map<string, number>, colors: Map<string, RGBA>) => void
}

export const useEvaluatorStore = create<EvaluatorState>((set) => ({
  values: new Map(),
  colorValues: new Map(),
  setValues: (floats, colors) => set({ values: new Map(floats), colorValues: new Map(colors) }),
}))
