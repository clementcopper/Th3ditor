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
  function getInput(inputName: string, fallbackProp?: string): number {
    const edge = edges.find((e) => e.target === nodeId && e.targetHandle === inputName)
    if (edge) {
      const v = evalPort(edge.source, edge.sourceHandle, nodeMap, edges, ctx, cache)
      if (v !== undefined) return v
    }
    return (props[fallbackProp ?? inputName] as number) ?? 0
  }

  let result: number | undefined

  switch (node.type) {
    // --- Time ---
    case 'time': {
      const mode = (props.mode as number) ?? 0
      const speed = (props.speed as number) ?? 1
      if (mode === 0) {
        // Time
        if (portName === 'elapsed') result = ctx.elapsed * speed
        else if (portName === 'delta') result = ctx.delta * speed
      } else if (mode === 1) {
        // Sin(Time)
        const amp = (props.amplitude as number) ?? 1
        const offset = (props.offset as number) ?? 0
        result = Math.sin(ctx.elapsed * speed) * amp + offset
      }
      break
    }

    // --- Math ---
    case 'math': {
      const mode = (props.mode as number) ?? 0
      switch (mode) {
        case 0: {
          // Number
          const numType = (props.numType as number) ?? 0
          if (numType === 1) {
            result = Math.round((props.numInt as number) ?? 1)
          } else {
            result = (props.numFloat as number) ?? 0
          }
          break
        }
        case 1: // Add
          result = getInput('a', 'a') + getInput('b', 'addB')
          break
        case 2: // Multiply
          result = getInput('a', 'mulA') * getInput('b', 'mulB')
          break
        case 8: // Subtract
          result = getInput('a', 'subA') - getInput('b', 'subB')
          break
        case 3: // Sin
          result = Math.sin(getInput('value', 'sinValue'))
          break
        case 4: // Cos
          result = Math.cos(getInput('value', 'cosValue'))
          break
        case 5: { // Lerp
          const a = getInput('a', 'lerpA')
          const b = getInput('b', 'lerpB')
          const t = getInput('t', 'lerpT')
          result = a + (b - a) * t
          break
        }
        case 6: { // Clamp
          const v = getInput('value', 'clampValue')
          const mn = (props.clampMin as number) ?? 0
          const mx = (props.clampMax as number) ?? 1
          result = Math.min(mx, Math.max(mn, v))
          break
        }
        case 7: { // Remap
          const v = getInput('value', 'remapValue')
          const inMin = (props.inMin as number) ?? -1
          const inMax = (props.inMax as number) ?? 1
          const outMin = (props.outMin as number) ?? 0
          const outMax = (props.outMax as number) ?? 1
          const t = (v - inMin) / (inMax - inMin)
          result = outMin + (outMax - outMin) * t
          break
        }
      }
      break
    }

    // --- Input ---
    case 'input': {
      const mode = (props.mode as number) ?? 0
      if (mode === 0) {
        // Mouse
        if (portName === 'x') result = ctx.mouseX
        else if (portName === 'y') result = ctx.mouseY
        else if (portName === 'normalizedX') result = ctx.screenW > 0 ? ctx.mouseX / ctx.screenW : 0
        else if (portName === 'normalizedY') result = ctx.screenH > 0 ? ctx.mouseY / ctx.screenH : 0
      } else if (mode === 1) {
        // Screen
        if (portName === 'width') result = ctx.screenW
        else if (portName === 'height') result = ctx.screenH
      }
      break
    }

    default:
      return undefined
  }

  if (result !== undefined) cache.set(cacheKey, result)
  return result
}

/**
 * Checks if a node is "dynamic" — i.e., its output changes per frame.
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

  if (node.type === 'time' || node.type === 'input') return true

  if (node.type === 'math') {
    const incomingEdges = edges.filter((e) => e.target === nodeId)
    return incomingEdges.some((e) => isDynamicNode(e.source, nodeMap, edges, visited))
  }

  return false
}
