import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, BookCopy, Download, FilePlus2, GripVertical, History, ListOrdered, Loader2, Minus, Plus, SquarePen, Trash2, X } from 'lucide-react'
import DossierPreview from './DossierPreview'
import OffscreenGrafcet from './OffscreenGrafcet'
import { COVER_FIELDS, dossierOptions } from '../lib/dossier'
import { buildNotebook, notebookTitle, sortByNumber } from '../lib/notebook'
import { notebookProject, practiceAttachment, practiceEntry, practiceFigures, practiceTitleOf, withNotebookCover } from '../lib/notebookContent'
import { loadPdf, makeMeasure, renderDossierPdf } from '../lib/dossierPdf'
import { attachFiles } from '../lib/pdfAttach'
import { downloadFile, loadProjects } from '../lib/projectFile'
import { listRecent } from '../lib/recent'
import { fileName } from '../lib/fileNames'
import { t } from '../lib/i18n'

const ZOOMS = [0.5, 0.75, 1, 1.25]
const STORAGE_KEY = 'grafcet-editor:notebook'
// Lo que se recuerda de la portada: lo común a la clase, no lo de cada alumno (en el aula, el
// equipo es compartido).
const REMEMBERED = ['subject', 'course', 'teacher']
// Mismo proyecto (para no añadir dos veces la misma práctica).
const sameProject = (a, b) => JSON.stringify([a.nodes, a.edges, a.plc]) === JSON.stringify([b.nodes, b.edges, b.plc])

function saved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

// Entregar varias prácticas (Exportar): las prácticas de un alumno en un solo PDF (lib/notebook.js),
// con vista previa y en el orden que se quiera. Se añaden el proyecto abierto, archivos (.json o
// PDF de dossiers, que llevan el proyecto dentro) y trabajos anteriores. Cada proyecto va dentro
// del PDF: «Corregir entregas» lo lee como cualquier dossier.
// getProject() -> el proyecto abierto ({ nodes, edges, plc, name }).
export default function NotebookDialog({ getProject, onClose }) {
  const dialogRef = useRef(null)
  const fileRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const [today] = useState(() => new Date().toLocaleDateString('es-ES'))
  const [practices, setPractices] = useState([]) // [{ id, project, file, title }]
  const [notice, setNotice] = useState('')
  const [recentOpen, setRecentOpen] = useState(false)
  const recent = useMemo(() => listRecent(), [])
  const firstCover = practices[0] ? dossierOptions(practices[0].project.plc.dossier).cover : {}
  const firstAuthor = practices[0]?.project.plc.titleBlock?.author ?? ''
  const [cover, setCover] = useState(() => saved().cover ?? {})
  const [compact, setCompact] = useState(() => saved().compact ?? true)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cover: Object.fromEntries(REMEMBERED.filter((k) => cover[k]).map((k) => [k, cover[k]])), compact }))
    } catch {
      // sin almacenamiento: no se recuerdan la portada ni las opciones
    }
  }, [cover, compact])
  // Portada: lo escrito aquí y, si no, lo de la portada del dossier de la primera práctica.
  const coverValue = (id) => cover[id] ?? (id === 'student' ? firstCover.student || firstAuthor : firstCover[id]) ?? ''

  // Preparación de cada práctica al añadirla: sus figuras (ladder, planta, esquema…); el grafcet
  // se dibuja fuera de la pantalla, una práctica cada vez (más abajo).
  const [prepared, setPrepared] = useState({}) // id -> figuras
  // La lista de ahora (al añadir archivos, tras leerlos, puede haber cambiado).
  const current = useRef(practices)
  useEffect(() => {
    current.current = practices
  }, [practices])
  const add = (items) => {
    const next = [...current.current]
    let repeated = 0
    for (const item of items) {
      const project = notebookProject(item.project)
      if (!project) continue
      if (next.some((p) => sameProject(p.project, project))) {
        repeated++
        continue
      }
      const id = crypto.randomUUID()
      next.push({ id, project, file: item.file ?? '', title: practiceTitleOf(project, item.file) })
      practiceFigures(project).then((figures) => setPrepared((m) => ({ ...m, [id]: figures })))
    }
    setNotice(repeated ? t('{n} ya estaba en el cuaderno: no se ha añadido otra vez.', { n: repeated }) : '')
    current.current = next
    setPractices(next)
  }
  const addFiles = async (files) => {
    const found = []
    const failed = []
    for (const file of files) {
      try {
        found.push(...(await loadProjects(file)).map((i) => ({ ...i, file: files.length === 1 && !file.name.toLowerCase().endsWith('.pdf') ? file.name : i.file })))
      } catch (err) {
        failed.push(`${file.name}: ${err.message}`)
      }
    }
    add(found)
    if (failed.length) setNotice(failed.join(' · '))
  }
  const addCurrent = () => add([{ project: getProject(), file: '' }])
  const move = (i, d) =>
    setPractices((list) => {
      const next = [...list]
      ;[next[i], next[i + d]] = [next[i + d], next[i]]
      return next
    })
  const remove = (id) => setPractices((list) => list.filter((p) => p.id !== id))
  const [dragged, setDragged] = useState(null)
  const dropOn = (target) => {
    if (dragged == null || dragged === target) return
    setPractices((list) => {
      const next = [...list]
      const [item] = next.splice(dragged, 1)
      next.splice(target, 0, item)
      return next
    })
    setDragged(null)
  }

  const [grafcets, setGrafcets] = useState({}) // id -> [figuras de sus hojas]
  const pending = practices.find((p) => !grafcets[p.id])
  const onGrafcet = useCallback((figs) => pending && setGrafcets((g) => ({ ...g, [pending.id]: figs })), [pending])

  const [jsPDF, setJsPDF] = useState(null)
  useEffect(() => {
    loadPdf().then((js) => setJsPDF(() => js))
  }, [])
  const measure = useMemo(() => (jsPDF ? makeMeasure(jsPDF) : null), [jsPDF])
  const ready = measure && practices.length > 0 && practices.every((p) => grafcets[p.id] && prepared[p.id])
  const fullCover = Object.fromEntries(COVER_FIELDS.map((f) => [f.id, coverValue(f.id)]))
  const coverKey = JSON.stringify(fullCover)
  const notebook = useMemo(() => {
    if (!ready) return null
    const entries = practices.map((p) => practiceEntry(p.project, { grafcet: grafcets[p.id], figures: prepared[p.id], file: p.file, today }))
    return buildNotebook({ today, compact, cover: JSON.parse(coverKey), practices: entries.map((e, i) => ({ ...e, title: practices[i].title })) }, measure)
  }, [ready, practices, grafcets, prepared, today, compact, coverKey, measure])

  const [zoom, setZoom] = useState(0.5)
  const [saving, setSaving] = useState(false)
  const save = () => {
    if (!notebook) return
    setSaving(true)
    try {
      const pdf = renderDossierPdf(jsPDF, notebook.pages)
      pdf.setProperties({ title: t('Cuaderno de prácticas'), subject: t('Cuaderno de prácticas'), author: fullCover.student, creator: 'Grafcet Editor' })
      const bytes = attachFiles(
        new Uint8Array(pdf.output('arraybuffer')),
        practices.map((p, i) => practiceAttachment(withNotebookCover(p.project, fullCover), i, notebookTitle(p.title))),
      )
      downloadFile(bytes, fileName('pdf', 'cuaderno'), 'application/pdf')
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full rounded border border-slate-300 px-1.5 py-1 text-sm'
  const button = 'flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100'
  const preparing = practices.length > 0 && !ready
  const doneCount = practices.filter((p) => grafcets[p.id] && prepared[p.id]).length

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="notebook-title"
      className="m-auto h-[min(92vh,60rem)] w-[min(80rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      {pending && <OffscreenGrafcet key={pending.id} project={pending.project} onDone={onGrafcet} />}
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="notebook-title" className="flex items-center gap-2 text-base font-semibold">
            <BookCopy size={18} /> {t('Entregar varias prácticas')}
          </h2>
          <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <aside className="w-96 shrink-0 space-y-4 overflow-y-auto border-r border-slate-200 p-4 text-sm" aria-label={t('Prácticas del cuaderno')}>
            <p className="text-xs text-slate-600">{t('Junta tus prácticas en un solo PDF para entregarlo: cada una sale como su dossier y va dentro del PDF, para que se pueda corregir.')}</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={addCurrent} className={button}>
                <SquarePen size={14} /> {t('El proyecto abierto')}
              </button>
              <button type="button" onClick={() => fileRef.current.click()} className={button}>
                <FilePlus2 size={14} /> {t('Archivos…')}
              </button>
              <button type="button" onClick={() => setRecentOpen((v) => !v)} disabled={!recent.length} aria-expanded={recentOpen} className={`${button} disabled:opacity-40`}>
                <History size={14} /> {t('Trabajos anteriores')}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".json,.pdf,application/json,application/pdf"
                className="hidden"
                aria-label={t('Archivos de las prácticas')}
                onChange={(e) => {
                  addFiles([...e.target.files])
                  e.target.value = ''
                }}
              />
            </div>
            {recentOpen && (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-1.5" aria-label={t('Trabajos anteriores')}>
                {recent.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => add([{ project: r.project, file: '' }])} className="w-full rounded px-1.5 py-1 text-left text-xs hover:bg-slate-100">
                      <span className="font-medium">{practiceTitleOf(r.project)}</span>
                      <span className="block text-slate-500">{`${new Date(r.savedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${r.summary}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {notice && <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{notice}</p>}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('Prácticas ({n})', { n: practices.length })}</span>
                <button type="button" onClick={() => setPractices((list) => sortByNumber(list, (p) => p.title))} disabled={practices.length < 2} className={`${button} disabled:opacity-40`} title={t('Ordenar por el número de práctica de su título')}>
                  <ListOrdered size={14} /> {t('Ordenar por número')}
                </button>
              </div>
              {!practices.length ? (
                <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">{t('Añade las prácticas que quieras entregar.')}</p>
              ) : (
                <ol className="space-y-1" aria-label={t('Orden de las prácticas')}>
                  {practices.map((p, i) => (
                    <li
                      key={p.id}
                      draggable
                      onDragStart={() => setDragged(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dropOn(i)}
                      className={`flex items-center gap-1 rounded-md border px-1.5 py-1 ${dragged === i ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}
                    >
                      <GripVertical size={14} className="shrink-0 cursor-grab text-slate-400" aria-hidden="true" />
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-500">{i + 1}.</span>
                      <input
                        value={p.title}
                        onChange={(e) => setPractices((list) => list.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)))}
                        aria-label={t('Título de la práctica {n}', { n: i + 1 })}
                        className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-sm hover:border-slate-300 focus:border-blue-500 focus:outline-none"
                      />
                      {!(grafcets[p.id] && prepared[p.id]) && <Loader2 size={13} className="shrink-0 animate-spin text-slate-400" aria-label={t('Preparando')} />}
                      <button type="button" disabled={i === 0} onClick={() => move(i, -1)} title={t('Subir')} aria-label={t('Subir')} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" disabled={i === practices.length - 1} onClick={() => move(i, 1)} title={t('Bajar')} aria-label={t('Bajar')} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" onClick={() => remove(p.id)} title={t('Quitar')} aria-label={t('Quitar la práctica {n}', { n: i + 1 })} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('Portada')}</legend>
              {COVER_FIELDS.map((f) => (
                <label key={f.id} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-slate-500">{t(f.label)}</span>
                  <input value={coverValue(f.id)} onChange={(e) => setCover((c) => ({ ...c, [f.id]: e.target.value }))} placeholder={f.id === 'date' ? today : ''} className={field} />
                </label>
              ))}
            </fieldset>
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
                {t('Juntar las secciones (menos páginas)')}
              </label>
              <p className="text-[11px] text-slate-500">{t('Cada práctica sale con las secciones y los textos de su dossier (Exportar > Dossier de la práctica, con ella abierta).')}</p>
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col bg-slate-100">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-1.5 text-xs">
              <span className="text-slate-600">
                {notebook ? t('{n} páginas', { n: notebook.pages.length }) : preparing ? t('Preparando la práctica {n} de {total}…', { n: Math.min(doneCount + 1, practices.length), total: practices.length }) : ''}
              </span>
              <span className="ml-auto" />
              <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} title={t('Alejar')} className="rounded p-1 hover:bg-slate-100">
                <Minus size={13} />
              </button>
              <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)} %</span>
              <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} title={t('Acercar')} className="rounded p-1 hover:bg-slate-100">
                <Plus size={13} />
              </button>
            </div>
            <div className="paper min-h-0 flex-1 overflow-auto p-4" aria-label={t('Vista previa del cuaderno')}>
              {!practices.length ? null : !notebook ? (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 size={16} className="animate-spin" /> {t('Preparando el grafcet, el ladder y la planta de cada práctica…')}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  {notebook.pages.map((p, i) => (
                    <DossierPreview key={i} page={p} width={Math.round(p.w * 3 * zoom)} label={t('Página {n} de {total}', { n: i + 1, total: notebook.pages.length })} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={() => dialogRef.current.close()} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
            {t('Cerrar')}
          </button>
          <button type="button" onClick={save} disabled={!notebook || saving} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
            <Download size={15} /> {t('Guardar PDF')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
