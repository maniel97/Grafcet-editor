import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, BookOpenCheck, FilePlus2, Trash2, X } from 'lucide-react'
import { N_, t } from '../lib/i18n'
import { exerciseConfig, isStudent } from '../lib/exercise'
import { loadProjects } from '../lib/projectFile'
import { PRACTICE_GUIDES } from '../lib/practiceGuides'

export const DEFAULT_GUIDE = {
  title: '',
  sheet: { subject: '', course: '', cycle: '', center: '', teacher: '' },
  rules: '',
  // Prácticas en orden: { id: 'current' } es el proyecto abierto; las demás llevan su proyecto
  // (del profesor o ya del alumnado). Solo el proyecto abierto puede ir como práctica guiada: su
  // grafcet se dibuja desde el lienzo.
  practices: [{ id: 'current' }],
  currentGuided: false,
}
const SHEET_FIELDS = [
  ['subject', N_('Asignatura')],
  ['course', N_('Curso')],
  ['cycle', N_('Ciclo / estudios')],
  ['center', N_('Centro')],
  ['teacher', N_('Profesor/a')],
]

// Guion de prácticas (Exportar > Guion de prácticas): varias prácticas en un único PDF, con
// normas generales, cabecera y pie en cada página y cada práctica adjunta (lib/exerciseSheetPdf.js).
// El guion se guarda en el proyecto abierto (plc.guide; no viaja al alumnado).
// onGenerate(guide) -> promesa (genera y descarga el PDF).
export default function GuideDialog({ plc, onChange, onGenerate, onClose }) {
  const dialogRef = useRef(null)
  const fileRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const guide = { ...DEFAULT_GUIDE, ...plc.guide, sheet: { ...DEFAULT_GUIDE.sheet, ...plc.guide?.sheet } }
  const set = (patch) => onChange({ ...guide, ...patch })
  const [making, setMaking] = useState(false)
  const [notice, setNotice] = useState('')
  const currentConfig = exerciseConfig(plc)
  const field = 'mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'
  const titleOf = (p) => (p.id === 'current' ? currentConfig?.title || t('(sin título)') : p.project.plc.exercise?.title || p.project.name || t('(sin título)'))
  const move = (i, d) => {
    const list = [...guide.practices]
    ;[list[i], list[i + d]] = [list[i + d], list[i]]
    set({ practices: list })
  }

  // Añadir prácticas desde archivos (.json del profesor o del alumnado, o PDF de hojas y guiones).
  const add = async (files) => {
    const added = []
    let skipped = 0
    for (const file of files) {
      try {
        for (const item of await loadProjects(file)) {
          if (item.project.plc?.exercise) added.push({ id: crypto.randomUUID(), project: item.project })
          else skipped++
        }
      } catch {
        skipped++
      }
    }
    set({ practices: [...guide.practices, ...added] })
    setNotice(skipped ? t('Se han añadido {n} prácticas; {m} archivos no eran ejercicios (prepáralos antes en Exportar > Ejercicio para el alumnado).', { n: added.length, m: skipped }) : '')
  }
  // El guion de ejemplo: sus datos, normas y prácticas (la guiada, si es el proyecto abierto).
  const useExample = () => {
    const example = PRACTICE_GUIDES[0]
    const [first, ...rest] = example.practices
    const openIsFirst = currentConfig?.title === first.teacher().plc.exercise.title
    set({
      title: example.title,
      sheet: { ...DEFAULT_GUIDE.sheet, ...example.sheet },
      rules: example.rules,
      currentGuided: openIsFirst,
      practices: [openIsFirst ? { id: 'current' } : { id: crypto.randomUUID(), project: first.teacher() }, ...rest.map((p) => ({ id: crypto.randomUUID(), project: p.teacher() }))],
    })
    setNotice(openIsFirst ? '' : t('La práctica 1 es guiada: para que salga con su grafcet resuelto, abre antes su solución (Abrir > Ejercicios) y vuelve aquí.'))
  }

  const practices = guide.practices.filter((p) => p.id !== 'current' || currentConfig)
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="guide-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(48rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="guide-title" className="flex items-center gap-2 text-base font-semibold">
          <BookOpenCheck size={18} /> {t('Guion de prácticas')}
        </h2>
        <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} aria-label={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-slate-600">
            {t('Varias prácticas en un único PDF, como un guion de los de siempre: normas generales, cabecera y pie en cada página, y cada práctica con su enunciado, lo que se da y sus criterios. Cada ejercicio va dentro del PDF: al abrirlo en el editor se elige la práctica.')}
          </p>
          <button type="button" onClick={useExample} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100">
            {t('Usar el guion de ejemplo')}
          </button>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">{t('Título del guion')}</span>
          <input id="guide-title-input" value={guide.title} onChange={(e) => set({ title: e.target.value })} className={field} />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          {SHEET_FIELDS.map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs font-medium text-slate-500">{t(label)}</span>
              <input id={`guide-${key}`} value={guide.sheet[key]} onChange={(e) => set({ sheet: { ...guide.sheet, [key]: e.target.value } })} placeholder={t('(opcional)')} className={field} />
            </label>
          ))}
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">{t('Normas generales (entrega, evaluación, qué debe incluir cada práctica…)')}</span>
          <textarea id="guide-rules" rows={6} value={guide.rules} onChange={(e) => set({ rules: e.target.value })} className={`${field} font-mono text-xs`} />
        </label>

        <section aria-label={t('Prácticas del guion')} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{t('Prácticas')}</p>
            <button type="button" onClick={() => fileRef.current.click()} className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100">
              <FilePlus2 size={13} /> {t('Añadir prácticas…')}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".json,.pdf,application/json,application/pdf"
              className="hidden"
              aria-label={t('Archivos de prácticas')}
              onChange={(e) => {
                add([...e.target.files])
                e.target.value = ''
              }}
            />
          </div>
          {!currentConfig && <p className="text-xs text-slate-500">{t('El proyecto abierto no está preparado como ejercicio: no entra en el guion (Exportar > Ejercicio para el alumnado).')}</p>}
          {notice && <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">{notice}</p>}
          {practices.length === 0 && <p className="text-xs text-slate-500">{t('Añade las prácticas: archivos de ejercicios (.json) u hojas de prácticas en PDF.')}</p>}
          <ol className="space-y-1">
            {practices.map((p, i) => (
              <li key={p.id} data-practice={i + 1} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5">
                <span className="w-6 shrink-0 text-right font-mono text-xs text-slate-500">{i + 1}.</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{titleOf(p)}</span>
                  <span className="block text-xs text-slate-500">
                    {p.id === 'current' ? t('El proyecto abierto') : isStudent(p.project.plc) ? t('Ejercicio (versión del alumnado)') : t('Ejercicio con su solución')}
                  </span>
                </span>
                {p.id === 'current' && (
                  <label className="flex shrink-0 items-center gap-1 text-xs" title={t('Sale con su solución (grafcet, conexionado, ladder y tabla) y el proyecto resuelto adjunto')}>
                    <input type="checkbox" checked={guide.currentGuided} onChange={(e) => set({ currentGuided: e.target.checked })} />
                    {t('Guiada')}
                  </label>
                )}
                <button type="button" disabled={i === 0} onClick={() => move(guide.practices.indexOf(p), -1)} title={t('Subir')} aria-label={t('Subir')} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button type="button" disabled={i === practices.length - 1} onClick={() => move(guide.practices.indexOf(p), 1)} title={t('Bajar')} aria-label={t('Bajar')} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                  <ArrowDown size={14} />
                </button>
                {p.id !== 'current' && (
                  <button type="button" onClick={() => set({ practices: guide.practices.filter((x) => x.id !== p.id) })} title={t('Quitar')} aria-label={t('Quitar')} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={() => dialogRef.current.close()} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
          {t('Cerrar')}
        </button>
        <button
          type="button"
          disabled={making || practices.length === 0}
          onClick={async () => {
            setMaking(true)
            try {
              await onGenerate({ ...guide, practices })
            } catch (err) {
              setNotice(err.message)
            } finally {
              setMaking(false)
            }
          }}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {making ? t('Generando…') : t('Descargar el guion (PDF)')}
        </button>
      </div>
    </dialog>
  )
}
