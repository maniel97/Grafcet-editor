import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX, GraduationCap, X } from 'lucide-react'
import { N_, t } from '../lib/i18n'
import { DEFAULT_EXERCISE, PART_MODES, exerciseConfig, runChecks } from '../lib/exercise'

const PARTS = [
  ['plant', N_('Planta virtual')],
  ['variables', N_('Tabla de variables')],
  ['electrical', N_('Esquema eléctrico')],
]

// Preparar un ejercicio a partir del proyecto abierto, que es la solución del profesor
// (lib/exercise.js). Se guarda en el proyecto (plc.exercise); «Para el alumnado» descarga la
// versión sin solución. getProject() -> { nodes, edges, plc } en este momento.
export default function ExerciseDialog({ plc, getProject, onSave, onExportStudent, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const initial = exerciseConfig(plc) ?? { ...DEFAULT_EXERCISE, title: '', checks: { ...DEFAULT_EXERCISE.checks, sequence: plc.sequence ?? '', scenario: plc.scenarios?.[0]?.id ?? '' } }
  const [draft, setDraft] = useState(initial)
  const [results, setResults] = useState(null)
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const scenarios = plc.scenarios ?? []
  const hasCylinders = (plc.scene?.elements ?? []).some((e) => e.type === 'cylinder')
  const store = () => onSave({ ...draft, student: undefined })
  // Probar con la solución del profesor (el proyecto abierto) y lo que hay ahora en el diálogo.
  const test = () => {
    const project = getProject()
    setResults(runChecks({ ...project, plc: { ...project.plc, exercise: draft } }))
  }
  const field = 'mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="exercise-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(46rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="exercise-title" className="flex items-center gap-2 text-base font-semibold">
          <GraduationCap size={18} /> {t('Ejercicio para el alumnado')}
        </h2>
        <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} aria-label={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4 text-sm">
        <p className="text-slate-600">
          {t('El proyecto abierto es tu solución: no se reparte. El alumnado recibe el enunciado, lo que marques como dado y las comprobaciones, selladas.')}
        </p>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">{t('Título')}</span>
          <input id="exercise-title-input" value={draft.title} onChange={(e) => set({ title: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">{t('Enunciado')}</span>
          <textarea
            id="exercise-statement"
            rows={6}
            value={draft.statement}
            onChange={(e) => set({ statement: e.target.value })}
            placeholder={t('Qué tiene que hacer la máquina. Admite **negrita** y listas con «- ».')}
            className={field}
          />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-slate-500">{t('Lo que recibe hecho el alumnado')}</legend>
          {PARTS.map(([part, label]) => (
            <label key={part} className="flex items-center justify-between gap-3">
              <span>{t(label)}</span>
              <select
                id={`exercise-part-${part}`}
                value={draft.parts[part]}
                onChange={(e) => set({ parts: { ...draft.parts, [part]: e.target.value } })}
                className="rounded-md border border-slate-300 px-2 py-1"
              >
                {PART_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t(m.label)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p className="text-xs text-slate-500">{t('El grafcet no se da nunca: es lo que hace el alumno.')}</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-500">{t('Qué se comprueba')}</legend>
          <p className="text-slate-600">{t('Siempre: que hay un grafcet y que Verificar no encuentra errores. Con la tabla de variables dada, que solo se usan sus variables.')}</p>
          <label className="flex items-center gap-2">
            <input id="exercise-warnings" type="checkbox" checked={draft.checks.warnings} onChange={(e) => set({ checks: { ...draft.checks, warnings: e.target.checked } })} />
            {t('Tampoco se admiten avisos de Verificar')}
          </label>
          {hasCylinders && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">{t('Secuencia de los cilindros')}</span>
                <input
                  id="exercise-sequence"
                  value={draft.checks.sequence}
                  onChange={(e) => set({ checks: { ...draft.checks, sequence: e.target.value } })}
                  placeholder={t('p. ej. A+ B+ B− A−')}
                  className={`${field} font-mono`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">{t('Con el escenario de prueba')}</span>
                <select
                  id="exercise-scenario"
                  value={draft.checks.scenario}
                  onChange={(e) => set({ checks: { ...draft.checks, scenario: e.target.value } })}
                  className={field}
                >
                  <option value="">{t('— (sin comprobar la secuencia)')}</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {!scenarios.length && (
                <p className="text-xs text-amber-800 sm:col-span-2">{t('Para comprobar la secuencia, graba antes un escenario en la simulación (p. ej. pulsar Marcha y esperar un ciclo).')}</p>
              )}
            </div>
          )}
        </fieldset>


        <section aria-label={t('Prueba con tu solución')} className="space-y-2 rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{t('Prueba con tu solución')}</p>
            <button type="button" onClick={test} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100">
              {t('Probar')}
            </button>
          </div>
          {results && (
            <ul className="space-y-1" aria-label={t('Resultado')}>
              {results.map((r) => (
                <li key={r.id} data-check={r.id} data-ok={r.ok ? 'si' : 'no'} className="flex gap-2">
                  {r.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0 text-green-700" /> : <CircleX size={16} className="mt-0.5 shrink-0 text-red-700" />}
                  <span>
                    {r.title}
                    {r.detail && <span className="text-slate-500"> · {r.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {results?.some((r) => !r.ok) && <p className="text-xs text-red-800">{t('Tu solución no pasa alguna comprobación: revísala antes de repartir el ejercicio.')}</p>}
        </section>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={() => dialogRef.current.close()} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
          {t('Cancelar')}
        </button>
        <button
          type="button"
          onClick={() => {
            store()
            onExportStudent({ ...draft, student: undefined })
          }}
          className="rounded-md border border-blue-300 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-50"
        >
          {t('Guardar y descargar para el alumnado')}
        </button>
        <button
          type="button"
          onClick={() => {
            store()
            dialogRef.current.close()
          }}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('Guardar')}
        </button>
      </div>
    </dialog>
  )
}
