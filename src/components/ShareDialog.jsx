import { useEffect, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import { AlertTriangle, Check, Copy, Download, Link2, X } from 'lucide-react'
import { LONG_LINK, QR_LIMIT, isLocalOnly, shareLink } from '../lib/share'
import { t } from '../lib/i18n'

// Código QR del enlace (SVG); null si no cabe.
function QrCode({ text }) {
  const modules = useMemo(() => {
    if (text.length > QR_LIMIT) return null
    try {
      // Corrección L: menos densidad (se lee mejor desde una pantalla o un proyector).
      const qr = qrcode(0, 'L')
      qr.addData(text)
      qr.make()
      const n = qr.getModuleCount()
      return { n, dark: (r, c) => qr.isDark(r, c) }
    } catch {
      return null
    }
  }, [text])
  if (!modules) return <p className="text-xs text-slate-500">{t('El enlace es demasiado largo para un código QR.')}</p>
  const { n, dark } = modules
  const cells = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) cells.push(`M${c + 4} ${r + 4}h1v1h-1z`)
  return (
    <svg viewBox={`0 0 ${n + 8} ${n + 8}`} width="280" height="280" role="img" aria-label={t('Código QR del enlace')} className="paper rounded bg-white">
      <rect width={n + 8} height={n + 8} fill="white" />
      <path d={cells.join('')} fill="black" />
    </svg>
  )
}

// Compartir por enlace (lib/share.js): el proyecto va dentro del enlace; también como código QR.
export default function ShareDialog({ project, onDownload, onClose }) {
  const dialogRef = useRef(null)
  const [link, setLink] = useState(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
    let alive = true
    shareLink(project).then((l) => alive && setLink(l))
    return () => {
      alive = false
    }
  }, [project])
  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const local = isLocalOnly()

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="share-title"
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="share-title" className="flex items-center gap-2 text-base font-semibold">
          <Link2 size={18} />{' '}{t('Compartir por enlace')}
        </h2>
        <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div className="space-y-3 px-5 py-4 text-sm">
        <p className="text-slate-600">
          {t('El proyecto completo (grafcet, tabla, planta, escenarios y notas) va')}{' '}<strong>{t('dentro del enlace')}</strong>{t(', comprimido: no se sube a ningún servidor. Quien lo abra podrá cargarlo en su editor.')}
        </p>
        {local && (
          <p className="flex items-start gap-1.5 rounded bg-amber-50 p-2 text-amber-800" role="note">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {t('Estás usando el editor en este equipo (servidor local o archivo): el enlace solo se abrirá aquí. Para compartirlo con otros, el editor tiene que estar publicado en una web.')}
          </p>
        )}
        {!link ? (
          <p className="text-slate-500">{t('Preparando el enlace…')}</p>
        ) : (
          <>
            <div className="flex gap-2">
              <input readOnly value={link} aria-label={t('Enlace para compartir')} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 font-mono text-xs" />
              <button type="button" onClick={copy} className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t('Copiado') : t('Copiar')}
              </button>
            </div>
            <p className="text-xs text-slate-500" aria-label={t('Longitud del enlace')}>
              {link.length.toLocaleString('es-ES')} caracteres
            </p>
            {link.length > LONG_LINK && (
              <p className="flex items-start gap-1.5 text-amber-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {t('Es un enlace largo: algunas aplicaciones de mensajería lo recortan. Si no llega entero, envía el archivo .json.')}
              </p>
            )}
            <div className="flex items-center gap-4">
              <QrCode text={link} />
              <p className="text-xs text-slate-500">{t('Escanéalo con el móvil o proyéctalo en clase para abrir el proyecto.')}</p>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-between gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={onDownload} className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
          <Download size={14} />{' '}{t('Descargar .json')}
        </button>
        <button type="button" onClick={() => dialogRef.current.close()} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
          {t('Cerrar')}
        </button>
      </div>
    </dialog>
  )
}
