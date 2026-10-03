import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'

const STATUS_STYLE = {
  ready: { label: 'Se franquea', className: 'bg-green-100 text-green-800' },
  waiting: { label: 'Esperando', className: 'bg-amber-100 text-amber-800' },
  'not-validated': { label: 'No validada', className: 'bg-slate-100 text-slate-700' },
  forced: { label: 'Forzada', className: 'bg-violet-100 text-violet-800' },
  error: { label: 'Con error', className: 'bg-red-100 text-red-800' },
}

function Term({ term, depth = 0 }) {
  const Icon = term.ok ? Check : X
  return (
    <>
      <li className="flex items-start gap-1" style={{ paddingLeft: depth * 12 }}>
        <Icon size={13} className={`mt-0.5 shrink-0 ${term.ok ? 'text-green-600' : 'text-red-600'}`} aria-label={term.ok ? 'se cumple' : 'no se cumple'} />
        <span>
          <span className="font-mono">{term.op === 'and' ? `${term.text}  (Y: todas)` : term.op === 'or' ? `${term.text}  (O: alguna)` : term.text}</span>
          {term.detail && <span className="text-slate-500">: {term.detail}</span>}
        </span>
      </li>
      {term.children?.map((c, i) => <Term key={i} term={c} depth={depth + 1} />)}
    </>
  )
}

// «¿Por qué no avanza?»: tarjeta flotante junto a una transición durante la simulación.
// Se dibuja fuera del lienzo (portal) para que se lea igual con cualquier zoom; se refresca sola
// (p. ej. el tiempo que queda de una temporización).
export default function WhyCard({ anchorRef, explain }) {
  const [explanation, setExplanation] = useState(() => explain())
  const [position, setPosition] = useState(null)
  const cardRef = useRef(null)
  useEffect(() => {
    const id = setInterval(() => setExplanation(explain()), 200)
    return () => clearInterval(id)
  }, [explain])
  useLayoutEffect(() => {
    const anchor = anchorRef.current?.getBoundingClientRect()
    const card = cardRef.current?.getBoundingClientRect()
    if (!anchor || !card) return
    const left = Math.min(anchor.left, window.innerWidth - card.width - 8)
    const below = anchor.bottom + 6
    const top = below + card.height > window.innerHeight - 8 ? Math.max(8, anchor.top - card.height - 6) : below
    setPosition((p) => (p && p.left === left && p.top === top ? p : { left, top }))
  }, [anchorRef, explanation])
  if (!explanation) return null
  const style = STATUS_STYLE[explanation.status]
  return createPortal(
    <div
      ref={cardRef}
      role="tooltip"
      aria-label="Por qué"
      className="side-panel pointer-events-none fixed z-50 w-max max-w-sm rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-800 shadow-lg"
      style={position ?? { left: -9999, top: 0 }}
    >
      <p className="mb-1 flex items-start gap-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${style.className}`}>{style.label}</span>
        <span>{explanation.summary}</span>
      </p>
      <ul className="space-y-0.5">
        {explanation.steps.map((s) => (
          <Term key={s.id} term={{ text: s.variable, ok: s.active, detail: s.active ? 'etapa anterior activa' : 'etapa anterior no activa' }} />
        ))}
        {explanation.receptivity && <Term term={explanation.receptivity} />}
      </ul>
    </div>,
    document.body,
  )
}
