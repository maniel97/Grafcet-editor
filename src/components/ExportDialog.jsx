import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Maximize2, Minus, Plus, X } from 'lucide-react'
import { DEFAULT_PDF_OPTIONS, ORIENTATIONS, PAGE_MARGIN, PAGE_OPTIONS, exportLayout } from '../lib/pdfLayout'
import { savePdf } from '../lib/exportImage'
import { TITLE_BLOCK_FIELDS, titleBlockCells, titleBlockOrigin, titleBlockValues } from '../lib/titleBlock'

const STORAGE_KEY = 'grafcet-editor:pdf-options'
const PREVIEW = { width: 440, height: 440 } // área de la vista previa (px)
const PX_TO_MM = 25.4 / 96
// Zoom de la vista previa (1 = ajustada al recuadro).
const ZOOMS = [1, 1.5, 2, 3, 4, 6]

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
  let stored = {}
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    // Sin almacenamiento o datos dañados: valores por defecto.
  }
  const options = { ...DEFAULT_PDF_OPTIONS, pngScale: 2, ...stored }
  // Un tamaño que ya no existe (A5 de versiones anteriores) pasa a A4.
  if (!PAGE_OPTIONS.some((p) => p.id === options.page)) options.page = 'a4'
  return options
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
export default function ExportDialog({ source, initialFormat = 'pdf', fileName, titleBlock = {}, onTitleBlockChange, projectName = '', onClose }) {
  const dialogRef = useRef(null)
  const [format, setFormat] = useState(initialFormat)
  const [image, setImage] = useState(undefined) // undefined: preparando; null: nada que exportar
  const [options, setOptions] = useState(readOptions)
  const [title, setTitle] = useState(source.title ?? DEFAULT_PDF_OPTIONS.title)
  const [pageIndex, setPageIndex] = useState(0)
  const [zoom, setZoomValue] = useState(1)
  const previewRef = useRef(null)
  const keepCenter = useRef(null)
  // Cambia el zoom conservando el punto que se está mirando (el centro del recuadro).
  const setZoom = (next) => {
    const el = previewRef.current
    if (el) {
      keepCenter.current = {
        x: (el.scrollLeft + el.clientWidth / 2) / Math.max(1, el.scrollWidth),
        y: (el.scrollTop + el.clientHeight / 2) / Math.max(1, el.scrollHeight),
      }
    }
    setZoomValue(next)
  }
  const stepZoom = (dir) => {
    const next = dir > 0 ? ZOOMS.find((z) => z > zoom + 0.01) : [...ZOOMS].reverse().find((z) => z < zoom - 0.01)
    if (next) setZoom(next)
  }
  useLayoutEffect(() => {
    const el = previewRef.current
    const c = keepCenter.current
    if (!el || !c) return
    el.scrollLeft = c.x * el.scrollWidth - el.clientWidth / 2
    el.scrollTop = c.y * el.scrollHeight - el.clientHeight / 2
    keepCenter.current = null
  }, [zoom])
  // Ctrl + rueda sobre la vista previa: zoom (no el de toda la página).
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      stepZoom(e.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })
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

  const pdfOptions = { ...options, title, titleBlockData: titleBlock, projectName }
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
  // ×zoom: con zoom la vista previa se redibuja a escala (nítida) y se recorre con las barras.
  const k = layout ? Math.min(PREVIEW.width / layout.pageW, PREVIEW.height / layout.pageH) * zoom : 1
  // Imagen (PNG/SVG): ajustada al ancho (y al alto si no es muy alargada).
  const imageFit = image ? Math.min(PREVIEW.width / image.width, image.height > image.width * 2 ? Infinity : PREVIEW.height / image.height) : 1
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
              onClick={() => {
                setFormat(f.id)
                setZoomValue(1)
              }}
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
                <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">Cajetín</legend>
                <label className="flex items-center gap-2 px-1 text-sm">
                  <input type="checkbox" checked={!!options.titleBlock} onChange={(e) => update({ titleBlock: e.target.checked })} />
                  Incluir cajetín
                </label>
                {options.titleBlock && (
                  <div className="space-y-1">
                    {TITLE_BLOCK_FIELDS.map((f) => (
                      <input
                        key={f.id}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        value={titleBlock[f.id] ?? ''}
                        placeholder={f.id === 'project' ? projectName || f.label : f.id === 'date' ? today : f.label}
                        aria-label={`Cajetín: ${f.label}`}
                        title={f.label}
                        onChange={(e) => onTitleBlockChange?.({ ...titleBlock, [f.id]: e.target.value })}
                      />
                    ))}
                    <p className="text-xs text-slate-500">Se guarda con el proyecto. La hoja se numera sola.</p>
                  </div>
                )}
              </fieldset>
              {!options.titleBlock && (
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
              )}
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div
            ref={previewRef}
            className={`flex overflow-auto rounded-lg bg-slate-100 p-3 ${zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            style={{ width: PREVIEW.width + 24, height: PREVIEW.height + 24 }}
            onDoubleClick={() => setZoom(zoom > 1 ? 1 : 2.5)}
            title="Doble clic o Ctrl + rueda para ampliar"
          >
            {image === undefined && <p className="m-auto text-sm text-slate-500">Preparando la vista previa…</p>}
            {image === null && <p className="m-auto text-sm text-slate-500">No hay nada que exportar.</p>}
            {image && format !== 'pdf' && (
              <img
                src={image.dataUrl}
                alt="Dibujo tal como se exportará"
                aria-label="Vista previa de la imagen"
                className="paper m-auto max-w-none shrink-0 bg-white shadow-md"
                style={{ width: image.width * imageFit * zoom }}
              />
            )}
            {layout && page && format === 'pdf' && (
              <div
                aria-label="Vista previa de la página"
                data-page={`${layout.page.id}-${layout.orientation}`}
                className="paper relative m-auto shrink-0 bg-white shadow-md"
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
                {options.titleBlock && (
                  <TitleBlockPreview
                    k={k}
                    origin={titleBlockOrigin(layout.pageW, layout.pageH, PAGE_MARGIN)}
                    cells={titleBlockCells(titleBlockValues(titleBlock, { projectName, today, page: pageIndex + 1, pages: layout.pages.length }))}
                  />
                )}
                {options.footer && !options.titleBlock && (
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

          {image && (
            <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5 text-xs" role="group" aria-label="Zoom de la vista previa">
              <button type="button" onClick={() => stepZoom(-1)} disabled={zoom <= ZOOMS[0]} aria-label="Alejar la vista previa" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
                <Minus size={14} />
              </button>
              <button type="button" onClick={() => setZoom(1)} title="Ajustar" aria-label="Zoom de la vista previa: ajustar" className={`min-w-12 rounded px-1.5 py-1 tabular-nums hover:bg-slate-100 ${zoom === 1 ? 'font-semibold text-blue-700' : ''}`}>
                {Math.round(zoom * 100)} %
              </button>
              <button type="button" onClick={() => stepZoom(1)} disabled={zoom >= ZOOMS.at(-1)} aria-label="Ampliar la vista previa" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
                <Plus size={14} />
              </button>
              <button type="button" onClick={() => setZoom(1)} aria-label="Ajustar la vista previa" title="Ajustar" className="rounded p-1 hover:bg-slate-100">
                <Maximize2 size={14} />
              </button>
            </div>
          )}
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

// Cajetín en la vista previa: las mismas celdas (mm) que el PDF, escaladas a la página.
function TitleBlockPreview({ k, origin, cells }) {
  return (
    <div aria-label="Cajetín" className="absolute border-2 border-slate-900" style={{ left: origin.x * k, top: origin.y * k, width: 120 * k, height: 22 * k }}>
      {cells.map((c) => (
        <div
          key={c.label}
          className="absolute overflow-hidden border border-slate-700 bg-white leading-none"
          style={{ left: c.x * k, top: c.y * k, width: c.w * k, height: c.h * k, padding: 1.2 * k }}
        >
          <div className="text-slate-500" style={{ fontSize: Math.max(4, 1.9 * k) }}>
            {c.label}
          </div>
          <div className={`truncate text-slate-900 ${c.strong ? 'font-bold' : ''}`} style={{ fontSize: Math.max(5, (c.strong ? 3.2 : 2.8) * k), marginTop: 1.2 * k }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  )
}
