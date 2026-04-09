import type { PortType, NodeDefinition } from '../types/node-graph'

// Port type colors for visual handles
export const PORT_COLORS: Record<PortType, string> = {
  geometry: '#4ADE54', // green
  material: '#F47274', // pink
  mesh: '#60A5FA',     // blue
  light: '#FACC15',    // yellow
  camera: '#38BDF8',   // sky blue
  scene: '#000000',    // amber
  float: '#A78BFA',    // violet
  vec3: '#D42DA2',     // teal
  color: '#FB923C',    // orange
  texture: '#22D3EE',  // fuchsia
}

// Category header colors
export const CATEGORY_COLORS: Record<NodeDefinition['category'], string> = {
  geometry: '#00ff11',
  material: '#ee00ff',
  object: '#0073ff',
  transform: '#ff7300',
  light: '#ffcc00',
  camera: '#0ea5e9',
  shader: '#000000',
  math: '#6600ff',
  color: '#FB923C',
  texture: '#22D3EE',
  time: '#0004ff',
  input: '#7a7875',
  effect: '#000000',
  scene: '#ff0000',
}

// Can source → target connect?
export function canConnect(sourceType: PortType, targetType: PortType): boolean {
  return sourceType === targetType
}

// Check if a port/property is visible given a visibleWhen condition and current data
export function isVisible(
  visibleWhen: import('../types/properties').VisibleWhenCondition | import('../types/properties').VisibleWhenCondition[] | undefined,
  getData: (uniform: string) => unknown,
): boolean {
  if (!visibleWhen) return true
  const conditions = Array.isArray(visibleWhen) ? visibleWhen : [visibleWhen]
  return conditions.every((cond) => {
    const depVal = getData(cond.uniform)
    if (cond.equal !== undefined) {
      const eq = cond.equal
      const matches = Array.isArray(eq) ? eq.includes(depVal as number) : depVal === eq
      if (!matches) return false
    }
    if (cond.notEqual !== undefined) {
      if (depVal === cond.notEqual) return false
    }
    return true
  })
}
