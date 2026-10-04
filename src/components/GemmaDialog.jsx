import { useEffect, useRef } from 'react'
import { Plus, Trash2, Wand2, X } from 'lucide-react'
import { FAMILIES, FORCINGS, GEMMA_STATES, TYPICAL_GEMMA, checkGemma } from '../lib/gemma'
import { t } from '../lib/i18n'

const input = 'rounded-md border border-slate-300 px-1.5 py-1 text-sm'

// Asistente GEMMA (lib/gemma.js): estados usados con su orden de forzado, transiciones entre estados
// y generación del grafcet de conducción en la hoja «GEMMA». La configuración se guarda en el
// proyecto (plc.gemma).
export default function GemmaDialog({ gemma, onChange, grafcets, onGenerate, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const used = Object.keys(gemma.states)
  const problems = checkGemma(gemma)
  const missingTarget = Object.values(gemma.states).some(Boolean) && !grafcets.includes(String(gemma.production).toUpperCase())
  const set = (patch) => onChange({ ...gemma, ...patch })
  const toggle = (id, on) => {
    const states = { ...gemma.states }
    if (on) states[id] = states[id] ?? ''
    else delete states[id]
    set({ states, transitions: on ? gemma.transitions : gemma.transitions.filter((v) => v.from !== id && v.to !== id) })
  }
  const setTransition = (i, patch) => set({ transitions: gemma.transitions.map((v, j) => (j === i ? { ...v, ...patch } : v)) })

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="gemma-title"
      className="m-auto w-[min(60rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="gemma-title" className="text-base font-semibold">
          {t('Asistente GEMMA')}
        </h2>
        <button
          type="button"
          onClick={() => set({ ...TYPICAL_GEMMA, production: gemma.production || TYPICAL_GEMMA.production })}
          className="ml-auto mr-2 rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
        >
          {t('Cargar el ejemplo típico')}
        </button>
        <button type="button" onClick={onClose} title={t('Cerrar (Esc)')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>

      <div className="grid max-h-[70vh] gap-5 overflow-y-auto px-5 py-4 md:grid-cols-2">
        <div className="space-y-3">
          {Object.entries(FAMILIES).map(([family, title]) => (
            <fieldset key={family} className="space-y-1">
              <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</legend>
              {GEMMA_STATES.filter((s) => s.family === family).map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input type="checkbox" checked={s.id in gemma.states} onChange={(e) => toggle(s.id, e.target.checked)} />
                    <span className="w-7 font-mono font-semibold">{s.id}</span>
                    <span className="truncate" title={s.name}>
                      {s.name}
                    </span>
                  </label>
                  {s.id in gemma.states && (
                    <select
                      aria-label={t('Orden de forzado en {estado}', { estado: s.id })}
                      className={`${input} w-40 text-xs`}
                      value={gemma.states[s.id]}
                      onChange={(e) => set({ states: { ...gemma.states, [s.id]: e.target.value } })}
                    >
                      {FORCINGS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label.replace('F/G', `F/${gemma.production || 'G'}`)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </fieldset>
          ))}
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            {t('Grafcet de producción')}
            <input
              aria-label={t('Grafcet de producción')}
              list="gemma-grafcets"
              className={`${input} w-24 font-mono`}
              value={gemma.production}
              onChange={(e) => set({ production: e.target.value.toUpperCase() })}
            />
            <datalist id="gemma-grafcets">
              {grafcets.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          {missingTarget && (
            <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
              No hay ningún grafcet parcial «{gemma.production}»: encierra tu grafcet de producción en un marco con ese nombre
              (clic derecho sobre la selección) para que los forzados funcionen.
            </p>
          )}

          <fieldset className="space-y-1">
            <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('Transiciones entre estados')}</legend>
            {gemma.transitions.map((x, i) => (
              <div key={i} className="flex items-center gap-1 text-sm">
                {['from', 'to'].map((side) => (
                  <select
                    key={side}
                    aria-label={side === 'from' ? t('Desde (transición {n})', { n: i + 1 }) : t('Hacia (transición {n})', { n: i + 1 })}
                    className={`${input} font-mono`}
                    value={x[side]}
                    onChange={(e) => setTransition(i, { [side]: e.target.value })}
                  >
                    {used.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                ))}
                <input
                  aria-label={t('Condición (transición {n})', { n: i + 1 })}
                  className={`${input} min-w-0 flex-1 font-mono`}
                  value={x.condition}
                  placeholder={t('Condición')}
                  onChange={(e) => setTransition(i, { condition: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={t('Quitar la transición {n}', { n: i + 1 })}
                  onClick={() => set({ transitions: gemma.transitions.filter((_, j) => j !== i) })}
                  className="rounded p-1 text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {used.length >= 2 && (
              <button
                type="button"
                onClick={() => set({ transitions: [...gemma.transitions, { from: used[0], to: used[1], condition: '' }] })}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-blue-700 hover:bg-blue-50"
              >
                <Plus size={14} />{' '}{t('Añadir transición')}
              </button>
            )}
          </fieldset>

          {problems.length > 0 && (
            <ul className="space-y-0.5 rounded bg-slate-50 p-2 text-xs text-slate-600" aria-label={t('Pendiente')}>
              {problems.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <span className="mr-auto text-xs text-slate-500">{t('Se genera en la hoja «GEMMA», dentro de un marco «GC» (se sustituye lo generado antes).')}</span>
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          {t('Cerrar')}
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={problems.length > 0}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Wand2 size={16} />{' '}{t('Generar grafcet de conducción')}
        </button>
      </div>
    </dialog>
  )
}
