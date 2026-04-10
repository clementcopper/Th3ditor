import type { CompiledPath } from '../types/node-graph'

const DEG2RAD = Math.PI / 180

/** Applies an XYZ euler rotation (radians) to a point */
function applyEulerXYZ(
  px: number, py: number, pz: number,
  rx: number, ry: number, rz: number,
): [number, number, number] {
  const cx = Math.cos(rx), sx = Math.sin(rx)
  const cy = Math.cos(ry), sy = Math.sin(ry)
  const cz = Math.cos(rz), sz = Math.sin(rz)
  // Rx
  const x1 = px
  const y1 = py * cx - pz * sx
  const z1 = py * sx + pz * cx
  // Ry
  const x2 = x1 * cy + z1 * sy
  const y2 = y1
  const z2 = -x1 * sy + z1 * cy
  // Rz
  const x3 = x2 * cz - y2 * sz
  const y3 = x2 * sz + y2 * cz
  return [x3, y3, z2]
}

/**
 * Returns the 3D position on a path at progress t.
 * Circle/Arc are always computed in XZ plane, then rotated by the path's euler rotation.
 * - Circle: wraps continuously (t can be any value, e.g. 5.3 → loops)
 * - Line / Arc: clamped to [0, 1]
 */
export function evaluatePathPosition(
  path: CompiledPath,
  t: number,
): [number, number, number] {
  const p = path.pathProps
  const offset = path.position
  let local: [number, number, number]

  if (path.pathType === 'line') {
    const tc = Math.max(0, Math.min(1, t))
    const len = (p.length as number) ?? 4
    const axis = (p.lineAxis as number) ?? 0
    local = [0, 0, 0]
    local[axis] = (tc - 0.5) * len  // centered: -half .. +half
  } else if (path.pathType === 'circle') {
    // Wrap: t can be any value — camera orbits continuously
    const tw = ((t % 1) + 1) % 1
    const r = (p.radius as number) ?? 2
    // Offset by π/2 so t=0 starts at +Z axis (forward direction)
    const angle = tw * Math.PI * 2 + Math.PI / 2
    // Always in XZ plane — rotation props handle arbitrary orientation
    local = [r * Math.cos(angle), 0, r * Math.sin(angle)]
  } else if (path.pathType === 'arc') {
    const tc = Math.max(0, Math.min(1, t))
    const r = (p.radius as number) ?? 2
    const sweep = ((p.sweepAngle as number) ?? 180) * DEG2RAD
    const angle = tc * sweep
    local = [r * Math.cos(angle), 0, r * Math.sin(angle)]
  } else {
    return offset
  }

  // Apply path rotation (euler XYZ, degrees → radians)
  const rx = ((p.rotationX as number) ?? 0) * DEG2RAD
  const ry = ((p.rotationY as number) ?? 0) * DEG2RAD
  const rz = ((p.rotationZ as number) ?? 0) * DEG2RAD
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    local = applyEulerXYZ(local[0], local[1], local[2], rx, ry, rz)
  }

  return [offset[0] + local[0], offset[1] + local[1], offset[2] + local[2]]
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
