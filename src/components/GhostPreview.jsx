import { useReactFlow, ViewportPortal } from '@xyflow/react'
import ConditionText from './ConditionText'
import { planQuickConnect } from '../lib/useQuickConnect'
import { t } from '../lib/i18n'

const GHOST = 'border-2 border-dashed border-blue-500 bg-blue-50/80 text-blue-700'
const STUB = 20

// Fantasma de lo que añadiría un "+" flotante al pasar el ratón por encima:
// { kind: 'next', nodeId } -> la etapa/transición que se crearía debajo, con su enlace
// { kind: 'action', nodeId } -> la acción que se añadiría al final de la etapa
// Lleva la clase ghost-preview: no recibe eventos y se excluye de las exportaciones.
export default function GhostPreview({ preview }) {
  const { getNode, getNodes, getInternalNode } = useReactFlow()
  const source = preview && getInternalNode(preview.nodeId)
  if (!source) return null

  const { x, y } = source.internals.positionAbsolute
  const width = source.measured?.width ?? 56
  const height = source.measured?.height ?? 56

  if (preview.kind === 'action') {
    const hasActions = (source.data.actions ?? []).length > 0
    return (
      <ViewportPortal>
        <div
          className="ghost-preview absolute flex items-center"
          // Contigua a la última acción (solapando el borde) o, si no hay ninguna, tras la línea de unión.
          style={{ transform: `translate(${x + width - (hasActions ? 2 : 0)}px, ${y}px)` }}
        >
          {!hasActions && <div className="h-[2px] w-[20px] bg-blue-500" />}
          <div className={`diagram-text flex h-[56px] min-w-[96px] items-center justify-center px-[12px] ${GHOST}`}>
            {t('Acción')}
          </div>
        </div>
      </ViewportPortal>
    )
  }

  const { type, data, position } = planQuickConnect(getNode(preview.nodeId), getNodes())
  const sx = x + 28
  const sy = y + height
  const tx = position.x + 28
  const ty = position.y
  const bendY = source.type === 'step' ? sy + STUB : ty - STUB
  const path = Math.abs(sx - tx) < 1 ? `M ${sx} ${sy} V ${ty}` : `M ${sx} ${sy} V ${bendY} H ${tx} V ${ty}`

  return (
    <ViewportPortal>
      <svg className="ghost-preview absolute left-0 top-0 overflow-visible" width="1" height="1">
        <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 4" />
      </svg>
      <div className="ghost-preview absolute" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        {type === 'step' ? (
          <div className={`diagram-step-label flex h-[56px] w-[56px] items-center justify-center font-semibold ${GHOST}`}>
            {t(data.label)}
          </div>
        ) : (
          <div className="relative flex h-[24px] w-[56px] items-center">
            <div className="h-[3px] w-full bg-blue-500" />
            <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-blue-500" />
            <span className="diagram-text absolute left-full ml-[8px] whitespace-nowrap text-blue-700">
              <ConditionText text={data.condition} />
            </span>
          </div>
        )}
      </div>
    </ViewportPortal>
  )
}
