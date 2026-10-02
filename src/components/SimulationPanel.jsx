import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Pause, Play, RotateCcw, SkipForward, Square, Timer } from 'lucide-react'
import Chronogram from './Chronogram'
import ScenarioControls from './ScenarioControls'
import { chronogramCsv } from '../lib/sim/scenario'
import { downloadFile } from '../lib/projectFile'
import { fileName } from '../lib/fileNames'

const SPEEDS = [0.25, 0.5, 1, 2, 5, 10]

function Section({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-slate-100">
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
        title="Interruptor: clic para cambiar"
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
        title="Pulsador: activo mientras lo mantienes pulsado"
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
        pulsar
      </button>
      {hotkey && <kbd className="w-4 text-center text-[10px] text-slate-400">{hotkey}</kbd>}
    </div>
  )
}

// Cronograma completo (desde t = 0) como SVG independiente. react-dom/server se carga solo al exportar.
async function exportChronogramSvg(samples, signals, now) {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const span = Math.max(now, 1)
  const width = Math.round(Math.min(4000, Math.max(600, 72 + span * 40)))
  const svg = renderToStaticMarkup(<Chronogram samples={samples} signals={signals} now={span} window={span} width={width} standalone />)
  downloadFile(svg, fileName('svg', 'cronograma'), 'image/svg+xml')
}

const fmtTime = (t) => (t < 60 ? `${t.toFixed(1)} s` : `${Math.floor(t / 60)} min ${(t % 60).toFixed(1)} s`)

// Panel de control de la simulación.
export default function SimulationPanel({ simulation, scenarios = [], onScenariosChange, onFocusNode, onClose }) {
  const { compiled, sim, playing, setPlaying, speed, setSpeed, setInput, step, advance, reset } = simulation

  const inputs = useMemo(() => compiled?.variables.filter((v) => v.type === 'input') ?? [], [compiled])

  // Teclas 1–9: cambian las primeras entradas (fuera de los campos de texto).
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
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
  const memories = compiled.variables.filter((v) => v.type === 'memory' || v.type === 'counter')
  const timers = compiled.variables.filter((v) => v.type === 'timer')
  const activeSteps = compiled.steps.filter((s) => state.active.has(s.id))

  const elapsedOf = (label) => {
    const s = compiled.steps.find((x) => String(x.label) === String(label))
    return s && state.active.has(s.id) ? state.time - (state.activatedAt.get(s.id) ?? state.time) : null
  }
  const timerInfo = (v) => {
    const m = /^([\d.]+)(ms|s|min|h)\/X(.+)$/.exec(v.name)
    if (!m) return null
    const preset = parseFloat(m[1]) * { ms: 0.001, s: 1, min: 60, h: 3600 }[m[2]]
    return { preset, elapsed: elapsedOf(m[3]) }
  }

  const signals = [
    ...compiled.steps.map((s) => ({ name: s.variable, color: '#0f172a' })),
    ...inputs.map((v) => ({ name: v.name, color: '#2563eb' })),
    ...outputs.map((v) => ({ name: v.name, color: '#16a34a' })),
  ]

  return (
    <aside className="side-panel flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className={`h-2 w-2 rounded-full ${playing ? 'animate-pulse bg-green-500' : 'bg-amber-500'}`} />
          Simulación {playing ? 'en marcha' : 'en pausa'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          title="Detener la simulación y volver a editar"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
        >
          <Square size={14} /> Salir
        </button>
      </div>

      <div className="space-y-2 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white ${playing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pausa' : 'Marcha'}
          </button>
          <button
            type="button"
            onClick={step}
            disabled={playing}
            title="Paso: un franqueo (muestra la evolución fugaz paso a paso)"
            className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
          >
            <SkipForward size={16} />
          </button>
          <button
            type="button"
            onClick={() => advance(1)}
            disabled={playing}
            title="Avanzar el tiempo 1 s (para las temporizaciones)"
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
            title="Reiniciar: vuelve a la situación inicial"
            className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-100"
          >
            <RotateCcw size={16} />
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="ml-auto rounded-md border border-slate-300 px-1 py-1 text-xs"
            aria-label="Velocidad"
            title="Velocidad del tiempo simulado"
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
            Ciclo inestable: las transiciones se franquean sin fin con las mismas entradas (p. ej. receptividades «1» en
            bucle).
          </p>
        )}
        {compiled.errors.length > 0 && (
          <div className="rounded bg-amber-50 p-2 text-xs text-amber-800">
            <p className="mb-1 font-medium">Expresiones no válidas (se toman como falsas):</p>
            {compiled.errors.map((err, i) => (
              <button key={i} type="button" onClick={() => onFocusNode(err.nodeId)} className="block text-left hover:underline">
                {err.message}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Entradas" count={inputs.length}>
          {inputs.length === 0 && <p className="text-xs text-slate-400">No hay entradas: escribe receptividades como «Marcha».</p>}
          {inputs.map((v, i) => (
            <InputRow key={v.name} variable={v} value={sim.inputs[v.name]} onChange={(on) => setInput(v.name, on)} hotkey={i < 9 ? i + 1 : null} />
          ))}
          {!playing && inputs.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">En pausa, los cambios se aplican con «Paso» o «+1s».</p>
          )}
        </Section>

        <Section title="Salidas" count={outputs.length}>
          {outputs.length === 0 && <p className="text-xs text-slate-400">Sin salidas.</p>}
          {outputs.map((v) => (
            <div key={v.name} className="flex items-center gap-2 py-0.5">
              <Lamp on={Number(values[v.name]) !== 0} />
              <span className="truncate font-mono text-sm">{v.name}</span>
              {v.address && <span className="text-xs text-slate-400">{v.address}</span>}
            </div>
          ))}
        </Section>

        {memories.length > 0 && (
          <Section title="Marcas y contadores" count={memories.length}>
            {memories.map((v) => (
              <div key={v.name} className="flex items-center gap-2 py-0.5 font-mono text-sm">
                <span className="flex-1 truncate">{v.name}</span>
                <span className="rounded bg-slate-100 px-1.5">{Number(values[v.name] ?? 0)}</span>
              </div>
            ))}
          </Section>
        )}

        {timers.length > 0 && (
          <Section title="Temporizaciones" count={timers.length}>
            {timers.map((v) => {
              const info = timerInfo(v)
              const progress = info?.elapsed != null ? Math.min(1, info.elapsed / info.preset) : 0
              return (
                <div key={v.name} className="py-1">
                  <div className="flex justify-between font-mono text-xs">
                    <span>{v.name}</span>
                    <span className="text-slate-500">
                      {info?.elapsed != null ? `${Math.min(info.elapsed, info.preset).toFixed(1)} / ${info.preset} s` : 'etapa inactiva'}
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

        <Section title="Etapas activas" count={activeSteps.length}>
          <div className="flex flex-wrap gap-1">
            {activeSteps.length === 0 && <span className="text-xs text-slate-400">Ninguna</span>}
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

        <Section title="Escenarios de prueba" count={scenarios.length}>
          <ScenarioControls simulation={simulation} scenarios={scenarios} onChange={onScenariosChange} />
        </Section>

        <Section title="Cronograma" defaultOpen>
          <Chronogram samples={sim.samples} signals={signals} now={state.time} />
          <div className="mt-1 flex items-center gap-1 text-xs">
            <span className="text-slate-400">Exportar todo:</span>
            <button
              type="button"
              onClick={() => exportChronogramSvg(sim.samples, signals, state.time)}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
            >
              SVG
            </button>
            <button
              type="button"
              onClick={() => downloadFile(`﻿${chronogramCsv(sim.samples, signals)}`, fileName('csv', 'cronograma'), 'text/csv;charset=utf-8')}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
            >
              CSV
            </button>
          </div>
        </Section>

        <Section title="Registro de franqueos" count={sim.log.length} defaultOpen={false}>
          {sim.log.length === 0 && <p className="text-xs text-slate-400">Aún no se ha franqueado ninguna transición.</p>}
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
    </aside>
  )
}
