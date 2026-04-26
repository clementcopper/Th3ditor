import type { GraphNode, GraphEdge } from '../types/node-graph'
import { getNodeDef } from './node-registry'
import { rgbToHsl, hslToRgb } from '../utils/color'

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
 * Evaluates a color output port by walking the graph backwards.
 * Handles: color, color/mix, color/hsl
 */
export function evaluateColorPort(
  nodeId: string,
  portName: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  ctx: EvalContext,
  floatCache: Map<string, number>,
): [number, number, number, number] | undefined {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  return evalColorPort(nodeId, portName, nodeMap, edges, ctx, floatCache)
}

function evalColorPort(
  nodeId: string,
  portName: string,
  nodeMap: Map<string, GraphNode>,
  edges: GraphEdge[],
  ctx: EvalContext,
  floatCache: Map<string, number>,
): [number, number, number, number] | undefined {
  const node = nodeMap.get(nodeId)
  if (!node) return undefined

  const def = getNodeDef(node.type)
  const props = { ...(def?.defaults ?? {}), ...node.data }

  // Helper: resolve upstream color input or fall back to a property
  function getColorInput(handle: string, fallback: string): [number, number, number, number] {
    const edge = edges.find((e) => e.target === nodeId && e.targetHandle === handle)
    if (edge) {
      const v = evalColorPort(edge.source, edge.sourceHandle, nodeMap, edges, ctx, floatCache)
      if (v !== undefined) return v
    }
    return (props[fallback] as [number, number, number, number]) ?? [1, 1, 1, 1]
  }

  // Helper: resolve upstream float input or fall back to a property
  function getFloatInput(handle: string, fallback: string): number {
    const edge = edges.find((e) => e.target === nodeId && e.targetHandle === handle)
    if (edge) {
      const v = evalPort(edge.source, edge.sourceHandle, nodeMap, edges, ctx, floatCache)
      if (v !== undefined) return v
    }
    return (props[fallback] as number) ?? 0
  }

  switch (node.type) {
    case 'color': {
      if (portName !== 'color') return undefined
      const base = props.color as [number, number, number, number] ?? [1, 1, 1, 1]
      const rEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'r')
      const gEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'g')
      const bEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'b')
      const rRaw = rEdge ? (evalPort(rEdge.source, rEdge.sourceHandle, nodeMap, edges, ctx, floatCache) ?? base[0]) : base[0]
      const gRaw = gEdge ? (evalPort(gEdge.source, gEdge.sourceHandle, nodeMap, edges, ctx, floatCache) ?? base[1]) : base[1]
      const bRaw = bEdge ? (evalPort(bEdge.source, bEdge.sourceHandle, nodeMap, edges, ctx, floatCache) ?? base[2]) : base[2]
      const r = rEdge && nodeMap.get(rEdge.source)?.data?.colorMode ? rRaw / 255 : rRaw
      const g = gEdge && nodeMap.get(gEdge.source)?.data?.colorMode ? gRaw / 255 : gRaw
      const b = bEdge && nodeMap.get(bEdge.source)?.data?.colorMode ? bRaw / 255 : bRaw
      return [r, g, b, base[3]]
    }

    case 'color/mix': {
      if (portName !== 'color') return undefined
      const a = getColorInput('colorA', 'colorA')
      const b = getColorInput('colorB', 'colorB')
      const t = Math.min(1, Math.max(0, getFloatInput('t', 't')))
      return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
        a[3] + (b[3] - a[3]) * t,
      ]
    }

    case 'color/hsl': {
      if (portName !== 'color') return undefined
      const base = getColorInput('color', 'color')
      const hueShift = getFloatInput('hue', 'hue')
      const satShift = getFloatInput('saturation', 'saturation')
      const lightShift = getFloatInput('lightness', 'lightness')
      const [h, s, l] = rgbToHsl(base[0], base[1], base[2])
      const newH = ((h + hueShift) % 360 + 360) % 360
      const newS = Math.min(100, Math.max(0, s + satShift))
      const newL = Math.min(100, Math.max(0, l + lightShift))
      const [r, g, b] = hslToRgb(newH, newS, newL)
      return [r, g, b, base[3]]
    }

    default:
      return undefined
  }
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
      const mode = Number(props.mode ?? 0)
      const speed = (props.speed as number) ?? 1
      const t = ctx.elapsed * speed
      const ft = t - Math.floor(t) // fract(t)
      if (mode === 0) {
        result = t
      } else {
        switch (mode) {
          case 1: { // Sine
            const amp = (props.amplitude as number) ?? 1
            const offset = (props.offset as number) ?? 0
            result = Math.sin(t * Math.PI * 2) * amp + offset
            break
          }
          case 2: result = ft; break                              // Sawtooth
          case 3: result = ft < 0.5 ? 0 : 1; break               // Square
          case 4: result = Math.abs(Math.sin(t * Math.PI)); break  // Bounce
          case 5: result = ft * ft; break                          // Ease-In
          case 6: result = 1 - (1 - ft) * (1 - ft); break         // Ease-Out
          case 7: result = ft < 0.5 ? 2 * ft * ft : 1 - 2 * (1 - ft) * (1 - ft); break // Ease-In-Out
        }
      }
      break
    }

    // --- Math ---
    case 'math': {
      const mode = Number(props.mode ?? 0)
      switch (mode) {
        case 0: {
          // Number
          const numType = Number(props.numType ?? 0)
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
      const mode = Number(props.mode ?? 0)
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

  if (node.type === 'math' || node.type === 'color' || node.type === 'color/mix' || node.type === 'color/hsl') {
    const incomingEdges = edges.filter((e) => e.target === nodeId)
    return incomingEdges.some((e) => isDynamicNode(e.source, nodeMap, edges, visited))
  }

  return false
}
