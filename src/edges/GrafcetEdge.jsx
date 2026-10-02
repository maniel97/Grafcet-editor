import { useCallback } from 'react'
import { BaseEdge, EdgeLabelRenderer, useStore } from '@xyflow/react'
import { buildPath, computeRoute, sameRoute } from '../lib/grafcetRouting'

const DEFAULT_STROKE = '#0f172a'
const SELECTED_STROKE = '#3b82f6'
const REF_STUB = 28 // tramo de cada extremo de un enlace cortado con referencias
const ARROW = 6
const REF_ROUTE = { kind: 'ref', bendAtSource: false, laneX: 0 }

// Cómo se nombra un extremo en una referencia: «la etapa 5» o la receptividad de la transición.
const describe = (node) =>
  !node ? '?' : node.type === 'step' ? `la etapa ${node.data.label}` : `«${String(node.data.condition ?? '').trim() || 'transición'}»`

// Enlace Grafcet: elige solo su trazado (normal, bucle con flecha o salto lateral). Con
// data.reference se dibuja cortado (IEC 60848, referencia de enlace): una flecha bajo el origen
// con el destino y un tramo sobre el destino con el origen. La lógica no cambia: es el mismo enlace.
export default function GrafcetEdge({ id, source, target, sourceX, sourceY, targetX, targetY, style, selected, data }) {
  const reference = !!data?.reference
  const selector = useCallback(
    (state) => (reference ? REF_ROUTE : computeRoute(state, { id, source, target, sourceX, sourceY, targetY })),
    [reference, id, source, target, sourceX, sourceY, targetY],
  )
  const route = useStore(selector, sameRoute)
  const labels = useStore(
    useCallback(
      (state) => (reference ? `${describe(state.nodeLookup.get(target))}|${describe(state.nodeLookup.get(source))}` : ''),
      [reference, source, target],
    ),
  )
  const stroke = selected ? SELECTED_STROKE : (style?.stroke ?? DEFAULT_STROKE)

  if (route.kind === 'ref') {
    const [to, from] = labels.split('|')
    const end = sourceY + REF_STUB
    const path = `M ${sourceX} ${sourceY} V ${end} M ${targetX} ${targetY - REF_STUB} V ${targetY}`
    const arrow = `M ${sourceX - ARROW} ${end - ARROW} L ${sourceX} ${end + 2} L ${sourceX + ARROW} ${end - ARROW} Z`
    const labelClass = 'diagram-text pointer-events-none absolute left-0 top-0 whitespace-nowrap text-[0.85em] text-slate-700'
    return (
      <>
        <BaseEdge id={id} path={path} style={{ strokeWidth: 2, ...style, stroke }} interactionWidth={16} />
        <path d={arrow} fill={stroke} stroke="none" />
        <EdgeLabelRenderer>
          <div data-ref-label className={labelClass} style={{ transform: `translate(${sourceX + 10}px, ${end - 12}px)` }}>
            a {to}
          </div>
          <div data-ref-label className={labelClass} style={{ transform: `translate(${targetX + 10}px, ${targetY - REF_STUB - 6}px)` }}>
            de {from}
          </div>
        </EdgeLabelRenderer>
      </>
    )
  }

  const { path, arrow } = buildPath(route, sourceX, sourceY, targetX, targetY)
  return (
    <>
      <BaseEdge id={id} path={path} style={{ strokeWidth: 2, ...style, stroke }} interactionWidth={16} />
      {arrow && <path d={arrow} fill={stroke} stroke="none" />}
    </>
  )
}
