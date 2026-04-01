import type { GraphNode, GraphEdge } from '../types/node-graph'
import { getNodeDef } from './node-registry'

/**
 * Runtime context passed each frame.
 */
export interface EvalContext {
  elapsed: number   // seconds since start
  delta: number     // seconds since last frame
  mouseX: number    // pixel X
  mouseY: number    // pixel Y
  screenW: number
  screenH: number
}

/**
 * Evaluates a float output port of a node by walking the graph backwards.
 * Returns the computed float value, or undefined if evaluation fails.
 *
 * Uses topological memoization via `cache` to avoid re-evaluating the same port.
 */
export function evaluateFloatPort(
  nodeId: string,
  portName: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  ctx: EvalContext,
  cache: Map<string, number>,
): number | undefined {
  const cacheKey = `${nodeId}:${portName}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const result = evalPort(nodeId, portName, nodeMap, edges, ctx, cache)
  if (result !== undefined) cache.set(cacheKey, result)
  return result
}

function evalPort(
  nodeId: string,
  portName: string,
  nodeMap: Map<string, GraphNode>,
  edges: GraphEdge[],
  ctx: EvalContext,
  cache: Map<string, number>,
): number | undefined {
  const cacheKey = `${nodeId}:${portName}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const node = nodeMap.get(nodeId)
  if (!node) return undefined

  const def = getNodeDef(node.type)
  if (!def) return undefined

  const props = { ...def.defaults, ...node.data }

  // Helper: get input value — either from connected edge or from property default
  function getInput(inputName: string): number {
    // Check if there's an incoming edge
    const edge = edges.find((e) => e.target === nodeId && e.targetHandle === inputName)
    if (edge) {
      const v = evalPort(edge.source, edge.sourceHandle, nodeMap, edges, ctx, cache)
      if (v !== undefined) return v
    }
    // Fall back to property value
    return (props[inputName] as number) ?? 0
  }

  let result: number | undefined

  switch (node.type) {
    // --- Time ---
    case 'time/time': {
      const speed = (props.speed as number) ?? 1
      if (portName === 'elapsed') result = ctx.elapsed * speed
      else if (portName === 'delta') result = ctx.delta * speed
      break
    }
    case 'time/sin': {
      const speed = (props.speed as number) ?? 1
      const amp = (props.amplitude as number) ?? 1
      const offset = (props.offset as number) ?? 0
      result = Math.sin(ctx.elapsed * speed) * amp + offset
      break
    }

    // --- Math ---
    case 'math/add':
      result = getInput('a') + getInput('b')
      break
    case 'math/multiply':
      result = getInput('a') * getInput('b')
      break
    case 'math/sin':
      result = Math.sin(getInput('value'))
      break
    case 'math/cos':
      result = Math.cos(getInput('value'))
      break
    case 'math/lerp': {
      const a = getInput('a')
      const b = getInput('b')
      const t = getInput('t')
      result = a + (b - a) * t
      break
    }
    case 'math/clamp': {
      const v = getInput('value')
      const mn = (props.min as number) ?? 0
      const mx = (props.max as number) ?? 1
      result = Math.min(mx, Math.max(mn, v))
      break
    }
    case 'math/remap': {
      const v = getInput('value')
      const inMin = (props.inMin as number) ?? -1
      const inMax = (props.inMax as number) ?? 1
      const outMin = (props.outMin as number) ?? 0
      const outMax = (props.outMax as number) ?? 1
      const t = (v - inMin) / (inMax - inMin)
      result = outMin + (outMax - outMin) * t
      break
    }

    // --- Input ---
    case 'input/mouse':
      if (portName === 'x') result = ctx.mouseX
      else if (portName === 'y') result = ctx.mouseY
      else if (portName === 'normalizedX') result = ctx.screenW > 0 ? ctx.mouseX / ctx.screenW : 0
      else if (portName === 'normalizedY') result = ctx.screenH > 0 ? ctx.mouseY / ctx.screenH : 0
      break
    case 'input/screen':
      if (portName === 'width') result = ctx.screenW
      else if (portName === 'height') result = ctx.screenH
      break

    default:
      return undefined
  }

  if (result !== undefined) cache.set(cacheKey, result)
  return result
}

/**
 * Checks if a node is "dynamic" — i.e., its output changes per frame.
 * A node is dynamic if it's a time/input node or if any of its inputs connect to dynamic nodes.
 */
export function isDynamicNode(
  nodeId: string,
  nodeMap: Map<string, GraphNode>,
  edges: GraphEdge[],
  visited: Set<string> = new Set(),
): boolean {
  if (visited.has(nodeId)) return false
  visited.add(nodeId)

  const node = nodeMap.get(nodeId)
  if (!node) return false

  // Time and input nodes are always dynamic
  if (node.type.startsWith('time/') || node.type.startsWith('input/')) return true

  // Math nodes are dynamic if any input is dynamic
  if (node.type.startsWith('math/')) {
    const incomingEdges = edges.filter((e) => e.target === nodeId)
    return incomingEdges.some((e) => isDynamicNode(e.source, nodeMap, edges, visited))
  }

  return false
}
