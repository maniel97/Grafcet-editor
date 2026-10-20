// Avisos flotantes del editor, arriba en el centro: un error (al abrir un archivo…), un proyecto que
// llega en un enlace compartido y la oferta de la visita guiada la primera vez.
import { AlertTriangle, Compass, Info, X } from 'lucide-react'
import { t } from '../lib/i18n'

// Error que se queda hasta cerrarlo (en vez de un alert() del navegador).
export function ErrorNotice({ message, onClose }) {
  if (!message) return null
  return (
    <div role="alert" className="fixed left-1/2 top-16 z-50 flex max-w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 shadow-xl">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onClose} title={t('Cerrar el aviso')} aria-label={t('Cerrar el aviso')} className="rounded p-0.5 hover:bg-red-100">
        <X size={14} />
      </button>
    </div>
  )
}

// Un .sim de PC_SIMU recién importado (lib/pcsimuImport.js): lo que no tiene equivalente en el editor y por qué
// no se ha hecho todavía.
export function ImportNotice({ report, onClose }) {
  if (!report) return null
  const { warnings = [], skipped = [] } = report
  return (
    <div role="status" aria-label={t('Importado de PC_SIMU')} className="fixed left-1/2 top-16 z-50 flex max-w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-xl">
      <Info size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <p className="font-semibold">{t('Importado de PC_SIMU')}</p>
        {skipped.length > 0 && (
          <>
            <p>{t('Se ha pasado todo lo que tiene equivalente en el editor. Esto no se ha importado:')}</p>
            <ul className="list-disc pl-5">
              {skipped.map(({ what, count }) => (
                <li key={what}>
                  {count > 1 ? `${count} × ` : ''}
                  {what}
                </li>
              ))}
            </ul>
            <p>
              {t('Se ha pospuesto a propósito, para evitar que el alcance crezca sin control con elementos poco usados. Si hay suficiente demanda, se implementará por completo.')}
            </p>
          </>
        )}
        {warnings.length > 0 && (
          <ul className="list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <p className="text-amber-800">{t('El programa no va en el .sim: escribe el grafcet o carga su .awl en Simular > Autómata S7-200.')}</p>
      </div>
      <button type="button" onClick={onClose} title={t('Cerrar el aviso')} aria-label={t('Cerrar el aviso')} className="rounded p-0.5 hover:bg-amber-100">
        <X size={14} />
      </button>
    </div>
  )
}

// Proyecto compartido (incoming de hooks/useSharedProject): abrirlo o descartarlo; si el enlace
// está dañado, el error.
export function SharedProjectBanner({ incoming, onOpen, onClose }) {
  if (!incoming) return null
  return (
    <div role="alertdialog" aria-label={t('Proyecto compartido')} className="fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-xl">
      {incoming.error ? (
        <span>{incoming.error}</span>
      ) : (
        <>
          <span>
            {t('Proyecto compartido:')}{' '}<strong>«{incoming.project.name || t('sin nombre')}»</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              onOpen(incoming.project)
              onClose()
            }}
            className="rounded-md bg-blue-600 px-2.5 py-1 font-medium hover:bg-blue-700"
          >
            {t('Abrir')}
          </button>
          <span className="text-xs text-slate-300">{t('(lo de ahora queda en «Trabajos anteriores»)')}</span>
        </>
      )}
      <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-slate-300 hover:text-white">
        {incoming.error ? t('Cerrar') : t('Descartar')}
      </button>
    </div>
  )
}

// La primera vez: ofrecer la visita guiada.
export function FirstVisitOffer({ onStart, onDismiss }) {
  return (
    <div role="status" className="fixed top-16 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
      <Compass size={18} className="shrink-0 text-blue-600" />
      <span>{t('¿Es la primera vez? Una visita guiada te enseña lo principal en un par de minutos.')}</span>
      <button type="button" onClick={onStart} className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700">
        {t('Empezar')}
      </button>
      <button type="button" onClick={onDismiss} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">
        {t('Ahora no')}
      </button>
    </div>
  )
}
