import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardCheck, Download, FilePlus2, FolderOpen, TriangleAlert, X } from 'lucide-react'
import { language, t } from '../lib/i18n'
import { loadProjects, downloadFile } from '../lib/projectFile'
import { classCsv, reviewSubmission, similarPairs, teacherSealed } from '../lib/classReview'
import { fileName } from '../lib/fileNames'

// Corregir las entregas de una clase (Abrir > Corregir entregas): el profesor suelta los PDF de
// los dossiers (o los .json) y cada entrega se vuelve a corregir con las comprobaciones de su
// ejercicio abierto. Nada sale del navegador: la tabla se queda aquí y se descarga como CSV.
// getProject() -> el proyecto abierto; onOpen(proyecto, nombre): abrir una entrega para verla.
export default function ClassDialog({ getProject, onOpen, onClose }) {
  const dialogRef = useRef(null)
  const fileRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const teacher = useMemo(() => teacherSealed(getProject()), [getProject])
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const pairs = useMemo(() => similarPairs(rows), [rows])
  const hasGrade = rows.some((r) => r.grade != null)
  const hasProcess = rows.some((r) => r.process)
  const num = (v) => Number(v).toLocaleString(language(), { maximumFractionDigits: 1 })

  const add = async (files) => {
    setBusy(true)
    const found = []
    for (const file of files) {
      try {
        const items = await loadProjects(file)
        // Una entrega trae el proyecto del alumno (en un guion, los ejercicios de alumno que haya).
        const own = items.filter((i) => i.project.plc?.exercise?.student)
        if (!own.length) found.push({ file: file.name, name: file.name, error: t('No es la entrega de un ejercicio.') })
        for (const item of own) found.push({ ...reviewSubmission(item.project, file.name, teacher), project: item.project })
      } catch (err) {
        found.push({ file: file.name, name: file.name, error: err.message })
      }
    }
    setRows((list) => [...list, ...found].sort((a, b) => a.name.localeCompare(b.name, language())))
    setBusy(false)
  }
  const similarTo = (i) => pairs.filter((p) => p.a === i || p.b === i).map((p) => rows[p.a === i ? p.b : p.a].name)

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="class-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(64rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="class-title" className="flex items-center gap-2 text-base font-semibold">
          <ClipboardCheck size={18} /> {t('Corregir entregas')}
        </h2>
        <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} aria-label={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div
        className="max-h-[72vh] space-y-3 overflow-y-auto px-5 py-4 text-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          add([...e.dataTransfer.files])
        }}
      >
        {teacher ? (
          <p data-class-mode="profesor" className="rounded-md bg-green-50 px-3 py-2 text-green-900">
            {t('Se corrige con las comprobaciones de tu ejercicio abierto: «{titulo}».', { titulo: teacher.title || t('(sin título)') })}
          </p>
        ) : (
          <p data-class-mode="propias" className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-amber-950">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            {t('No tienes abierto el ejercicio con tu solución: cada entrega se corrige con las comprobaciones que trae su archivo, y alguien podría haberlas cambiado. Abre tu ejercicio para corregir con las tuyas.')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileRef.current.click()} className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700">
            <FilePlus2 size={15} /> {t('Añadir entregas…')}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".json,.pdf,application/json,application/pdf"
            className="hidden"
            aria-label={t('Archivos de las entregas')}
            onChange={(e) => {
              add([...e.target.files])
              e.target.value = ''
            }}
          />
          <span className="text-xs text-slate-500">{t('Los dossiers en PDF (llevan el proyecto dentro) o los .json. También puedes soltarlos aquí.')}</span>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => downloadFile(classCsv(rows, pairs), fileName('csv', 'clase'), 'text/csv;charset=utf-8')}
              className="ml-auto flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
            >
              <Download size={15} /> {t('Descargar CSV')}
            </button>
          )}
        </div>
        {busy && <p className="text-slate-500">{t('Corrigiendo…')}</p>}
        {pairs.length > 0 && (
          <div role="note" data-similar className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-orange-950">
            <p className="font-medium">{t('Trabajos muy parecidos (mismo dibujo y misma lógica): conviene mirarlos.')}</p>
            <ul className="list-disc pl-5">
              {pairs.map((p) => (
                <li key={`${p.a}-${p.b}`}>
                  {rows[p.a].name} — {rows[p.b].name}
                </li>
              ))}
            </ul>
            <p className="text-xs">{t('Es un aviso, no una prueba: dos trabajos pueden parecerse por buenas razones.')}</p>
          </div>
        )}
        {rows.length === 0 ? (
          <p className="py-6 text-center text-slate-400">{t('Todavía no hay entregas.')}</p>
        ) : (
          <table className="w-full border-collapse text-left" aria-label={t('Entregas')}>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-2">{t('Alumno/a')}</th>
                <th className="py-1.5 pr-2">{t('Correctas')}</th>
                <th className="py-1.5 pr-2">{t('Pistas')}</th>
                {hasGrade && <th className="py-1.5 pr-2">{t('Nota')}</th>}
                {hasProcess && <th className="py-1.5 pr-2">{t('Proceso')}</th>}
                <th className="py-1.5 pr-2">{t('Avisos')}</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const failed = r.results?.filter((c) => !c.ok) ?? []
                const notes = [r.otherExercise && t('Es de otro ejercicio'), r.ownChecks && t('Con sus propias comprobaciones'), ...similarTo(i).map((n) => t('Parecido a {nombre}', { nombre: n }))].filter(Boolean)
                return (
                  <tr key={`${r.file}-${i}`} data-row={r.name} className="border-b border-slate-100 align-top">
                    <td className="py-1.5 pr-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{r.file}</span>
                    </td>
                    <td className="py-1.5 pr-2">
                      {r.error ? (
                        <span className="text-red-800">{r.error}</span>
                      ) : (
                        <details>
                          <summary className={`cursor-pointer font-medium ${r.passed === r.total ? 'text-green-800' : 'text-red-800'}`} data-score>
                            {r.passed} / {r.total}
                          </summary>
                          <ul className="mt-1 space-y-0.5 text-xs">
                            {r.results.map((c) => (
                              <li key={c.id} className={c.ok ? 'text-green-800' : 'text-red-800'}>
                                {c.ok ? '✓' : '✗'} {c.title}
                                {!c.ok && c.detail ? ` — ${c.detail}` : ''}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {!r.error && failed.length > 0 && <span className="block text-xs text-slate-500">{failed[0].title}</span>}
                    </td>
                    <td className="py-1.5 pr-2">{r.error ? '' : r.hintsShown}</td>
                    {hasGrade && <td className="py-1.5 pr-2 font-medium">{r.grade == null ? '' : num(r.grade)}</td>}
                    {hasProcess && (
                      <td className="py-1.5 pr-2 text-xs text-slate-600">
                        {r.process
                          ? [
                              (r.process.checks ?? 0) === 1 ? t('1 comprobación') : t('{n} comprobaciones', { n: r.process.checks ?? 0 }),
                              t('{n} min', { n: r.process.minutes ?? 0 }),
                              (r.process.simulations ?? 0) === 1 ? t('1 simulación') : t('{n} simulaciones', { n: r.process.simulations ?? 0 }),
                            ].join(' · ')
                          : ''}
                      </td>
                    )}
                    <td className="py-1.5 pr-2 text-xs text-orange-900">{notes.join(' · ')}</td>
                    <td className="py-1.5 text-right">
                      {r.project && onOpen && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpen(r.project, r.name)
                            dialogRef.current.close()
                          }}
                          title={t('Abrir esta entrega en el editor (tu proyecto queda en Trabajos anteriores)')}
                          aria-label={t('Abrir la entrega de {nombre}', { nombre: r.name })}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100"
                        >
                          <FolderOpen size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </dialog>
  )
}
