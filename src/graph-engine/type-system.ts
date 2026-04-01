import type { PortType } from '../types/node-graph'

// Port type colors for visual handles
export const PORT_COLORS: Record<PortType, string> = {
  geometry: '#4ade80', // green
  material: '#f472b6', // pink
  mesh: '#60a5fa',     // blue
  light: '#facc15',    // yellow
  scene: '#fbbf24',    // amber
  float: '#a78bfa',    // violet
  vec3: '#2dd4bf',     // teal
  color: '#fb923c',    // orange
  texture: '#e879f9',  // fuchsia
}

// Can source → target connect?
export function canConnect(sourceType: PortType, targetType: PortType): boolean {
  return sourceType === targetType
}
