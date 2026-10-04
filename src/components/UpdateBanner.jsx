import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { onUpdateAvailable } from '../lib/pwa'
import { t } from '../lib/i18n'

// Aviso de versión nueva (lib/pwa.js). No recarga solo: podrías estar editando.
export default function UpdateBanner() {
  const [activate, setActivate] = useState(null)
  const [hidden, setHidden] = useState(false)
  useEffect(() => onUpdateAvailable((fn) => setActivate(() => fn)), [])
  if (!activate || hidden) return null
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-xl">
      {t('Hay una versión nueva del editor.')}
      <button type="button" onClick={activate} className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 font-medium hover:bg-blue-700">
        <RefreshCw size={14} />{' '}{t('Recargar')}
      </button>
      <span className="text-xs text-slate-300">{t('(tu trabajo está guardado)')}</span>
      <button type="button" onClick={() => setHidden(true)} aria-label={t('Más tarde')} title={t('Más tarde')} className="rounded p-0.5 text-slate-300 hover:text-white">
        <X size={14} />
      </button>
    </div>
  )
}
