import type { ShaderPreset } from '../engine/types'
import { meshGradientPreset } from './mesh-gradient.preset'
import { gradientOrbPreset } from './gradient-orb.preset'
import { flowFieldPreset } from './flow-field.preset'
import { pointCloud3DPreset } from './point-cloud-3d.preset'
import { dotMatrixPreset } from './dot-matrix.preset'
import { voronoiCellsPreset } from './voronoi-cells.preset'
import { waveInterferencePreset } from './wave-interference.preset'
import { organicBlobPreset } from './organic-blob.preset'
import { auroraPreset } from './aurora.preset'

export const presets: ShaderPreset[] = [
  meshGradientPreset,
  gradientOrbPreset,
  flowFieldPreset,
  pointCloud3DPreset,
  dotMatrixPreset,
  voronoiCellsPreset,
  waveInterferencePreset,
  organicBlobPreset,
  auroraPreset,
]

export function getPresetById(id: string): ShaderPreset | undefined {
  return presets.find(p => p.id === id)
}
