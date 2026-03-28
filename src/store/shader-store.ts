import { create } from 'zustand'
import type { ShaderPreset } from '../engine/types'
import { presets } from '../presets'

interface ShaderState {
  activePreset: ShaderPreset
  parameters: Record<string, number | boolean | number[] | string>
  setActivePreset: (preset: ShaderPreset) => void
  setParameter: (uniform: string, value: number | boolean | number[] | string) => void
  resetParameters: () => void
}

function getDefaults(preset: ShaderPreset): Record<string, number | boolean | number[] | string> {
  const defaults: Record<string, number | boolean | number[] | string> = {}
  for (const param of preset.parameters) {
    defaults[param.uniform] = param.default as number | boolean | number[] | string
  }
  return defaults
}

export const useShaderStore = create<ShaderState>((set) => ({
  activePreset: presets[0],
  parameters: getDefaults(presets[0]),
  setActivePreset: (preset) =>
    set({ activePreset: preset, parameters: getDefaults(preset) }),
  setParameter: (uniform, value) =>
    set((state) => ({
      parameters: { ...state.parameters, [uniform]: value },
    })),
  resetParameters: () =>
    set((state) => ({
      parameters: getDefaults(state.activePreset),
    })),
}))
