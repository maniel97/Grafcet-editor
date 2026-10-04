import { useEffect, useRef, useState } from 'react'
import { BookOpen, History, RotateCcw, Trash2, X } from 'lucide-react'
import { EXAMPLES, LEVELS } from '../lib/examples'
import { listRecent, removeRecent } from '../lib/recent'
import { t, N_ } from '../lib/i18n'

const TABS = [
  { id: 'examples', label: N_('Ejemplos'), icon: BookOpen },
  { id: 'recent', label: N_('Trabajos anteriores'), icon: History },
]

const when = (iso) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Abrir un ejemplo o recuperar un trabajo anterior. Lo que hay en el lienzo antes de abrir se
// guarda solo como trabajo anterior (y también se puede deshacer con Ctrl+Z).
export default function ProjectsDialog({ initialTab = 'examples', onOpenExample, onRestore, onClose }) {
  const dialogRef = useRef(null)
  const [tab, setTab] = useState(initialTab)
  const [recent, setRecent] = useState(() => listRecent())

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="projects-title"
      className="m-auto w-[min(44rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="projects-title" className="text-base font-semibold">
          {t('Abrir')}
        </h2>
        <button type="button" onClick={onClose} title={t('Cerrar (Esc)')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 px-5 pt-2" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-1.5 text-sm ${
              tab === x.id ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <x.icon size={15} /> {t(x.label)}
          </button>
        ))}
      </div>

      <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
        {tab === 'examples' ? (
          <div className="space-y-4">
            {LEVELS.filter((level) => EXAMPLES.some((ex) => ex.level === level.id)).map((level) => (
              <section key={level.id} aria-label={`Nivel ${level.id}: ${level.title}`}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Nivel {level.id} · {level.title}
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {EXAMPLES.filter((ex) => ex.level === level.id).map((ex) => (
                    <li key={ex.id}>
                      <button
                        type="button"
                        onClick={() => onOpenExample(ex)}
                        className="flex h-full w-full flex-col gap-1 rounded-lg border border-slate-200 p-3 text-left hover:border-blue-400 hover:bg-blue-50"
                      >
                        <span className="font-medium">{ex.title}</span>
                        <span className="text-sm text-slate-600">{ex.description}</span>
                        <span className="mt-auto flex flex-wrap gap-1 pt-1">
                          {ex.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {tag}
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">
              {t('Lo que había en el lienzo antes de abrir un archivo o un ejemplo, recuperar otro trabajo o limpiar. Se guarda solo en este navegador (los 8 más recientes).')}
            </p>
            {recent.length === 0 && <p className="py-6 text-center text-sm text-slate-400">{t('Todavía no hay trabajos anteriores.')}</p>}
            <ul className="divide-y divide-slate-100">
              {recent.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {entry.project?.name ? `${entry.project.name} · ` : ''}
                      {entry.summary}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {when(entry.savedAt)} · {entry.reason}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestore(entry)}
                    className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100"
                  >
                    <RotateCcw size={14} />{' '}{t('Recuperar')}
                  </button>
                  <button
                    type="button"
                    title={t('Olvidar este trabajo')}
                    aria-label={t('Olvidar este trabajo')}
                    onClick={() => setRecent(removeRecent(entry.id))}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </dialog>
  )
}
