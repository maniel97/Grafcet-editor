import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { DEFAULT_PDF_OPTIONS, ORIENTATIONS, PAGE_MARGIN, PAGE_OPTIONS, exportLayout } from '../lib/pdfLayout'
import { savePdf } from '../lib/exportImage'

const STORAGE_KEY = 'grafcet-editor:pdf-options'
const PREVIEW = { width: 440, height: 440 } // área de la vista previa (px)
const PX_TO_MM = 25.4 / 96

const FORMATS = [
  { id: 'png', label: 'PNG', help: 'Imagen para documentos y webs' },
  { id: 'svg', label: 'SVG', help: 'Vectorial: se amplía sin perder calidad' },
  { id: 'pdf', label: 'PDF', help: 'Para imprimir: tamaño, orientación y páginas' },
]
const PNG_SCALES = [
  { id: 1, label: 'Normal (1×)' },
  { id: 2, label: 'Alta (2×)' },
  { id: 3, label: 'Impresión (3×)' },
]

function readOptions() {
  try {
    return { ...DEFAULT_PDF_OPTIONS, pngScale: 2, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }
  } catch {
    return { ...DEFAULT_PDF_OPTIONS, pngScale: 2 }
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

// Exportación con vista previa de cualquier dibujo (grafcet, ladder, cronograma) a PNG, SVG o
// PDF. `source` (hooks/useImageExport.js, lib/svgExport.js) da:
//   kind, title, capture() -> { dataUrl, width, height, scene?, blocks? }, save(format, options)
// La vista previa del PDF y el archivo usan la misma maquetación (lib/pdfLayout.js: exportLayout)
// y la misma captura, así que lo que se ve es lo que se guarda.
export default function ExportDialog({ source, initialFormat = 'pdf', fileName, onClose }) {
  const dialogRef = useRef(null)
  const [format, setFormat] = useState(initialFormat)
  const [image, setImage] = useState(undefined) // undefined: preparando; null: nada que exportar
  const [options, setOptions] = useState(readOptions)
  const [title, setTitle] = useState(source.title ?? DEFAULT_PDF_OPTIONS.title)
  const [pageIndex, setPageIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [today] = useState(() => new Date().toLocaleDateString('es-ES'))

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  useEffect(() => {
    let cancelled = false
    source
      .capture()
      .then((img) => !cancelled && setImage(img ?? null))
      .catch((err) => {
        if (cancelled) return
        alert(`No se pudo preparar la vista previa: ${err.message}`)
        setImage(null)
      })
    return () => {
      cancelled = true
    }
  }, [source])

  const update = (patch) => {
    setPageIndex(0)
    setOptions((o) => {
      const next = { ...o, ...patch }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Sin almacenamiento: las opciones duran solo esta vez.
      }
      return next
    })
  }

  const pdfOptions = { ...options, title }
  const layout = useMemo(() => (image ? exportLayout(image, { ...options, title }) : null), [image, options, title])
  const page = layout?.pages[Math.min(pageIndex, layout.pages.length - 1)]

  const save = async () => {
    setSaving(true)
    try {
      if (format === 'pdf') await savePdf(image, pdfOptions, fileName('pdf'))
      else await source.save(format, options)
      onClose()
    } catch (err) {
      alert(`No se pudo exportar: ${err.message}`)
      setSaving(false)
    }
  }

  // Escala de la vista previa de la página: mm -> px de pantalla.
  const k = layout ? Math.min(PREVIEW.width / layout.pageW, PREVIEW.height / layout.pageH) : 1
  const orientationLabel = layout?.orientation === 'landscape' ? 'apaisado' : 'vertical'
  const pngSize = image && `${Math.round(image.width * options.pngScale)} × ${Math.round(image.height * options.pngScale)} px`

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="export-title"
      className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 id="export-title" className="text-base font-semibold">
          Exportar
        </h2>
        <div className="flex rounded-md border border-slate-300 p-0.5 text-sm" role="radiogroup" aria-label="Formato">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={format === f.id}
              title={f.help}
              onClick={() => setFormat(f.id)}
              className={`rounded px-3 py-1 ${format === f.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} title="Cerrar (Esc)" className="ml-auto rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>

      <div className="flex max-h-[75vh] flex-col gap-5 overflow-y-auto px-5 py-4 md:flex-row">
        <div className="w-full space-y-4 md:w-52 md:shrink-0">
          {format === 'png' && (
            <Choice legend="Resolución" name="png-scale" value={options.pngScale} options={PNG_SCALES} onChange={(pngScale) => update({ pngScale })} />
          )}
          {format === 'svg' && (
            <p className="text-sm text-slate-600">
              Dibujo vectorial: se puede ampliar sin perder calidad y editar en programas como Inkscape o Illustrator.
            </p>
          )}
          {format === 'pdf' && (
            <>
              <Choice legend="Tamaño de página" name="pdf-page" value={options.page} options={PAGE_OPTIONS} onChange={(p) => update({ page: p })} />
              <Choice
                legend="Orientación"
                name="pdf-orientation"
                value={options.orientation}
                options={ORIENTATIONS}
                onChange={(orientation) => update({ orientation })}
              />
              <fieldset className="space-y-1">
                <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">Calidad</legend>
                <label className="flex items-start gap-2 px-1 text-sm">
                  <input type="checkbox" className="mt-1" checked={options.vector !== false} onChange={(e) => update({ vector: e.target.checked })} />
                  <span>
                    Vectorial
                    <span className="block text-xs text-slate-500">
                      Nítido a cualquier zoom y con el texto seleccionable. Sin marcar: imagen a alta resolución.
                    </span>
                  </span>
                </label>
              </fieldset>
              <fieldset className="space-y-1">
                <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">Pie de página</legend>
                <label className="flex items-center gap-2 px-1 text-sm">
                  <input type="checkbox" checked={options.footer} onChange={(e) => update({ footer: e.target.checked })} />
                  Título y fecha
                </label>
                {options.footer && (
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título"
                    aria-label="Título del pie de página"
                  />
                )}
              </fieldset>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div
            className="flex items-center justify-center overflow-auto rounded-lg bg-slate-100 p-3"
            style={{ width: PREVIEW.width + 24, height: PREVIEW.height + 24 }}
          >
            {image === undefined && <p className="text-sm text-slate-500">Preparando la vista previa…</p>}
            {image === null && <p className="text-sm text-slate-500">No hay nada que exportar.</p>}
            {image && format !== 'pdf' && (
              <img
                src={image.dataUrl}
                alt="Dibujo tal como se exportará"
                aria-label="Vista previa de la imagen"
                className="m-auto max-w-full bg-white shadow-md"
                style={{ maxHeight: image.height > image.width * 2 ? 'none' : '100%' }}
              />
            )}
            {layout && page && format === 'pdf' && (
              <div
                aria-label="Vista previa de la página"
                data-page={`${layout.page.id}-${layout.orientation}`}
                className="relative shrink-0 bg-white shadow-md"
                style={{ width: layout.pageW * k, height: layout.pageH * k }}
              >
                {/* Franja del dibujo que va en esta página. */}
                <div className="absolute overflow-hidden" style={{ left: layout.x * k, top: layout.y * k, width: layout.w * k, height: page.h * k }}>
                  <img
                    src={image.dataUrl}
                    alt="Diagrama tal como quedará en el PDF"
                    className="absolute left-0 max-w-none"
                    style={{ top: -page.top * layout.scale * PX_TO_MM * k, width: layout.w * k }}
                  />
                </div>
                {/* Zona útil (márgenes), solo como guía. */}
                <div
                  className="pointer-events-none absolute border border-dashed border-slate-200"
                  style={{ left: PAGE_MARGIN * k, top: PAGE_MARGIN * k, right: PAGE_MARGIN * k, bottom: PAGE_MARGIN * k }}
                />
                {options.footer && (
                  <span
                    className="absolute truncate text-slate-500"
                    style={{ left: PAGE_MARGIN * k, bottom: (PAGE_MARGIN / 2 - 1) * k, fontSize: Math.max(6, 2.9 * k), right: PAGE_MARGIN * k }}
                  >
                    {[title.trim(), today, layout.pages.length > 1 ? `página ${pageIndex + 1} de ${layout.pages.length}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>
            )}
          </div>

          {format === 'pdf' && layout && layout.pages.length > 1 && (
            <div className="flex items-center gap-2 text-sm" aria-label="Páginas">
              <button
                type="button"
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                disabled={pageIndex === 0}
                aria-label="Página anterior"
                className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span aria-live="polite">
                Página {pageIndex + 1} de {layout.pages.length}
              </span>
              <button
                type="button"
                onClick={() => setPageIndex((i) => Math.min(layout.pages.length - 1, i + 1))}
                disabled={pageIndex >= layout.pages.length - 1}
                aria-label="Página siguiente"
                className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <p className="text-sm text-slate-600" aria-live="polite">
            {format === 'png' && pngSize}
            {format === 'svg' && image && `Vectorial · ${Math.round(image.width)} × ${Math.round(image.height)} px`}
            {format === 'pdf' && layout && (
              <>
                {layout.page.label} {orientationLabel} · escala {Math.round(layout.scale * 100)} %{layout.scale === 1 && ' (tamaño real)'}
                {layout.pages.length > 1 && ` · ${layout.pages.length} páginas`}
              </>
            )}
          </p>
          {format === 'pdf' && layout?.small && (
            <p className="flex items-start gap-1 rounded bg-amber-50 p-2 text-xs text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              El dibujo queda muy reducido y puede leerse mal impreso. Prueba con una página mayor o con otra orientación.
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
          disabled={!image || saving}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Download size={16} /> {saving ? 'Guardando…' : `Guardar ${format.toUpperCase()}`}
        </button>
      </div>
    </dialog>
  )
}
