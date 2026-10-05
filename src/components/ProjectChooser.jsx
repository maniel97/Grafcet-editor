import { useEffect, useRef } from 'react'
import { BookOpen, GraduationCap, X } from 'lucide-react'
import { t } from '../lib/i18n'
import { isStudent } from '../lib/exercise'

// Un archivo con varios proyectos (un guion de prácticas en PDF): elegir cuál se abre.
// items: [{ file, project }] (lib/projectFile.js loadProjects).
export default function ProjectChooser({ fileName, items, onPick, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="chooser-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="chooser-title" className="text-base font-semibold">
          {t('¿Qué práctica abres?')}
        </h2>
        <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} aria-label={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[70vh] space-y-2 overflow-y-auto px-5 py-4 text-sm">
        <p className="text-slate-600">{t('«{archivo}» trae {n} archivos dentro.', { archivo: fileName, n: items.length })}</p>
        <ul className="space-y-1.5">
          {items.map((item) => {
            const student = isStudent(item.project.plc)
            const Icon = student ? GraduationCap : BookOpen
            return (
              <li key={item.file}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(item)
                    dialogRef.current.close()
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-2.5 text-left hover:border-blue-400 hover:bg-blue-50"
                >
                  <Icon size={18} className={student ? 'shrink-0 text-blue-700' : 'shrink-0 text-green-700'} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.project.plc?.exercise?.title || item.project.name || item.file}</span>
                    <span className="block text-xs text-slate-500">
                      {student ? t('Ejercicio para hacer') : t('Proyecto resuelto')} · <span className="font-mono">{item.file}</span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </dialog>
  )
}
