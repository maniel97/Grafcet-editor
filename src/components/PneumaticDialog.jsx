import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CircleX, Wind, X } from 'lucide-react'
import { buildPneumatic, parseSequence } from '../lib/pneumatic'

const EXAMPLES = ['A+ B+ B- A-', 'A+ B+ A- B-', 'A+ (B+ C+) B- (A- C-)', 'A+ B+ C+ C- B- A-']

// Generador de secuencias neumáticas (lib/pneumatic.js): se escribe la secuencia y se crea el
// grafcet, la tabla de variables y la planta con los cilindros. Vista previa en vivo.
export default function PneumaticDialog({ onCreate, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const [text, setText] = useState('A+ B+ B- A-')
  const [withScene, setWithScene] = useState(true)
  const parsed = useMemo(() => parseSequence(text), [text])
  const project = useMemo(() => (parsed.errors.length ? null : buildPneumatic(parsed.groups, { withScene })), [parsed, withScene])
  const steps = project?.nodes.filter((n) => n.type === 'step') ?? []
  const transitions = project?.nodes.filter((n) => n.type === 'transition') ?? []

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="pneumatic-title"
      className="m-auto w-[min(44rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="pneumatic-title" className="flex items-center gap-2 text-base font-semibold">
          <Wind size={18} /> Secuencia neumática
        </h2>
        <button type="button" onClick={() => dialogRef.current.close()} title="Cerrar" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div className="space-y-3 px-5 py-4 text-sm">
        <p className="text-slate-600">
          Escribe la secuencia de los cilindros (doble efecto, una letra cada uno). Los movimientos simultáneos, entre paréntesis.
          Se crea el grafcet (una etapa por paso y, en cada transición, el final de carrera del paso anterior), la tabla de
          variables y, si quieres, la planta con los cilindros.
        </p>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Secuencia</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && project && onCreate(project)}
            className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-base"
            aria-label="Secuencia"
            placeholder="A+ B+ B- A-"
            autoFocus
          />
        </label>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-slate-500">Ejemplos:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full border border-slate-300 px-2 py-0.5 font-mono hover:bg-slate-100">
              {ex.replace(/-/g, '−')}
            </button>
          ))}
        </div>

        {parsed.errors.map((err) => (
          <p key={err} className="flex items-start gap-1.5 text-red-700" role="alert">
            <CircleX size={15} className="mt-0.5 shrink-0" /> {err}
          </p>
        ))}
        {parsed.warnings.map((w) => (
          <p key={w} className="flex items-start gap-1.5 text-amber-700">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {w}
          </p>
        ))}

        {project && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3" aria-label="Vista previa">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Se va a crear</p>
            <ol className="space-y-0.5 font-mono text-xs">
              {steps.map((s, i) => (
                <li key={s.id}>
                  <span className="font-semibold">Etapa {s.data.label}</span>
                  {s.data.actions.length ? ` [${s.data.actions.join(', ')}]` : ' (reposo)'}
                  <span className="text-slate-500"> → «{transitions[i]?.data.condition}»</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={withScene} onChange={(e) => setWithScene(e.target.checked)} />
          Con planta virtual (cilindros con sus finales de carrera y pulsador de Marcha)
        </label>
        <p className="text-xs text-slate-500">Lo que hay ahora en el lienzo se guarda en «Trabajos anteriores».</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={() => dialogRef.current.close()} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!project}
          onClick={() => onCreate(project)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Crear grafcet
        </button>
      </div>
    </dialog>
  )
}
