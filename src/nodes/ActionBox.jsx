import ConditionText from '../components/ConditionText'
import { normalizeAction } from '../lib/actions'
import { actionSymbol } from '../lib/symbols'
import { useEditor } from '../lib/editorContext'

// Flecha de acción memorizada (IEC 60848): hacia arriba = en la activación, hacia abajo = en la
// desactivación. Se dibuja sobre la esquina superior izquierda de la caja.
function StoredArrow({ up, color }) {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" className="absolute bottom-full left-[6px]" aria-hidden>
      <line x1="6" y1="2" x2="6" y2="18" stroke={color} strokeWidth="2" />
      {up ? <path d="M1 7 L6 1 L11 7" fill="none" stroke={color} strokeWidth="2" /> : <path d="M1 12 L6 18 L11 12" fill="none" stroke={color} strokeWidth="2" />}
    </svg>
  )
}

// Caja de acción asociada a una etapa, con su notación según el tipo:
// - continua: solo la caja
// - condicionada / al evento: trazo vertical encima con la condición
// - memorizada en la activación / desactivación: flecha ↑ / ↓ encima
export default function ActionBox({ action, borderClass, color, first, stepActive }) {
  const { text, kind, condition } = normalizeAction(action)
  const hasCondition = (kind === 'conditional' || kind === 'event') && condition
  // Dirección de la variable que gobierna la acción (con "Mostrar direcciones" activado).
  const { plcView, sim } = useEditor()
  const symbol = actionSymbol(action)?.symbol
  const address = plcView && symbol && plcView.lookup.symbol(symbol)
  // Simulación: acción continua o condicionada que se está emitiendo ahora mismo.
  const emitting =
    !!sim && stepActive && (kind === 'continuous' || kind === 'conditional') && !!symbol && Number(sim.values[symbol]) !== 0

  return (
    <div
      className={`diagram-text relative flex h-[56px] min-w-[96px] items-center justify-center border-2 px-[12px] whitespace-nowrap transition-colors ${borderClass} ${
        first ? '' : '-ml-[2px]'
      } ${emitting ? 'bg-green-200 font-semibold' : 'bg-white'}`}
    >
      {kind === 'stored-on' && <StoredArrow up color={color} />}
      {kind === 'stored-off' && <StoredArrow up={false} color={color} />}
      {kind === 'event' && <StoredArrow up color={color} />}
      {hasCondition && (
        <div className="absolute bottom-full left-1/2 flex h-[16px] items-start">
          <div className="h-full w-[2px]" style={{ background: color }} />
          <span className="-mt-[0.6em] ml-[4px] leading-none">
            <ConditionText text={condition} />
          </span>
        </div>
      )}
      <span className="flex flex-col items-center leading-tight">
        {text || ' '}
        {address && <span className="plc-address">{address}</span>}
      </span>
    </div>
  )
}
