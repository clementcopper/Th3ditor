import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useEvaluatorStore } from '../../store/evaluator-store'

export function DataEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  source, sourceHandleId,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const cacheKey = `${source}:${sourceHandleId}`
  const value = useEvaluatorStore((s) => s.values.get(cacheKey))

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {value !== undefined && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: '10px',
              fontFamily: 'var(--font-mono, monospace)',
              background: 'var(--color-surface-panel)',
              color: 'var(--color-text-primary)',
              padding: '1px 5px',
              borderRadius: 0,
              border: '1px solid var(--color-border-default)',
            }}
          >
            {value.toFixed(2)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
