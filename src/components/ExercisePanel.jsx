import { useState } from 'react'
import { CircleCheck, CircleDashed, CircleX, Download, GraduationCap, Lightbulb, Pencil, X } from 'lucide-react'
import { language, t } from '../lib/i18n'
import { exerciseConfig, hintsOf, isStudent, runChecks } from '../lib/exercise'
import { gradeOf } from '../lib/requirements'
import Markdown from '../help/Markdown'

// Panel del ejercicio (lib/exercise.js): enunciado, «Comprobar» y el resultado de cada
// comprobación. El alumnado lo tiene abierto desde que abre el ejercicio. El profesor, en su
// proyecto (con la solución), lo usa para probar el ejercicio antes de repartirlo.
// getProject() -> { nodes, edges, plc } en este momento.
// onReplay(escenario): reproducirlo en la simulación (pruebas de comportamiento en rojo).
// onHintShown(): el alumno ha abierto una pista más (se guarda en su proyecto: exercise.hintsShown).
export default function ExercisePanel({ plc, getProject, onEdit, onExportStudent, onReplay, onHintShown, onClose }) {
  const config = exerciseConfig(plc)
  const student = isStudent(plc)
  const [results, setResults] = useState(null)
  const [checkedAt, setCheckedAt] = useState(null)
  // El profesor prueba las pistas sin que cuenten (no se guarda en su proyecto).
  const [teacherShown, setTeacherShown] = useState(0)
  if (!config) return null
  const hints = hintsOf(plc)
  const shown = Math.min(hints.length, student ? (plc.exercise.hintsShown ?? 0) : teacherShown)
  const penalty = config.grade.enabled ? Number(config.grade.hintPenalty) || 0 : 0
  const num = (v) => v.toLocaleString(language(), { maximumFractionDigits: 2 })
  const showHint = () => {
    if (penalty && !window.confirm(t('Cada pista resta {puntos} puntos de la nota. ¿Ver la siguiente?', { puntos: num(penalty) }))) return
    if (student) onHintShown?.()
    else setTeacherShown((n) => n + 1)
  }
  const passed = results?.filter((r) => r.ok).length ?? 0
  const solved = results && results.length > 0 && passed === results.length

  const check = () => {
    setResults(runChecks(getProject()))
    setCheckedAt(new Date())
  }

  return (
    <aside data-tour="ejercicio" aria-label={t('Ejercicio')} className="side-panel flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <GraduationCap size={18} className="shrink-0 text-blue-700" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{config.title || t('Ejercicio')}</h2>
        <button type="button" onClick={onClose} title={t('Cerrar')} aria-label={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {!student && (
          <div className="space-y-2 rounded-md bg-amber-50 p-3 text-amber-950">
            <p>{t('Vista del profesor: así verá el ejercicio el alumnado. «Comprobar» lo prueba con tu solución: todo debería salir en verde antes de repartirlo.')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 hover:bg-amber-100">
                <Pencil size={14} /> {t('Editar el ejercicio')}
              </button>
              <button type="button" onClick={onExportStudent} className="flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700">
                <Download size={14} /> {t('Para el alumnado')}
              </button>
            </div>
          </div>
        )}
        <section aria-label={t('Enunciado')}>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{t('Enunciado')}</h3>
          {config.statement?.trim() ? <Markdown source={config.statement} /> : <p className="text-slate-500">{t('Sin enunciado.')}</p>}
        </section>

        <section aria-label={t('Comprobar')} className="space-y-2">
          <button type="button" onClick={check} className="w-full rounded-md bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700">
            {t('Comprobar')}
          </button>
          {results && (
            <>
              {solved ? (
                <p role="status" data-exercise="resuelto" className="tour-done flex items-center gap-2 rounded-md bg-green-100 px-3 py-2 font-semibold text-green-900">
                  <CircleCheck size={18} className="tour-check shrink-0" /> {t('¡Ejercicio resuelto! Todo correcto.')}
                </p>
              ) : (
                <p role="status" data-exercise="pendiente" className="text-slate-600">
                  {t('{n} de {total} comprobaciones correctas.', { n: passed, total: results.length })}
                </p>
              )}
              <ul className="space-y-1.5" aria-label={t('Resultado')}>
                {results.map((r) => (
                  <li key={r.id} data-check={r.id} data-ok={r.ok ? 'si' : 'no'} className={`flex gap-2 rounded-md border px-2 py-1.5 ${r.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    {r.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0 text-green-700" /> : <CircleX size={16} className="mt-0.5 shrink-0 text-red-700" />}
                    <div className="min-w-0">
                      <p className={`font-medium ${r.ok ? 'text-green-900' : 'text-red-800'}`}>{r.title}</p>
                      {r.detail && <p className={r.ok ? 'text-green-800' : 'text-red-800'}>{r.detail}</p>}
                      {!r.ok && r.scenario && onReplay && (
                        <button type="button" onClick={() => onReplay(r.scenario)} className="mt-1 rounded-md border border-red-300 bg-white px-2 py-0.5 text-xs text-red-800 hover:bg-red-100">
                          {t('Verlo en la simulación')}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {!solved && (
                <p className="flex items-start gap-1.5 text-xs text-slate-500">
                  <CircleDashed size={14} className="mt-0.5 shrink-0" />
                  {t('Arregla lo que sale en rojo, empezando por arriba, y vuelve a comprobar.')}
                </p>
              )}
              {config.grade.enabled && (
                <p data-grade className="rounded-md border border-slate-200 px-3 py-2">
                  <span className="font-semibold">{t('Nota: {nota} de {max}', { nota: num(gradeOf(results, config.grade, shown)), max: num(Number(config.grade.max) || 10) })}</span>
                  {penalty > 0 && shown > 0 && <span className="block text-xs text-slate-500">{t('Incluye −{puntos} por {n} pistas vistas.', { puntos: num(penalty * shown), n: shown })}</span>}
                </p>
              )}
              {checkedAt && <p className="text-xs text-slate-400">{t('Comprobado a las {hora}.', { hora: checkedAt.toLocaleTimeString() })}</p>}
            </>
          )}
        </section>

        {hints.length > 0 && (
          <section aria-label={t('Pistas')} className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <h3 className="flex items-center gap-1.5 font-medium text-amber-950">
              <Lightbulb size={15} className="shrink-0" /> {t('Pistas')}
              <span className="ml-auto text-xs font-normal text-amber-900">{t('{n} de {total}', { n: shown, total: hints.length })}</span>
            </h3>
            {shown > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-amber-950" data-hints-shown={shown}>
                {hints.slice(0, shown).map((h, i) => (
                  <li key={i}>
                    <Markdown source={h} />
                  </li>
                ))}
              </ol>
            )}
            {shown < hints.length && (
              <button type="button" onClick={showHint} className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-amber-950 hover:bg-amber-100">
                {shown === 0 ? t('Ver una pista') : t('Ver la siguiente pista')}
                {penalty > 0 && ` (−${num(penalty)})`}
              </button>
            )}
            <p className="text-xs text-amber-900">{t('Prueba antes por tu cuenta: cada pista ayuda un poco más que la anterior.')}</p>
          </section>
        )}
      </div>
    </aside>
  )
}
