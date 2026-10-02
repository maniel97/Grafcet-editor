import { useCallback } from 'react'
import { Position, useStore } from '@xyflow/react'
import QuickConnectButton, { AddActionButton } from './QuickConnectButton'
import GrafcetHandle from './GrafcetHandle'
import ActionBox from './ActionBox'
import IssueBadge from './IssueBadge'
import { useEditor } from '../lib/editorContext'
import { useHighlightClass } from './useHighlighted'

// Etapa Grafcet: cuadrado con número y, pegadas a su derecha, las acciones asociadas como
// rectángulos contiguos. Variantes (IEC 60848):
// - inicial: doble cuadrado
// - macroetapa: cuadrado con dos trazos horizontales arriba y abajo
// La geometría va en px (no rem) para que el tamaño de la interfaz no deforme el diagrama;
// el texto usa el tamaño de letra del diagrama de las opciones.
export default function StepNode({ id, data, selected }) {
  const border = selected ? 'border-blue-500' : 'border-slate-900'
  const color = selected ? '#3b82f6' : '#0f172a'
  const actions = data.actions ?? []
  // Si ya tiene transición de salida, el "+" queda en gris: las alternativas en O se añaden
  // desde la propia transición (clic derecho > Añadir alternativa en O).
  const hasTransition = useStore(useCallback((s) => s.edges.some((e) => e.source === id), [id]))
  // Dirección de PLC de la etapa (solo con "Mostrar direcciones" activado en la tabla de variables).
  const { plcView } = useEditor()
  const address = plcView?.stepAddress(id)
  const highlight = useHighlightClass(id)

  return (
    <div className={`flex items-center ${highlight}`}>
      {/* Centrado bajo el cuadrado de la etapa (56px de ancho), no bajo el nodo entero con sus acciones. */}
      <QuickConnectButton
        nodeId={id}
        centerX={28}
        disabled={hasTransition}
        title={
          hasTransition
            ? 'Ya tiene transición. Para una alternativa en O: clic derecho en la transición'
            : 'Añadir transición'
        }
      />
      <AddActionButton nodeId={id} />
      <div
        className={`diagram-step-label relative flex h-[56px] w-[56px] shrink-0 items-center justify-center border-2 bg-white font-semibold ${border}`}
      >
        {data.initial && <div className={`pointer-events-none absolute inset-[4px] border-2 ${border}`} />}
        {data.macro && !data.initial && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-[6px] h-[2px]" style={{ background: color }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-[6px] h-[2px]" style={{ background: color }} />
          </>
        )}
        <span className="flex flex-col items-center leading-none">
          {data.label}
          {address && <span className="plc-address mt-[3px]">{address}</span>}
        </span>
        <IssueBadge nodeId={id} />
        {/* Los handles van dentro del cuadrado para quedar centrados en la etapa, no en todo el nodo. */}
        <GrafcetHandle type="target" position={Position.Top} />
        <GrafcetHandle type="source" position={Position.Bottom} />
      </div>

      {actions.length > 0 && (
        <>
          <div className="h-[2px] w-[20px]" style={{ background: color }} />
          <div className="flex">
            {actions.map((action, i) => (
              <ActionBox key={i} action={action} borderClass={border} color={color} first={i === 0} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
