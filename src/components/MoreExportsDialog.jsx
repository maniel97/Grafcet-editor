import { useEffect, useRef } from 'react'
import { BookCopy, BookOpenCheck, FileCode, GraduationCap, LayoutGrid, Link2, MonitorPlay, X } from 'lucide-react'
import { t } from '../lib/i18n'

// Exportar > Más formatos…: el resto de formatos en tarjetas (el menú queda corto con los de
// diario: PNG, PDF y dossier). Al elegir uno, se abre su diálogo de exportación de siempre.
export default function MoreExportsDialog({ education = false, onPick, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const items = [
    { id: 'svg', label: t('SVG'), hint: t('Vectorial: se amplía sin perder calidad'), icon: FileCode },
    { id: 'notebook', label: t('Entregar varias prácticas'), hint: t('Varias prácticas en un solo documento, cada una como su dossier, con portada, índice y resumen'), icon: BookCopy },
    { id: 'pcsimu', label: t('Planta para PC_SIMU (.sim)'), hint: t('El panel de la planta (pulsadores y pilotos) y el programa .awl para el simulador PC_SIMU'), icon: MonitorPlay },
    { id: 'share', label: t('Compartir por enlace'), hint: t('Enlace y código QR para abrir el proyecto en otro equipo'), icon: Link2 },
    ...(education
      ? [
          { id: 'guide', label: t('Guion de prácticas'), hint: t('Varias prácticas en un solo documento, con normas generales y cada ejercicio dentro'), icon: BookOpenCheck },
          { id: 'exercise', label: t('Ejercicio para el alumnado'), hint: t('Preparar este proyecto como ejercicio con autocorrección (tu solución no se reparte)'), icon: GraduationCap },
        ]
      : []),
  ]
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="more-exports-title"
      className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="more-exports-title" className="flex items-center gap-2 text-base font-semibold">
          <LayoutGrid size={18} />{' '}
          {t('Más formatos')}
        </h2>
        <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-2">
        {items.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPick(f.id)}
            className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-left outline-none hover:border-blue-400 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <f.icon size={18} className="mt-0.5 shrink-0 text-slate-500" />
            <span>
              <span className="block font-medium text-slate-800">{f.label}</span>
              <span className="block text-xs text-slate-500">{f.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </dialog>
  )
}
