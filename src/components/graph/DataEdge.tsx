import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export function DataEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  return <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
}
