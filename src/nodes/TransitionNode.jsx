import { useCallback } from 'react'
import { Position, useStore } from '@xyflow/react'
import GrafcetHandle from './GrafcetHandle'
import IssueBadge from './IssueBadge'
import QuickConnectButton, { LoopButton } from './QuickConnectButton'
import ConditionText from '../components/ConditionText'
import { transitionOutput } from '../lib/grafcetRules'
import { addressExpression } from '../lib/symbols'
import { useEditor } from '../lib/editorContext'
import { useHighlightClass } from './useHighlighted'

const ALTERNATIVE_HINT = 'Para «volver O seguir»: clic derecho en la transición > Añadir alternativa en O'

// Transición Grafcet: barra horizontal con su receptividad a la derecha.
export default function TransitionNode({ id, data, selected }) {
  const { plcView, sim } = useEditor()
  const highlight = useHighlightClass(id)
  // Simulación: validada (etapas anteriores activas) -> ámbar; además receptividad verdadera -> verde.
  const simState = sim?.ready.has(id) ? 'ready' : sim?.enabled.has(id) ? 'enabled' : null
  const barColor =
    simState === 'ready' ? 'bg-green-600' : simState === 'enabled' ? 'bg-amber-500' : selected ? 'bg-blue-500' : 'bg-slate-900'
  // Salida actual (null | 'loop' | 'step'): decide qué botones flotantes están disponibles.
  const output = useStore(
    useCallback(
      (s) => transitionOutput(id, s.edges, (nodeId) => s.nodeLookup.get(nodeId)?.internals.positionAbsolute.y ?? Infinity),
      [id],
    ),
  )

  return (
    <div className={`relative flex h-[24px] w-[56px] items-center justify-center ${highlight}`}>
      {/* Con bucle, una etapa debajo se activaría a la vez que la del bucle (divergencia en Y implícita). */}
      <QuickConnectButton
        nodeId={id}
        disabled={output === 'loop'}
        title={
          output === 'loop'
            ? `Esta transición ya vuelve atrás con un bucle. ${ALTERNATIVE_HINT}`
            : output === 'step'
              ? 'Añadir etapa en paralelo (rama en Y)'
              : 'Añadir etapa'
        }
      />
      <LoopButton
        nodeId={id}
        disabled={output !== null}
        title={
          output === 'loop'
            ? 'Esta transición ya tiene un bucle'
            : output === 'step'
              ? `Esta transición ya continúa hacia abajo. ${ALTERNATIVE_HINT}`
              : 'Bucle: volver a una etapa anterior'
        }
      />
      <div className={`w-full transition-all ${barColor} ${simState ? 'h-[4px]' : 'h-[2px]'}`} />
      <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-slate-900" />
      {data.condition && (
        <span
          className={`diagram-text absolute left-full ml-[8px] flex flex-col whitespace-nowrap leading-tight ${
            simState === 'ready' ? 'font-semibold text-green-700' : simState === 'enabled' ? 'text-amber-700' : ''
          }`}
        >
          <ConditionText text={data.condition} />
          {/* Con "Mostrar direcciones": la receptividad con cada símbolo sustituido por su dirección. */}
          {plcView && <ConditionText className="plc-address" text={addressExpression(data.condition, plcView.lookup)} />}
        </span>
      )}
      <IssueBadge nodeId={id} />
      <GrafcetHandle type="target" position={Position.Top} />
      <GrafcetHandle type="source" position={Position.Bottom} />
    </div>
  )
}
