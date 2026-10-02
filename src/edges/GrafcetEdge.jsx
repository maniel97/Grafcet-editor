import { useCallback } from 'react'
import { BaseEdge, useStore } from '@xyflow/react'
import { buildPath, computeRoute, sameRoute } from '../lib/grafcetRouting'

const DEFAULT_STROKE = '#0f172a'
const SELECTED_STROKE = '#3b82f6'

// Enlace Grafcet: elige solo su trazado (normal, bucle con flecha o salto lateral).
export default function GrafcetEdge({ id, source, target, sourceX, sourceY, targetX, targetY, style, selected }) {
  const selector = useCallback(
    (state) => computeRoute(state, { id, source, target, sourceX, sourceY, targetY }),
    [id, source, target, sourceX, sourceY, targetY],
  )
  const route = useStore(selector, sameRoute)
  const { path, arrow } = buildPath(route, sourceX, sourceY, targetX, targetY)
  const stroke = selected ? SELECTED_STROKE : (style?.stroke ?? DEFAULT_STROKE)

  return (
    <>
      <BaseEdge id={id} path={path} style={{ strokeWidth: 2, ...style, stroke }} interactionWidth={16} />
      {arrow && <path d={arrow} fill={stroke} stroke="none" />}
    </>
  )
}
