import {
  Cube, Shapes, PaintBucket, ArrowsOutCardinal,
  Sun, ArrowUpRight, Lightbulb, Camera,
  MathOperations, Clock, CursorClick, Stack, Image, Palette, Code,
} from '@phosphor-icons/react'
import type { NodeDefinition } from '../types/node-graph'

export type PhosphorIcon = React.ComponentType<{ size?: number; weight?: string; color?: string }>

const CATEGORY_ICON_MAP: Record<NodeDefinition['category'], PhosphorIcon> = {
  geometry:  Shapes,
  material:  PaintBucket,
  object:    Cube,
  transform: ArrowsOutCardinal,
  light:     Sun,
  camera:    Camera,
  math:      MathOperations,
  color:     Palette,
  texture:   Image,
  time:      Clock,
  input:     CursorClick,
  effect:    Code,
  shader:    Code,
  scene:     Stack,
}

export function getNodeIcon(
  type: string,
  category: NodeDefinition['category'],
  data: Record<string, unknown>,
): PhosphorIcon {
  if (type === 'light') {
    const mode = (data.mode as number) ?? 1
    if (mode === 0) return Sun
    if (mode === 1) return ArrowUpRight
    if (mode === 2) return Lightbulb
  }
  return CATEGORY_ICON_MAP[category] ?? Cube
}
