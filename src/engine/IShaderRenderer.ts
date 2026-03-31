import type { UniformValue } from './types'

export interface IShaderRenderer {
  loadShader(source: string): string | null
  setUniform(name: string, value: UniformValue): void
  play(): void
  pause(): void
  renderCurrentFrame(): void
  renderFrame(time: number): void
  dispose(): void
  readonly playing: boolean
}
