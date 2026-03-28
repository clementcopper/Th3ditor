import { create } from 'zustand'
import type { ShaderPreset } from '../engine/types'
import { presets } from '../presets'

export type RenderQuality = 'full' | 'high' | 'medium' | 'low' | 'ultra-low'

export const QUALITY_DPR: Record<RenderQuality, number> = {
  full: window.devicePixelRatio,
  high: Math.min(window.devicePixelRatio, 1.5),
  medium: 1,
  low: 0.5,
  'ultra-low': 0.25,
}

interface ShaderState {
  activePreset: ShaderPreset
  parameters: Record<string, number | boolean | number[] | string>
  renderQuality: RenderQuality
  isPlaying: boolean
  setActivePreset: (preset: ShaderPreset) => void
  setParameter: (uniform: string, value: number | boolean | number[] | string) => void
  resetParameters: () => void
  setRenderQuality: (quality: RenderQuality) => void
  togglePlaying: () => void
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
  renderQuality: 'ultra-low' as RenderQuality,
  isPlaying: false,
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
  setRenderQuality: (quality) =>
    set({ renderQuality: quality }),
  togglePlaying: () =>
    set((state) => ({ isPlaying: !state.isPlaying })),
}))
