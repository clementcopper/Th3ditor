import { create } from 'zustand'
import type { CompiledScene } from '../types/node-graph'

interface SceneState {
  scene: CompiledScene
  setScene: (scene: CompiledScene) => void
}

export const useSceneStore = create<SceneState>((set) => ({
  scene: { meshes: [], gltfObjects: [], paths: [], lights: [], smoothShading: true, bgColor: '#191614', envIntensity: 1, showEnvBackground: false },
  setScene: (scene) => set({ scene }),
}))
