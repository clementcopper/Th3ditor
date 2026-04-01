import type { NodeDefinition } from '../types/node-graph'

const registry = new Map<string, NodeDefinition>()

export function registerNode(def: NodeDefinition) {
  registry.set(def.type, def)
}

export function getNodeDef(type: string): NodeDefinition | undefined {
  return registry.get(type)
}

export function getAllNodeDefs(): NodeDefinition[] {
  return Array.from(registry.values())
}

export function getNodeDefsByCategory(category: string): NodeDefinition[] {
  return getAllNodeDefs().filter((d) => d.category === category)
}
