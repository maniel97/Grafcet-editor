import { useEffect, useMemo, useRef, useState } from 'react'
import { PenLine, X } from 'lucide-react'
import { t } from '../lib/i18n'
import { buildPlcModel } from '../lib/plcModel'
import { runScenarioWorld } from '../lib/sim/scenarioMotion'
import { makeWorld } from '../lib/sim/world'
import { STEP, eventsOf, paint, resize, seriesOf } from '../lib/sim/scenarioEdit'

const LABEL_W = 110
const PLOT_W = 760
const ROW = 26
const PAD_R = 18 // para que la última marca de tiempo no se corte
const OPERATOR = ['button', 'switch', 'emergency']

// Editor de formas de onda de un escenario de prueba: se dibuja cuándo se acciona cada entrada
// (arrastrando en su fila) y debajo se ve, en vivo, lo que hace el grafcet con la planta (sus
// salidas). Las entradas que da la planta (detectores, finales de carrera) no se dibujan: las da
// la máquina. getProject() -> { nodes, edges, plc }.
export default function ScenarioEditor({ getProject, scenario, onSave, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const project = useMemo(() => getProject(), [getProject])
  const model = useMemo(() => buildPlcModel(project.nodes, project.edges, project.plc), [project])

  // Entradas que se dibujan y su valor al empezar (el que dan la planta y el esquema en reposo).
  const { inputs, initial } = useMemo(() => {
    const names = model.variables.filter((v) => v.type === 'input').map((v) => v.name)
    const world = makeWorld(project.plc.scene ?? null, () => null, project.plc.electrical, model.variables)
    const driven = world.inputNames()
    const operator = new Set((project.plc.scene?.elements ?? []).filter((e) => OPERATOR.includes(e.type)).map((e) => e.variable))
    const start = runScenarioWorld(project.plc, model, { duration: 0, events: [] }).samples[0].values
    const list = names.filter((n) => !driven.has(n) || operator.has(n))
    return { inputs: list, initial: Object.fromEntries(list.map((n) => [n, start[n] ?? 0])) }
  }, [project, model])

  const [name, setName] = useState(scenario?.name ?? t('Escenario dibujado'))
  const [duration, setDuration] = useState(scenario?.duration ?? 10)
  const [series, setSeries] = useState(() => seriesOf(scenario ?? { duration: 10, events: [] }, inputs, initial))
  const [stroke, setStroke] = useState(null) // { name, from, to, value } mientras se arrastra
  const n = series[inputs[0]]?.length ?? Math.round(duration / STEP)
  const cell = PLOT_W / n
  const shown = stroke ? { ...series, [stroke.name]: paint(series[stroke.name], stroke.from, stroke.to, stroke.value) } : series
  const events = useMemo(() => eventsOf(shown, initial), [shown, initial])

  // Lo que hace el grafcet con este escenario (vista previa en vivo).
  const preview = useMemo(() => {
    try {
      return runScenarioWorld(project.plc, model, { duration, events })
    } catch {
      return null
    }
  }, [project, model, duration, events])
  const outputs = model.variables.filter((v) => v.type === 'output').map((v) => v.name)

  const cellAt = (ev) => {
    const r = ev.currentTarget.ownerSVGElement.getBoundingClientRect()
    const x = ((ev.clientX - r.left) / r.width) * (LABEL_W + PLOT_W + PAD_R) - LABEL_W
    return Math.max(0, Math.min(n - 1, Math.floor(x / cell)))
  }
  const height = (inputs.length + outputs.length) * ROW + 52
  const y0 = 22 // fila 0 (las marcas de tiempo, encima)
  const yOut = y0 + inputs.length * ROW + 26
  const wave = (row, top) => {
    let d = ''
    row.forEach((v, i) => {
      const y = top + (v ? 4 : ROW - 6)
      d += `${i ? 'L' : 'M'} ${LABEL_W + i * cell} ${y} L ${LABEL_W + (i + 1) * cell} ${y} `
    })
    return d
  }
  // Las salidas de la vista previa, como filas por casilla.
  const outputRow = (name) => {
    const row = new Array(n).fill(0)
    for (const s of preview?.samples ?? []) {
      const from = Math.round(s.t / STEP)
      for (let i = from; i < n; i++) row[i] = s.values[name] ?? 0
    }
    return row
  }
  const ticks = []
  const every = duration <= 12 ? 1 : duration <= 40 ? 5 : 10
  for (let s = 0; s <= duration + 1e-9; s += every) ticks.push(s)

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="scenario-editor-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(64rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="scenario-editor-title" className="flex items-center gap-2 text-base font-semibold">
          <PenLine size={18} /> {t('Editor de escenarios')}
        </h2>
        <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} aria-label={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4 text-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">{t('Nombre')}</span>
            <input id="scenario-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-0.5 block w-64 rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">{t('Duración (s)')}</span>
            <input
              id="scenario-duration"
              type="number"
              min="1"
              max="120"
              step="1"
              value={duration}
              onChange={(e) => {
                const d = Math.min(120, Math.max(1, Number(e.target.value) || 1))
                setDuration(d)
                setSeries((s) => resize(s, d))
              }}
              className="mt-0.5 block w-24 rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <p className="min-w-0 flex-1 text-xs text-slate-500">
            {t('Arrastra en la fila de una entrada para pulsarla durante ese tiempo; arrastra sobre un tramo encendido para soltarla. Debajo, lo que hace el grafcet.')}
          </p>
        </div>
        {inputs.length === 0 ? (
          <p className="text-slate-500">{t('El grafcet no tiene entradas que accionar.')}</p>
        ) : (
          <div className="paper overflow-x-auto rounded border border-slate-200">
            <svg viewBox={`0 0 ${LABEL_W + PLOT_W + PAD_R} ${height}`} width="100%" className="min-w-[640px] select-none text-[11px]" role="img" aria-label={t('Formas de onda del escenario')}>
              <rect width={LABEL_W + PLOT_W + PAD_R} height={height} fill="white" />
              {ticks.map((s) => (
                <g key={s}>
                  <line x1={LABEL_W + (s / STEP) * cell} x2={LABEL_W + (s / STEP) * cell} y1={14} y2={height - 4} stroke="#e2e8f0" />
                  <text x={LABEL_W + (s / STEP) * cell} y={11} textAnchor="middle" fill="#64748b">
                    {s}s
                  </text>
                </g>
              ))}
              {inputs.map((name, i) => {
                const top = y0 + i * ROW
                return (
                  <g key={name} data-input={name}>
                    <text x={6} y={top + ROW / 2 + 4} fill="#0f172a" fontWeight="600">
                      {name.length > 13 ? `${name.slice(0, 12)}…` : name}
                    </text>
                    <rect x={LABEL_W} y={top + 1} width={PLOT_W} height={ROW - 2} fill={i % 2 ? '#f8fafc' : '#ffffff'} />
                    <path d={wave(shown[name], top)} fill="none" stroke="#2563eb" strokeWidth="2" />
                    {/* Zona de dibujo de la fila. */}
                    <rect
                      x={LABEL_W}
                      y={top}
                      width={PLOT_W}
                      height={ROW}
                      fill="transparent"
                      style={{ cursor: 'crosshair', touchAction: 'none' }}
                      data-row={name}
                      onPointerDown={(ev) => {
                        ev.currentTarget.setPointerCapture?.(ev.pointerId)
                        const at = cellAt(ev)
                        setStroke({ name, from: at, to: at, value: shown[name][at] ? 0 : 1 })
                      }}
                      onPointerMove={(ev) => stroke?.name === name && setStroke({ ...stroke, to: cellAt(ev) })}
                      onPointerUp={() => {
                        if (!stroke) return
                        setSeries(shown)
                        setStroke(null)
                      }}
                    />
                  </g>
                )
              })}
              <text x={6} y={yOut - 8} fill="#64748b" fontWeight="600">
                {t('Lo que hace el grafcet')}
              </text>
              {outputs.map((name, i) => {
                const top = yOut + i * ROW
                const row = outputRow(name)
                return (
                  <g key={name} data-output={name} data-high={row.filter(Boolean).length}>
                    <text x={6} y={top + ROW / 2 + 4} fill="#475569">
                      {name.length > 13 ? `${name.slice(0, 12)}…` : name}
                    </text>
                    <path d={wave(row, top)} fill="none" stroke="#16a34a" strokeWidth="2" />
                  </g>
                )
              })}
            </svg>
          </div>
        )}
        {preview && Object.keys(preview.counts).length > 0 && (
          <p className="text-xs text-slate-600">
            {t('Piezas al final:')}{' '}
            {Object.entries(preview.counts)
              .map(([id, count]) => `${(project.plc.scene?.elements ?? []).find((e) => e.id === id)?.text || id}: ${count}`)
              .join(' · ')}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={() => dialogRef.current.close()} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
          {t('Cancelar')}
        </button>
        <button
          type="button"
          onClick={() => {
            onSave({ ...(scenario ?? { id: crypto.randomUUID() }), name: name.trim() || t('Escenario dibujado'), duration, events })
            dialogRef.current.close()
          }}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('Guardar')}
        </button>
      </div>
    </dialog>
  )
}
