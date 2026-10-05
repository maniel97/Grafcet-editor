import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX, FileText, GraduationCap, X } from 'lucide-react'
import { N_, t } from '../lib/i18n'
import { DEFAULT_EXERCISE, PART_MODES, exerciseConfig, runChecks } from '../lib/exercise'
import { buildPlcModel } from '../lib/plcModel'
import { REQUIREMENTS } from '../lib/requirements'

const PARTS = [
  ['plant', N_('Planta virtual')],
  ['variables', N_('Tabla de variables')],
  ['electrical', N_('Esquema eléctrico')],
]

// Preparar un ejercicio a partir del proyecto abierto, que es la solución del profesor
// (lib/exercise.js). Se guarda en el proyecto (plc.exercise); «Para el alumnado» descarga la
// versión sin solución. getProject() -> { nodes, edges, plc } en este momento.
// onExportSheet(config) -> promesa: la hoja de prácticas en PDF con el ejercicio dentro.
export default function ExerciseDialog({ plc, getProject, onSave, onExportStudent, onExportSheet, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const initial = exerciseConfig(plc) ?? { ...DEFAULT_EXERCISE, title: '', checks: { ...DEFAULT_EXERCISE.checks, sequence: plc.sequence ?? '', scenario: plc.scenarios?.[0]?.id ?? '' } }
  const [draft, setDraft] = useState(initial)
  const [results, setResults] = useState(null)
  const [making, setMaking] = useState(false) // generando la hoja en PDF
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const scenarios = plc.scenarios ?? []
  const hasCylinders = (plc.scene?.elements ?? []).some((e) => e.type === 'cylinder')
  const hasSinks = (plc.scene?.elements ?? []).some((e) => e.type === 'sink')
  // Salidas del proyecto (para elegir cuáles cuentan en las pruebas de comportamiento).
  const outputs = (() => {
    try {
      const { nodes, edges } = getProject()
      return buildPlcModel(nodes, edges, plc).variables.filter((v) => v.type === 'output').map((v) => v.name)
    } catch {
      return []
    }
  })()
  const behaviour = draft.checks.behaviour ?? DEFAULT_EXERCISE.checks.behaviour
  const setBehaviour = (patch) => set({ checks: { ...draft.checks, behaviour: { ...behaviour, ...patch } } })
  const requirements = draft.checks.requirements ?? []
  const setRequirements = (list) => set({ checks: { ...draft.checks, requirements: list } })
  const toggle = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
  const store = () => onSave({ ...draft, student: undefined })
  // Probar con la solución del profesor (el proyecto abierto) y lo que hay ahora en el diálogo.
  const test = () => {
    const project = getProject()
    setResults(runChecks({ ...project, plc: { ...project.plc, exercise: { ...draft, frozen: undefined } } }))
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
        {/* Cabecera de la hoja de prácticas en PDF (opcional). */}
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ['subject', N_('Asignatura')],
            ['course', N_('Curso')],
            ['cycle', N_('Ciclo / estudios')],
            ['center', N_('Centro')],
            ['teacher', N_('Profesor/a')],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs font-medium text-slate-500">{t(label)}</span>
              <input
                id={`exercise-sheet-${key}`}
                value={draft.sheet?.[key] ?? ''}
                onChange={(e) => set({ sheet: { ...DEFAULT_EXERCISE.sheet, ...draft.sheet, [key]: e.target.value } })}
                placeholder={t('(opcional)')}
                className={field}
              />
            </label>
          ))}
        </div>
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
          <div data-tour="pruebas-comportamiento" className="space-y-1.5 rounded-md bg-slate-50 p-2">
            <p className="font-medium">{t('Pruebas de comportamiento')}</p>
            <p className="text-xs text-slate-500">
              {t('Con cada escenario elegido, la máquina del alumno tiene que responder como tu solución: las salidas se encienden y se apagan en los mismos momentos (con un margen) y llegan las mismas piezas a cada recogida. No se compara el dibujo.')}
            </p>
            {scenarios.length === 0 && <p className="text-xs text-amber-800">{t('Graba antes algún escenario en la simulación (o dibújalo en el editor de escenarios).')}</p>}
            {scenarios.map((s) => (
              <label key={s.id} className="flex items-center gap-2">
                <input type="checkbox" checked={behaviour.scenarios.includes(s.id)} onChange={() => setBehaviour({ scenarios: toggle(behaviour.scenarios, s.id) })} />
                {s.name}
              </label>
            ))}
            {behaviour.scenarios.length > 0 && (
              <>
                <p className="pt-1 text-xs font-medium text-slate-500">{t('Salidas que cuentan (ninguna marcada: todas)')}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {outputs.map((name) => (
                    <label key={name} className="flex items-center gap-1 font-mono text-xs">
                      <input type="checkbox" checked={behaviour.outputs.includes(name)} onChange={() => setBehaviour({ outputs: toggle(behaviour.outputs, name) })} />
                      {name}
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2">
                  {t('Margen de tiempo')}
                  <input
                    id="exercise-tolerance"
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={behaviour.tolerance}
                    onChange={(e) => setBehaviour({ tolerance: Number(e.target.value) || 0.5 })}
                    className="w-20 rounded-md border border-slate-300 px-2 py-0.5"
                  />
                  {t('s')}
                </label>
                {hasSinks && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={behaviour.counts} onChange={(e) => setBehaviour({ counts: e.target.checked })} />
                    {t('Contar las piezas de cada recogida')}
                  </label>
                )}
              </>
            )}
          </div>
          {/* Requisitos: lo que el grafcet tiene que usar, además de funcionar. */}
          <div className="space-y-1.5 rounded-md bg-slate-50 p-2" role="group" aria-label={t('Requisitos')}>
            <p className="font-medium">{t('Requisitos')}</p>
            <p className="text-xs text-slate-500">{t('Lo que el grafcet tiene que usar, además de funcionar. Se mira en el dibujo del alumno.')}</p>
            <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
              {REQUIREMENTS.map((r) => {
                const current = requirements.find((x) => x.id === r.id)
                return (
                  <label key={r.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(current)}
                      onChange={(e) => setRequirements(e.target.checked ? [...requirements, { id: r.id, ...(r.value ? { value: r.value } : {}) }] : requirements.filter((x) => x.id !== r.id))}
                    />
                    {r.value ? (
                      <span className="flex items-center gap-1">
                        {t(r.label, { n: '#' }).split('#')[0]}
                        <input
                          id={`requirement-${r.id}`}
                          type="number"
                          min="1"
                          max="99"
                          value={current?.value ?? r.value}
                          aria-label={t('Número máximo de etapas')}
                          onChange={(e) => {
                            const value = Math.max(1, Number(e.target.value) || r.value)
                            setRequirements(current ? requirements.map((x) => (x.id === r.id ? { ...x, value } : x)) : [...requirements, { id: r.id, value }])
                          }}
                          className="w-14 rounded border border-slate-300 px-1 py-0.5"
                        />
                        {t(r.label, { n: '#' }).split('#')[1]}
                      </span>
                    ) : (
                      t(r.label)
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-slate-500">{t('Pistas')}</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.hints.enabled} onChange={(e) => set({ hints: { ...draft.hints, enabled: e.target.checked } })} />
            {t('Ofrecer pistas al alumnado')}
          </label>
          {draft.hints.enabled ? (
            <>
              <textarea
                id="exercise-hints"
                rows={4}
                value={(draft.hints.items ?? []).join('\n')}
                onChange={(e) => set({ hints: { ...draft.hints, items: e.target.value.split('\n') } })}
                placeholder={t('Una pista por línea, de la más general a la más concreta.\nP. ej.: Necesitas una etapa de reposo y otra con el motor en marcha.')}
                className={field}
                aria-label={t('Pistas, una por línea')}
              />
              <p className="text-xs text-slate-500">{t('Una por línea, de la más general a la más concreta. El alumno las abre de una en una y quedan contadas.')}</p>
            </>
          ) : (
            <p className="text-xs text-slate-500">{t('Sin pistas: el alumno no verá ninguna (por ejemplo, si prefieres darlas en persona).')}</p>
          )}
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-slate-500">{t('Datos del proceso')}</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(draft.processData)} onChange={(e) => set({ processData: e.target.checked })} />
            {t('Anotar datos del proceso del alumnado (solo totales)')}
          </label>
          <p className="text-xs text-slate-500">
            {t('Veces que comprueba, minutos con actividad, simulaciones y pistas vistas; nada de lo que hace en cada momento. El alumno lo ve avisado al abrir el ejercicio y los datos salen en una página de su dossier. Desactivado por defecto.')}
          </p>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-slate-500">{t('Nota')}</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.grade.enabled} onChange={(e) => set({ grade: { ...draft.grade, enabled: e.target.checked } })} />
            {t('Mostrar una nota al comprobar')}
          </label>
          {draft.grade.enabled && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <label className="flex items-center gap-2">
                {t('Sobre')}
                <input id="exercise-grade-max" type="number" min="1" max="100" value={draft.grade.max} onChange={(e) => set({ grade: { ...draft.grade, max: Math.max(1, Number(e.target.value) || 10) } })} className="w-16 rounded-md border border-slate-300 px-2 py-0.5" />
              </label>
              {draft.hints.enabled && (
                <label className="flex items-center gap-2">
                  {t('Cada pista resta')}
                  <input id="exercise-hint-penalty" type="number" min="0" max="10" step="0.25" value={draft.grade.hintPenalty} onChange={(e) => set({ grade: { ...draft.grade, hintPenalty: Math.max(0, Number(e.target.value) || 0) } })} className="w-16 rounded-md border border-slate-300 px-2 py-0.5" />
                </label>
              )}
              <p className="w-full text-xs text-slate-500">{t('La parte de criterios cumplidos sobre la nota máxima. Es orientativa: la nota final la pones tú.')}</p>
            </div>
          )}
        </fieldset>

        <section data-tour="probar-ejercicio" aria-label={t('Prueba con tu solución')} className="space-y-2 rounded-md border border-slate-200 p-3">
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
            onExportStudent({ ...draft, student: undefined, frozen: undefined })
          }}
          className="rounded-md border border-blue-300 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-50"
        >
          {t('Guardar y descargar para el alumnado')}
        </button>
        {onExportSheet && (
          <button
            type="button"
            disabled={making}
            onClick={async () => {
              store()
              setMaking(true)
              try {
                await onExportSheet({ ...draft, student: undefined, frozen: undefined })
              } finally {
                setMaking(false)
              }
            }}
            title={t('Una hoja de prácticas para imprimir o repartir, con el ejercicio dentro: al abrir el PDF en el editor se carga el ejercicio')}
            className="flex items-center gap-1 rounded-md border border-blue-300 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-50 disabled:opacity-60"
          >
            <FileText size={14} /> {making ? t('Generando…') : t('Hoja de prácticas (PDF)')}
          </button>
        )}
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
