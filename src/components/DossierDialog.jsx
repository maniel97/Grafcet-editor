import { useEffect, useMemo, useRef, useState } from 'react'
import { BookText, Download, Loader2, Minus, Plus, X } from 'lucide-react'
import DossierPreview from './DossierPreview'
import { COVER_FIELDS, DOSSIER_SECTIONS, LADDER_LISTINGS, buildDossier, dossierOptions } from '../lib/dossier'
import { dossierData, dossierFigures } from '../lib/dossierContent'
import { loadPdf, makeMeasure, renderDossierPdf } from '../lib/dossierPdf'
import { fileName } from '../lib/fileNames'
import { t } from '../lib/i18n'

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5]

// Dossier de la práctica (Exportar > Dossier…): opciones a la izquierda y vista previa paginada a
// la derecha. Las opciones y los datos de la portada se guardan en el proyecto (plc.dossier).
// source: la del lienzo (hooks/useImageExport.js) para capturar el grafcet, hoja a hoja.
export default function DossierDialog({ nodes, edges, plc, issues, projectName, source, onChange, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const options = useMemo(() => dossierOptions(plc.dossier), [plc.dossier])
  const set = (patch) => onChange({ ...options, ...patch })
  const setSection = (id, on) => set({ sections: { ...options.sections, [id]: on } })
  const setCover = (id, value) => set({ cover: { ...options.cover, [id]: value } })
  const today = new Date().toLocaleDateString('es-ES')
  const scenarios = plc.scenarios ?? []
  const hasPlant = Boolean(plc.scene?.elements?.length)

  // Medida del texto (jsPDF) y figuras: se preparan al abrir (y el cronograma, al cambiar de escenario).
  const [jsPDF, setJsPDF] = useState(null)
  const [grafcet, setGrafcet] = useState(null)
  const [figures, setFigures] = useState(null)
  const [saving, setSaving] = useState(false)
  const [zoom, setZoom] = useState(0.75)
  const data = useMemo(() => dossierData({ nodes, edges, plc, issues, options }), [nodes, edges, plc, issues, options])
  useEffect(() => {
    let alive = true
    loadPdf().then((js) => alive && setJsPDF(() => js))
    ;(async () => {
      const shots = source.captureAll ? await source.captureAll() : [await source.capture()]
      if (alive) setGrafcet(shots.filter(Boolean).map((s) => ({ ...s, name: s.sheetName })))
    })()
    return () => {
      alive = false
    }
  }, [source])
  const model = data.model
  useEffect(() => {
    let alive = true
    dossierFigures({ nodes, edges, plc, scenarioId: options.scenario, model }).then((f) => alive && setFigures(f))
    return () => {
      alive = false
    }
    // Solo al abrir y al cambiar de escenario: el proyecto no cambia con el diálogo abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.scenario])

  const ready = jsPDF && grafcet && figures
  const measure = useMemo(() => (jsPDF ? makeMeasure(jsPDF) : null), [jsPDF])
  const dossier = useMemo(() => {
    if (!ready) return null
    const content = {
      title: projectName.trim() || t('Práctica de automatización'),
      today,
      cover: { ...options.cover, student: options.cover.student ?? plc.titleBlock?.author ?? '' },
      statement: options.statement,
      figures: { grafcet, ladder: figures.ladder, plant: figures.plant, chronogram: figures.chronogram },
      tables: data.tables,
      issues: data.issues,
      listing: data.listing,
      notes: data.notes,
    }
    return buildDossier(content, options, measure)
  }, [ready, projectName, today, options, plc.titleBlock, grafcet, figures, data, measure])

  const save = async () => {
    if (!dossier) return
    setSaving(true)
    try {
      renderDossierPdf(jsPDF, dossier.pages).save(fileName('pdf', 'dossier'))
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full rounded border border-slate-300 px-1.5 py-1 text-sm'
  const disabledReason = { plant: !hasPlant && t('el proyecto no tiene planta'), chronogram: !scenarios.length && t('graba un escenario en la simulación') }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="dossier-title"
      className="m-auto h-[min(92vh,60rem)] w-[min(78rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="dossier-title" className="flex items-center gap-2 text-base font-semibold">
            <BookText size={18} />{' '}{t('Dossier de la práctica')}
          </h2>
          <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <aside className="w-80 shrink-0 space-y-4 overflow-y-auto border-r border-slate-200 p-4 text-sm" aria-label={t('Opciones del dossier')}>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t('Tamaño de página')}</span>
              <select value={options.page} onChange={(e) => set({ page: e.target.value })} className={field}>
                <option value="a4">A4</option>
                <option value="a3">A3</option>
              </select>
            </label>
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('Portada')}</legend>
              {COVER_FIELDS.map((f) => (
                <label key={f.id} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-slate-500">{t(f.label)}</span>
                  <input
                    value={options.cover[f.id] ?? (f.id === 'student' ? (plc.titleBlock?.author ?? '') : '')}
                    onChange={(e) => setCover(f.id, e.target.value)}
                    placeholder={f.id === 'date' ? today : ''}
                    className={field}
                  />
                </label>
              ))}
            </fieldset>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('Enunciado / memoria')}</span>
              <textarea
                value={options.statement}
                onChange={(e) => set({ statement: e.target.value })}
                rows={7}
                placeholder={t('# Objetivo\nDescribe la práctica…\n- Punto 1\n- Punto 2')}
                className={`${field} font-mono text-xs`}
              />
              <span className="text-[11px] text-slate-500">{t('Formato como en las notas: # título, - listas, **negrita**, `variable`.')}</span>
            </label>
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('Secciones')}</legend>
              {DOSSIER_SECTIONS.map((s) => (
                <div key={s.id}>
                  <label className={`flex items-center gap-2 ${disabledReason[s.id] ? 'text-slate-400' : ''}`} title={disabledReason[s.id] || undefined}>
                    <input type="checkbox" checked={Boolean(options.sections[s.id]) && !disabledReason[s.id]} disabled={Boolean(disabledReason[s.id])} onChange={(e) => setSection(s.id, e.target.checked)} />
                    {t(s.label)}
                    {disabledReason[s.id] && <span className="text-[11px]">({disabledReason[s.id]})</span>}
                  </label>
                  {s.id === 'ladder' && options.sections.ladder && (
                    <select aria-label={t('Listado del ladder')} value={options.ladderListing} onChange={(e) => set({ ladderListing: e.target.value })} className={`${field} ml-6 mt-1 w-[calc(100%-1.5rem)] text-xs`}>
                      {LADDER_LISTINGS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {t(l.label)}
                        </option>
                      ))}
                    </select>
                  )}
                  {s.id === 'chronogram' && options.sections.chronogram && scenarios.length > 0 && (
                    <select aria-label={t('Escenario del cronograma')} value={options.scenario || scenarios[0].id} onChange={(e) => set({ scenario: e.target.value })} className={`${field} ml-6 mt-1 w-[calc(100%-1.5rem)] text-xs`}>
                      {scenarios.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </fieldset>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col bg-slate-100">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-1.5 text-xs">
              <span className="text-slate-600">{dossier ? t('{n} páginas', { n: dossier.pages.length }) : t('Preparando…')}</span>
              <span className="ml-auto" />
              <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} title={t('Alejar')} className="rounded p-1 hover:bg-slate-100">
                <Minus size={13} />
              </button>
              <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)} %</span>
              <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} title={t('Acercar')} className="rounded p-1 hover:bg-slate-100">
                <Plus size={13} />
              </button>
            </div>
            <div className="paper min-h-0 flex-1 overflow-auto p-4" aria-label={t('Vista previa del dossier')}>
              {!dossier ? (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 size={16} className="animate-spin" />{' '}{t('Preparando el grafcet, el ladder y la planta…')}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  {dossier.pages.map((p, i) => (
                    <DossierPreview key={i} page={p} width={Math.round(p.w * 3 * zoom)} label={t('Página {n} de {total}', { n: i + 1, total: dossier.pages.length })} />
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
          <button
            type="button"
            onClick={save}
            disabled={!dossier || saving}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Download size={15} />{' '}{t('Guardar PDF')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
