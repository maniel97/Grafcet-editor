import { BaseEdge, Position } from '@xyflow/react'
import { routePath, wireRoute } from '../../lib/elec/route'

// Cable (o tubo) del esquema en el editor: el mismo recorrido que en el plano (lib/elec/route.js),
// con el codo que tenga el cable (data.bend / data.bendX).
export default function WireEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, label, labelStyle, labelBgStyle, labelBgPadding, data, interactionWidth }) {
  const side = (p) => (p === Position.Top ? 'top' : 'bottom')
  const { points, label: at } = wireRoute({ x: sourceX, y: sourceY, side: side(sourcePosition) }, { x: targetX, y: targetY, side: side(targetPosition) }, { bend: data?.bend, bendX: data?.bendX })
  return (
    <BaseEdge
      id={id}
      path={routePath(points)}
      style={style}
      label={label}
      labelX={at.x}
      labelY={at.y}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      interactionWidth={interactionWidth}
    />
  )
}
