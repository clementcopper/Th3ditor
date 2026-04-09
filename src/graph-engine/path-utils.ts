import type { CompiledPath } from '../types/node-graph'

/** Maps (u, v) in a 2D plane to a 3D world coordinate + offset */
function planeToWorld(
  u: number,
  v: number,
  plane: number,
  offset: [number, number, number],
): [number, number, number] {
  const [ox, oy, oz] = offset
  if (plane === 0) return [ox + u, oy + v, oz]       // XY
  if (plane === 1) return [ox + u, oy,     oz + v]   // XZ
  return                 [ox,     oy + u, oz + v]    // YZ
}

/**
 * Returns the 3D position on a path at progress t.
 * - Circle: wraps continuously (t can be any value, e.g. 5.3 → loops)
 * - Line / Arc: clamped to [0, 1]
 */
export function evaluatePathPosition(
  path: CompiledPath,
  t: number,
): [number, number, number] {
  const p = path.pathProps
  const offset = path.position

  if (path.pathType === 'line') {
    const tc = Math.max(0, Math.min(1, t))
    const len = (p.length as number) ?? 4
    const axis = (p.lineAxis as number) ?? 0
    const local: [number, number, number] = [0, 0, 0]
    local[axis] = (tc - 0.5) * len  // centered: -half .. +half
    return [offset[0] + local[0], offset[1] + local[1], offset[2] + local[2]]
  }

  if (path.pathType === 'circle') {
    // Wrap: t can be any value — camera orbits continuously
    const tw = ((t % 1) + 1) % 1
    const r = (p.radius as number) ?? 2
    const plane = (p.circleAxis as number) ?? 1
    const angle = tw * Math.PI * 2
    return planeToWorld(r * Math.cos(angle), r * Math.sin(angle), plane, offset)
  }

  if (path.pathType === 'arc') {
    const tc = Math.max(0, Math.min(1, t))
    const r = (p.radius as number) ?? 2
    const sweep = ((p.sweepAngle as number) ?? 180) * (Math.PI / 180)
    const plane = (p.circleAxis as number) ?? 1
    const angle = tc * sweep
    return planeToWorld(r * Math.cos(angle), r * Math.sin(angle), plane, offset)
  }

  return offset
}

/**
 * Returns the normalized forward tangent direction on a path at progress t.
 * Used for Look-Ahead camera orientation.
 */
export function evaluatePathTangent(
  path: CompiledPath,
  t: number,
): [number, number, number] {
  const eps = 0.001
  const a = evaluatePathPosition(path, t - eps)
  const b = evaluatePathPosition(path, t + eps)
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
  return [dx / len, dy / len, dz / len]
}
