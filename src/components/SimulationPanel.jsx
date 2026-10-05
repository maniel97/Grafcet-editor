import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Factory, Pause, Play, RotateCcw, SkipForward, Square, Timer, Zap } from 'lucide-react'
import Chronogram from './Chronogram'
import SpacePhase from './SpacePhase'
import { buildSpacePhase, compareSpacePhase, theoreticalSpacePhase } from '../lib/sim/spacePhase'
import { parseSequence } from '../lib/pneumatic'
import { useDraft } from './useDraft'
import ScenarioControls from './ScenarioControls'
import CpuControls from './CpuControls'
import { chronogramCsv } from '../lib/sim/scenario'
import { withMacros } from '../lib/sim/engine'
import { firstFailure, waitingFor } from '../lib/sim/explain'
import { downloadFile } from '../lib/projectFile'
import { fileName, getProjectName } from '../lib/fileNames'
import { svgMarkupSource } from '../lib/svgExport'
import ExportDialog from './ExportDialog'
import { t } from '../lib/i18n'

const SPEEDS = [0.25, 0.5, 1, 2, 5, 10]

function Section({ title, count, children, defaultOpen = true, tour }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section data-tour={tour} className="border-b border-slate-100">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500 hover:bg-slate-50"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
        {count !== undefined && <span className="ml-auto font-normal normal-case">{count}</span>}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </section>
  )
}

const Lamp = ({ on, color = 'bg-green-500' }) => (
  <span
    className={`inline-block h-3 w-3 shrink-0 rounded-full border ${on ? `${color} border-transparent shadow-[0_0_6px] shadow-green-400` : 'border-slate-300 bg-slate-100'}`}
  />
)

// Interruptor (enclavado) + pulsador (activo mientras se mantiene pulsado) para una entrada.
function InputRow({ variable, value, onChange, hotkey }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <button
        type="button"
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
        title={t('Interruptor: clic para cambiar')}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${value ? 'bg-green-500' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? 'left-4.5' : 'left-0.5'}`} />
      </button>
      <span className="min-w-0 flex-1 truncate font-mono text-sm" title={variable.name}>
        {variable.name}
        {variable.address && <span className="ml-1 text-xs text-slate-400">{variable.address}</span>}
      </span>
      <button
        type="button"
        title={t('Pulsador: activo mientras lo mantienes pulsado')}
        onPointerDown={(e) => {
          onChange(true)
          // Captura el puntero para recibir el "soltar" aunque se salga del botón. Algunos
          // dispositivos no lo permiten: entonces basta con soltar encima.
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* sin captura */
          }
        }}
        onPointerUp={() => onChange(false)}
        onPointerCancel={() => onChange(false)}
        className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 select-none hover:bg-slate-100 active:bg-green-100"
      >
        {t('pulsar')}
      </button>
      {hotkey && <kbd className="w-4 text-center text-[10px] text-slate-400">{hotkey}</kbd>}
    </div>
  )
}

// Cronograma completo (desde t = 0) como SVG independiente. react-dom/server se carga solo al exportar.
// Fuente de exportación del cronograma completo (desde t = 0), con los datos de este momento.
// react-dom/server se carga solo al exportar.
function chronogramSource(samples, signals, now) {
  return svgMarkupSource(
    async () => {
      const { renderToStaticMarkup } = await import('react-dom/server')
      const span = Math.max(now, 1)
      const width = Math.round(Math.min(4000, Math.max(600, 72 + span * 40)))
      return renderToStaticMarkup(<Chronogram samples={samples} signals={signals} now={span} window={span} width={width} standalone />)
    },
    { kind: 'cronograma', title: `${getProjectName().trim() || 'Grafcet'} · ${t('cronograma de la simulación')}`, name: (ext) => fileName(ext, 'cronograma') },
  )
}

// Fuente de exportación del diagrama espacio-fase (o espacio-tiempo) con los datos de este momento.
function spacePhaseSource(diagram, mode, extra = {}) {
  return svgMarkupSource(
    async () => {
      const { renderToStaticMarkup } = await import('react-dom/server')
      const width = Math.round(Math.min(2400, Math.max(480, 64 + diagram.phases.length * 70)))
      return renderToStaticMarkup(<SpacePhase diagram={diagram} mode={mode} width={width} standalone {...extra} />)
    },
    {
      kind: 'espacio-fase',
      title: `${getProjectName().trim() || 'Grafcet'} · ${mode === 'fase' ? t('diagrama espacio-fase') : t('diagrama espacio-tiempo')}`,
      name: (ext) => fileName(ext, mode === 'fase' ? 'espacio-fase' : 'espacio-tiempo'),
    },
  )
}

const fmtTime = (v) => (v < 60 ? `${v.toFixed(1)} s` : `${Math.floor(v / 60)} min ${(v % 60).toFixed(1)} s`)

// Panel de control de la simulación.
export default function SimulationPanel({ simulation, scenarios = [], onScenariosChange, onEditScenario, expectedSequence = '', onExpectedSequenceChange, cpuConfig, onCpuChange, onApplySymbols, sceneOpen, onToggleScene, elecOpen, onToggleElec, exportProps, onFocusNode, onClose }) {
  const { compiled, sim, playing, setPlaying, speed, setSpeed, setInput, step, advance, reset } = simulation

  // Las entradas que gobierna la planta virtual no se cambian a mano.
  const plantDriven = useMemo(() => simulation.world.inputNames(), [simulation.world])
  const allInputs = useMemo(() => compiled?.variables.filter((v) => v.type === 'input') ?? [], [compiled])
  const inputs = useMemo(() => allInputs.filter((v) => !plantDriven.has(v.name)), [allInputs, plantDriven])
  const plantInputsShown = allInputs.filter((v) => plantDriven.has(v.name))
  // Lo que espera el grafcet ahora (transiciones validadas y lo que les falta).
  const waiting = useMemo(() => (compiled && sim ? waitingFor(compiled, sim) : null), [compiled, sim])
  const [chronoExport, setChronoExport] = useState(null)
  // Diagrama espacio-fase de los cilindros de la planta (lib/sim/spacePhase.js), por fases o en el tiempo.
  const [phaseMode, setPhaseMode] = useState('fase')
  const spacePhase = useMemo(() => buildSpacePhase(sim?.motion, simulation.cylinders ?? []), [sim?.motion, simulation.cylinders])
  const [phaseSignals, setPhaseSignals] = useState(false)
  // Secuencia esperada (p. ej. la del enunciado, o la del generador neumático): su diagrama teórico
  // se dibuja debajo y se compara con lo que ha hecho la planta.
  const sequenceDraft = useDraft(expectedSequence)
  const expectedParsed = useMemo(() => (expectedSequence.trim() ? parseSequence(expectedSequence) : null), [expectedSequence])
  const expectedDiagram = useMemo(
    () => (expectedParsed && !expectedParsed.errors.length ? theoreticalSpacePhase(expectedParsed.groups) : null),
    [expectedParsed],
  )
  const comparison = useMemo(() => compareSpacePhase(spacePhase, expectedDiagram), [spacePhase, expectedDiagram])

  // Teclas 1–9: cambian las primeras entradas (fuera de los campos de texto).
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const v = e.target
      if (v instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(v.tagName)) return
      const index = Number(e.key) - 1
      if (!Number.isInteger(index) || index < 0 || index >= Math.min(9, inputs.length)) return
      e.preventDefault()
      const name = inputs[index].name
      setInput(name, !simulation.sim?.inputs[name])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inputs, setInput, simulation.sim])

  if (!compiled || !sim) return null
  const { state } = sim
  const values = state.values
  const outputs = compiled.variables.filter((v) => v.type === 'output')
  const analogInputs = compiled.variables.filter((v) => v.type === 'analogIn')
  const analogOutputs = compiled.variables.filter((v) => v.type === 'analogOut')
  const memories = compiled.variables.filter((v) => v.type === 'memory' || v.type === 'counter')
  const timers = compiled.variables.filter((v) => v.type === 'timer')
  const shownActive = withMacros(compiled, state.active)
  const activeSteps = compiled.steps.filter((s) => shownActive.has(s.id))

  const elapsedOf = (label) => {
    const s = compiled.steps.find((x) => String(x.label) === String(label))
    return s && state.active.has(s.id) ? state.time - (state.activatedAt.get(s.id) ?? state.time) : null
  }
  const UNIT = { ms: 0.001, s: 1, min: 60, h: 3600 }
  // Temporizadores: «5s/X2» (desde la activación de la etapa) y los de una temporización t1/a/t2:
  // «3s/a» cuenta mientras a vale 1 y «a/2s», mientras vale 0 (estado en state.delays).
  const timerInfo = (v) => {
    const step = /^([\d.]+)(ms|s|min|h)\/X(\d.*)$/.exec(v.name)
    if (step) return { preset: parseFloat(step[1]) * UNIT[step[2]], elapsed: elapsedOf(step[3]), idle: t('etapa inactiva') }
    const rising = /^([\d.]+)(ms|s|min|h)\/(.+)$/.exec(v.name)
    const falling = /^(.+)\/([\d.]+)(ms|s|min|h)$/.exec(v.name)
    if (!rising && !falling) return null
    const [preset, name, down] = rising ? [parseFloat(rising[1]) * UNIT[rising[2]], rising[3], false] : [parseFloat(falling[2]) * UNIT[falling[3]], falling[1], true]
    const key = [...(compiled.delays?.entries() ?? [])].find(([, ast]) => (ast.arg.name ?? `X${ast.arg.step}`) === name)?.[0]
    const d = key ? state.delays?.get(key) : null
    const counting = d && d.input !== down
    return { preset, elapsed: counting ? state.time - d.since : null, idle: t('{variable} a {valor}', { variable: name, valor: down ? 1 : 0 }) }
  }

  const signals = [
    ...compiled.steps.map((s) => ({ name: s.variable, color: '#0f172a' })),
    ...inputs.map((v) => ({ name: v.name, color: '#2563eb' })),
    ...outputs.map((v) => ({ name: v.name, color: '#16a34a' })),
  ]

  return (
    <aside data-tour="simulacion" className="side-panel flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className={`h-2 w-2 rounded-full ${playing ? 'animate-pulse bg-green-500' : 'bg-amber-500'}`} />
          {playing ? t('Simulación en marcha') : t('Simulación en pausa')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          title={t('Detener la simulación y volver a editar')}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
        >
          <Square size={14} />{' '}{t('Salir')}
        </button>
      </div>

      <div className="space-y-2 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white ${playing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? t('Pausa') : t('Marcha')}
          </button>
          <button
            type="button"
            onClick={step}
            disabled={playing}
            title={t('Paso: un franqueo (muestra la evolución fugaz paso a paso)')}
            className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
          >
            <SkipForward size={16} />
          </button>
          <button
            type="button"
            onClick={() => advance(1)}
            disabled={playing}
            title={t('Avanzar el tiempo 1 s (para las temporizaciones)')}
            className="flex items-center rounded-md border border-slate-300 px-1.5 py-1 text-xs hover:bg-slate-100 disabled:opacity-40"
          >
            <Timer size={14} />
            +1s
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              reset()
            }}
            title={t('Reiniciar: vuelve a la situación inicial')}
            className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-100"
          >
            <RotateCcw size={16} />
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="ml-auto rounded-md border border-slate-300 px-1 py-1 text-xs"
            aria-label={t('Velocidad')}
            title={t('Velocidad del tiempo simulado')}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                ×{s}
              </option>
            ))}
          </select>
        </div>
        <p className="font-mono text-xs text-slate-500">t = {fmtTime(state.time)}</p>

        {state.unstable && (
          <p className="flex gap-1 rounded bg-red-50 p-2 text-xs text-red-700">
            <AlertTriangle size={14} className="shrink-0" />
            {t('Ciclo inestable: las transiciones se franquean sin fin con las mismas entradas (p. ej. receptividades «1» en bucle).')}
          </p>
        )}
        {compiled.errors.length > 0 && (
          <div className="rounded bg-amber-50 p-2 text-xs text-amber-800">
            <p className="mb-1 font-medium">{t('Expresiones no válidas (se toman como falsas):')}</p>
            {compiled.errors.map((err, i) => (
              <button key={i} type="button" onClick={() => onFocusNode(err.nodeId)} className="block text-left hover:underline">
                {err.message}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <CpuControls config={cpuConfig} status={simulation.cpu} onChange={onCpuChange} onApplySymbols={onApplySymbols} />
        {!simulation.cpu && (
        <Section title={t('Qué espera el grafcet')} count={waiting.list.length}>
          {waiting.stuck && (
            <p className="rounded bg-red-50 p-2 text-xs text-red-700">
              {t('Ninguna transición está validada: el grafcet ya no puede evolucionar. Revisa los enlaces que salen de las etapas activas.')}
            </p>
          )}
          <ul className="space-y-1" aria-label={t('Qué espera el grafcet')}>
            {waiting.list.map((e) => {
              const missing = e.receptivity && firstFailure(e.receptivity)
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onFocusNode(e.id)}
                    title={t('Ver la transición (pasa el ratón por ella para ver el detalle)')}
                    className="block w-full rounded px-1 py-0.5 text-left text-xs hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${e.status === 'ready' ? 'bg-green-600' : e.status === 'error' ? 'bg-red-600' : 'bg-amber-500'}`} />
                      <span className="font-mono">
                        {e.steps.map((st) => st.variable).join(', ')} → «{e.condition || '—'}»
                      </span>
                    </span>
                    <span className="block pl-3.5 text-slate-500">
                      {e.status === 'ready'
                        ? t('se franquea en el próximo ciclo')
                        : missing
                          ? missing.detail
                            ? t('falta {condicion}: {detalle}', { condicion: missing.text, detalle: missing.detail })
                            : t('falta {condicion}', { condicion: missing.text })
                          : e.summary}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Section>
        )}

        <div className="border-b border-slate-100 px-4 py-2">
          <button
            type="button"
            onClick={onToggleScene}
            aria-pressed={sceneOpen}
            title={t('Escena de la planta junto al grafcet: pulsadores, cilindros, cintas, detectores…')}
            className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${sceneOpen ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 hover:bg-slate-50'}`}
          >
            <Factory size={14} />{' '}{t('Planta virtual')}
            <span className="ml-auto text-xs text-slate-500">
              {simulation.sceneCount ? t('{n} elementos', { n: simulation.sceneCount }) : t('sin elementos')}
            </span>
          </button>
          <button
            type="button"
            onClick={onToggleElec}
            aria-pressed={elecOpen}
            title={t('Esquema eléctrico junto al grafcet: mando, potencia y conexiones del autómata')}
            className={`mt-1 flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${elecOpen ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 hover:bg-slate-50'}`}
          >
            <Zap size={14} />{' '}{t('Esquema eléctrico')}
          </button>
        </div>

        <Section title={t('Entradas')} count={allInputs.length} tour="entradas">
          {allInputs.length === 0 && <p className="text-xs text-slate-400">{t('No hay entradas: escribe receptividades como «Marcha».')}</p>}
          {inputs.map((v, i) => (
            <InputRow key={v.name} variable={v} value={sim.inputs[v.name]} onChange={(on) => setInput(v.name, on)} hotkey={i < 9 ? i + 1 : null} />
          ))}
          {plantInputsShown.map((v) => (
            <div key={v.name} className="flex items-center gap-2 py-1" title={t('La da la planta virtual')}>
              <Lamp on={Boolean(sim.inputs[v.name])} color="bg-blue-500" />
              <span className="min-w-0 flex-1 truncate font-mono text-sm">{v.name}</span>
              <span className="rounded bg-blue-50 px-1.5 text-[11px] text-blue-700">{t('planta')}</span>
            </div>
          ))}
          {!playing && inputs.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">{t('En pausa, los cambios se aplican con «Paso» o «+1s».')}</p>
          )}
        </Section>

        {analogInputs.length > 0 && (
          <Section title={t('Entradas analógicas')} count={analogInputs.length}>
            {analogInputs.map((v) => {
              const { min, max, unit } = v.analog
              const value = Number(sim.inputs[v.name] ?? min)
              return (
                <label key={v.name} className="block py-1">
                  <span className="flex justify-between font-mono text-sm">
                    <span className="truncate">{v.name}</span>
                    <span className="tabular-nums text-slate-600">
                      {Number(value.toFixed(2))} {unit}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={(max - min) / 200 || 1}
                    value={value}
                    aria-label={`Valor de ${v.name}`}
                    disabled={plantDriven.has(v.name)}
                    title={plantDriven.has(v.name) ? t('La da la planta virtual') : undefined}
                    onChange={(e) => setInput(v.name, Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </label>
              )
            })}
          </Section>
        )}

        <Section title={t('Salidas')} count={outputs.length}>
          {outputs.length === 0 && <p className="text-xs text-slate-400">{t('Sin salidas.')}</p>}
          {outputs.map((v) => (
            <div key={v.name} className="flex items-center gap-2 py-0.5">
              <Lamp on={Number(values[v.name]) !== 0} />
              <span className="truncate font-mono text-sm">{v.name}</span>
              {v.address && <span className="text-xs text-slate-400">{v.address}</span>}
            </div>
          ))}
        </Section>

        {analogOutputs.length > 0 && (
          <Section title={t('Salidas analógicas')} count={analogOutputs.length}>
            {analogOutputs.map((v) => (
              <div key={v.name} className="flex items-center gap-2 py-0.5 font-mono text-sm">
                <span className="flex-1 truncate">{v.name}</span>
                <span className="rounded bg-slate-100 px-1.5 tabular-nums">
                  {Number(Number(values[v.name] ?? 0).toFixed(2))} {v.analog?.unit}
                </span>
              </div>
            ))}
          </Section>
        )}

        {memories.length > 0 && (
          <Section title={t('Marcas y contadores')} count={memories.length}>
            {memories.map((v) => (
              <div key={v.name} className="flex items-center gap-2 py-0.5 font-mono text-sm">
                <span className="flex-1 truncate">{v.name}</span>
                <span className="rounded bg-slate-100 px-1.5">{Number(values[v.name] ?? 0)}</span>
              </div>
            ))}
          </Section>
        )}

        {timers.length > 0 && (
          <Section title={t('Temporizaciones')} count={timers.length}>
            {timers.map((v) => {
              const info = timerInfo(v)
              const progress = info?.elapsed != null ? Math.min(1, info.elapsed / info.preset) : 0
              return (
                <div key={v.name} className="py-1">
                  <div className="flex justify-between font-mono text-xs">
                    <span>{v.name}</span>
                    <span className="text-slate-500">
                      {info?.elapsed != null ? `${Math.min(info.elapsed, info.preset).toFixed(1)} / ${info.preset} s` : (info?.idle ?? '')}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded bg-slate-100">
                    <div className={`h-full rounded ${progress >= 1 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </Section>
        )}

        {!simulation.cpu && (
        <Section title={t('Etapas activas')} count={activeSteps.length}>
          <div className="flex flex-wrap gap-1">
            {activeSteps.length === 0 && <span className="text-xs text-slate-400">{t('Ninguna')}</span>}
            {activeSteps.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onFocusNode(s.id)}
                className="rounded-full bg-green-100 px-2 py-0.5 font-mono text-xs text-green-800 hover:bg-green-200"
              >
                {s.variable}
              </button>
            ))}
          </div>
        </Section>
        )}

        <Section title={t('Escenarios de prueba')} count={scenarios.length}>
          <ScenarioControls simulation={simulation} scenarios={scenarios} onChange={onScenariosChange} onEdit={onEditScenario} />
        </Section>

        <Section title={t('Cronograma')} defaultOpen>
          <Chronogram samples={sim.samples} signals={signals} now={state.time} />
          <div className="mt-1 flex items-center gap-1 text-xs">
            <span className="text-slate-400">{t('Exportar todo:')}</span>
            <button
              type="button"
              onClick={() => setChronoExport(chronogramSource(sim.samples, signals, state.time))}
              title={t('PNG, SVG o PDF, con vista previa')}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
            >
              {t('Imagen o PDF')}
            </button>
            <button
              type="button"
              onClick={() => downloadFile(`﻿${chronogramCsv(sim.samples, signals)}`, fileName('csv', 'cronograma'), 'text/csv;charset=utf-8')}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
            >
              {t('CSV')}
            </button>
          </div>
        </Section>

        {simulation.cylinders?.length > 0 && (
          <Section title={t('Diagrama espacio-fase')} tour="espacio-fase">
            <div className="mb-1 flex items-center gap-1 text-xs" role="radiogroup" aria-label={t('Eje horizontal')}>
              {[
                ['fase', t('Fases')],
                ['tiempo', t('Tiempo')],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={phaseMode === id}
                  onClick={() => setPhaseMode(id)}
                  className={`rounded border px-1.5 py-0.5 ${phaseMode === id ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={phaseSignals} onChange={(e) => setPhaseSignals(e.target.checked)} />
              {t('Líneas de señal (finales de carrera)')}
            </label>
            <label className="mb-1 block text-xs text-slate-600">
              {t('Secuencia esperada')}
              <input
                value={sequenceDraft.text}
                onFocus={sequenceDraft.focus}
                onBlur={sequenceDraft.blur}
                onChange={(e) => {
                  sequenceDraft.set(e.target.value)
                  onExpectedSequenceChange?.(e.target.value)
                }}
                placeholder={t('p. ej. A+ B+ B− A−')}
                spellCheck={false}
                className="mt-0.5 block w-full rounded border border-slate-300 px-1.5 py-0.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
              />
            </label>
            {expectedParsed?.errors.length > 0 && <p className="mb-1 text-xs text-red-700">{t(expectedParsed.errors[0])}</p>}
            {spacePhase ? (
              <>
                <div className="paper overflow-hidden rounded border border-slate-200">
                  <SpacePhase diagram={spacePhase} mode={phaseMode} expected={expectedDiagram} signals={phaseSignals} />
                </div>
                {comparison && (
                  <p role="status" data-comparison={comparison.ok ? 'ok' : 'distinta'} className={`mt-1 text-xs ${comparison.ok ? 'text-green-800' : 'text-red-700'}`}>
                    {comparison.ok
                      ? t('✓ Coincide con la secuencia esperada.')
                      : comparison.got
                        ? t('Fase {fase}: se esperaba {esperado} y se ha hecho {hecho}.', {
                            fase: comparison.phase,
                            esperado: comparison.expected.join(' '),
                            hecho: comparison.got.join(' '),
                          })
                        : t('Fase {fase}: se esperaba {esperado} y aún no ha pasado.', { fase: comparison.phase, esperado: comparison.expected.join(' ') })}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1 text-xs">
                  <span className="text-slate-400">{t('Exportar:')}</span>
                  <button
                    type="button"
                    onClick={() => setChronoExport(spacePhaseSource(spacePhase, phaseMode, { expected: expectedDiagram, signals: phaseSignals }))}
                    title={t('PNG, SVG o PDF, con vista previa')}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
                  >
                    {t('Imagen o PDF')}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">{t('Aparece cuando se mueve algún cilindro de la planta: haz un ciclo.')}</p>
            )}
          </Section>
        )}

        <Section title={t('Registro de franqueos')} count={sim.log.length} defaultOpen={false}>
          {sim.log.length === 0 && <p className="text-xs text-slate-400">{t('Aún no se ha franqueado ninguna transición.')}</p>}
          <ol className="space-y-0.5 font-mono text-[11px]">
            {[...sim.log].reverse().map((entry, i) => (
              <li key={i}>
                <button type="button" onClick={() => onFocusNode(entry.transitionId)} className="text-left hover:underline">
                  <span className="text-slate-400">{entry.time.toFixed(2)}s</span> {entry.text}
                </button>
              </li>
            ))}
          </ol>
        </Section>
      </div>
      {chronoExport && (
        <ExportDialog
          source={chronoExport}
          initialFormat="pdf"
          fileName={(ext) => fileName(ext, 'cronograma')}
          {...exportProps}
          onClose={() => setChronoExport(null)}
        />
      )}
    </aside>
  )
}
