import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, FileText, X } from 'lucide-react'
import { DEFAULT_PDF_OPTIONS, ORIENTATIONS, PAGE_MARGIN, PAGE_OPTIONS, pdfLayout } from '../lib/pdfLayout'
import { savePdf } from '../lib/exportImage'

const STORAGE_KEY = 'grafcet-editor:pdf-options'
const PREVIEW = { width: 440, height: 440 } // área de la vista previa (px)

function readOptions() {
  try {
    return { ...DEFAULT_PDF_OPTIONS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }
  } catch {
    return DEFAULT_PDF_OPTIONS
  }
}

function Choice({ legend, name, value, options, onChange }) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">{legend}</legend>
      <div className="flex flex-col gap-0.5">
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// Exportación a PDF con elección de tamaño de página, orientación y pie, y vista previa exacta:
// la vista previa y el PDF usan la misma maquetación (lib/pdfLayout.js) y la misma imagen.
// `capture()` devuelve la imagen del diagrama a resolución de impresión (sin selección).
export default function PdfExportDialog({ capture, projectName, onClose }) {
  const dialogRef = useRef(null)
  const [image, setImage] = useState(undefined) // undefined: preparando; null: nada que exportar
  // Si el título del pie no se ha personalizado, se propone el nombre del proyecto.
  const [options, setOptions] = useState(() => {
    const stored = readOptions()
    return projectName?.trim() && stored.title === DEFAULT_PDF_OPTIONS.title ? { ...stored, title: projectName.trim() } : stored
  })
  const [saving, setSaving] = useState(false)
  const [today] = useState(() => new Date().toLocaleDateString('es-ES'))

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  useEffect(() => {
    let cancelled = false
    capture()
      .then((img) => !cancelled && setImage(img ?? null))
      .catch((err) => {
        if (cancelled) return
        alert(`No se pudo preparar la vista previa: ${err.message}`)
        setImage(null)
      })
    return () => {
      cancelled = true
    }
  }, [capture])

  const update = (patch) =>
    setOptions((o) => {
      const next = { ...o, ...patch }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Sin almacenamiento: las opciones duran solo esta vez.
      }
      return next
    })

  const layout = useMemo(() => (image ? pdfLayout(image, options) : null), [image, options])

  const save = async () => {
    setSaving(true)
    try {
      await savePdf(image, options)
      onClose()
    } catch (err) {
      alert(`No se pudo guardar el PDF: ${err.message}`)
      setSaving(false)
    }
  }

  // Escala de la vista previa: mm de la página -> px de pantalla.
  const k = layout ? Math.min(PREVIEW.width / layout.pageW, PREVIEW.height / layout.pageH) : 1
  const orientationLabel = layout?.orientation === 'landscape' ? 'apaisado' : 'vertical'

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="pdf-title"
      className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="pdf-title" className="text-base font-semibold">
          Exportar a PDF
        </h2>
        <button type="button" onClick={onClose} title="Cerrar (Esc)" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>

      <div className="flex max-h-[75vh] flex-col gap-5 overflow-y-auto px-5 py-4 md:flex-row">
        <div className="w-full space-y-4 md:w-52 md:shrink-0">
          <Choice legend="Tamaño de página" name="pdf-page" value={options.page} options={PAGE_OPTIONS} onChange={(page) => update({ page })} />
          <Choice
            legend="Orientación"
            name="pdf-orientation"
            value={options.orientation}
            options={ORIENTATIONS}
            onChange={(orientation) => update({ orientation })}
          />
          <fieldset className="space-y-1">
            <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">Pie de página</legend>
            <label className="flex items-center gap-2 px-1 text-sm">
              <input type="checkbox" checked={options.footer} onChange={(e) => update({ footer: e.target.checked })} />
              Título y fecha
            </label>
            {options.footer && (
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                value={options.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Título"
                aria-label="Título del pie de página"
              />
            )}
          </fieldset>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex items-center justify-center rounded-lg bg-slate-100 p-3" style={{ width: PREVIEW.width + 24, height: PREVIEW.height + 24 }}>
            {image === undefined && <p className="text-sm text-slate-500">Preparando la vista previa…</p>}
            {image === null && <p className="text-sm text-slate-500">No hay nada que exportar: el lienzo está vacío.</p>}
            {layout && (
              <div
                aria-label="Vista previa de la página"
                data-page={`${layout.page.id}-${layout.orientation}`}
                className="relative bg-white shadow-md"
                style={{ width: layout.pageW * k, height: layout.pageH * k }}
              >
                <img
                  src={image.dataUrl}
                  alt="Diagrama tal como quedará en el PDF"
                  className="absolute"
                  style={{ left: layout.x * k, top: layout.y * k, width: layout.w * k, height: layout.h * k }}
                />
                {/* Zona útil (márgenes), solo como guía; encima de la imagen para que se vea entera. */}
                <div
                  className="pointer-events-none absolute border border-dashed border-slate-200"
                  style={{ left: PAGE_MARGIN * k, top: PAGE_MARGIN * k, right: PAGE_MARGIN * k, bottom: PAGE_MARGIN * k }}
                />
                {options.footer && (
                  <span
                    className="absolute truncate text-slate-500"
                    style={{ left: PAGE_MARGIN * k, bottom: (PAGE_MARGIN / 2 - 1) * k, fontSize: Math.max(6, 2.9 * k), right: PAGE_MARGIN * k }}
                  >
                    {[options.title?.trim(), today].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            )}
          </div>
          {layout && (
            <p className="text-sm text-slate-600" aria-live="polite">
              {layout.page.label} {orientationLabel} · escala {Math.round(layout.scale * 100)} %
              {layout.scale === 1 && ' (tamaño real)'}
            </p>
          )}
          {layout?.small && (
            <p className="flex items-start gap-1 rounded bg-amber-50 p-2 text-xs text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              El diagrama queda muy reducido y puede leerse mal impreso. Prueba con una página mayor o con otra orientación.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!layout || saving}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <FileText size={16} /> {saving ? 'Guardando…' : 'Guardar PDF'}
        </button>
      </div>
    </dialog>
  )
}
