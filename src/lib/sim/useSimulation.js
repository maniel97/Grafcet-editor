import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildPlcModel } from '../plcModel'
import { compile, evolve, initialState, inspect, withMacros } from './engine'
import { advanceWithEvents, recordEvent } from './scenario'

const TICK_MS = 50
const MAX_LOG = 200
const MAX_SAMPLES = 4000

// Señales binarias que se registran para el cronograma: etapas, entradas y salidas.
function sampleOf(compiled, state) {
  const sample = {}
  const active = withMacros(compiled, state.active)
  for (const s of compiled.steps) sample[s.variable] = active.has(s.id) ? 1 : 0
  for (const v of compiled.variables) {
    if (v.type === 'input' || v.type === 'output') sample[v.name] = Number(state.values[v.name]) ? 1 : 0
  }
  return sample
}

const sameSample = (a, b) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

// Simulación en tiempo real (100 % en el navegador) del grafcet actual.
// El modelo se compila al empezar y cada vez que cambia el diagrama o la tabla.
export function useSimulation(nodes, edges, plc, enabled) {
  const compiled = useMemo(() => (enabled ? compile(buildPlcModel(nodes, edges, plc)) : null), [enabled, nodes, edges, plc])

  // { state, inputs, log, samples, recording: [eventos] | null, playback: { scenario, next } | null }
  const [sim, setSim] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const simRef = useRef(sim)
  useEffect(() => {
    simRef.current = sim
  }, [sim])

  // Aplica un paso del motor y registra eventos y cronograma.
  const apply = useCallback(
    (time, options) => {
      const current = simRef.current
      if (!compiled || !current) return
      // Reproduciendo un escenario: se aplican sus cambios de entradas en su instante y se para al final.
      const playback = current.playback
      const until = playback ? Math.min(time, playback.scenario.duration ?? time) : time
      const r = advanceWithEvents(compiled, current.state, current.inputs, until, playback?.scenario, playback?.next ?? 0, options)
      const { state, events } = r
      const finished = playback && until >= (playback.scenario.duration ?? Infinity)
      if (finished) setPlaying(false)
      const variable = (id) => compiled.steps.find((s) => s.id === id)?.variable
      const log = events.length
        ? [
            ...current.log,
            ...events.map((e) => ({
              time: e.time,
              transitionId: e.transitionId ?? e.stepId,
              text: `${e.forcing ? `Forzado ${e.forcing} (${variable(e.stepId)})` : `«${e.condition || '—'}»`}: ${
                e.from.map(variable).join(', ') || '—'
              } → ${e.to.map(variable).join(', ') || '—'}`,
            })),
          ].slice(-MAX_LOG)
        : current.log
      const sample = sampleOf(compiled, state)
      const last = current.samples[current.samples.length - 1]
      const samples =
        last && sameSample(last.values, sample) ? current.samples : [...current.samples, { t: time, values: sample }].slice(-MAX_SAMPLES)
      const next = { ...current, state, inputs: r.inputs, log, samples, playback: playback && !finished ? { ...playback, next: r.next } : null }
      simRef.current = next
      setSim(next)
    },
    [compiled],
  )

  const reset = useCallback(() => {
    if (!compiled) return
    const state = initialState(compiled)
    const inputs = {}
    for (const v of compiled.variables) {
      if (v.type === 'input') inputs[v.name] = 0
      if (v.type === 'analogIn') inputs[v.name] = v.analog?.min ?? 0
    }
    const first = { state, inputs, log: [], samples: [], recording: null, playback: null }
    simRef.current = first
    // Evolución inicial (p. ej. receptividades "1" desde la situación inicial).
    const { state: settled } = evolve(compiled, state, inputs, 0)
    const ready = { ...first, state: settled, samples: [{ t: 0, values: sampleOf(compiled, settled) }] }
    simRef.current = ready
    setSim(ready)
  }, [compiled])

  // Arranque y parada de la simulación.
  useEffect(() => {
    if (enabled && !simRef.current) reset()
    if (!enabled) {
      simRef.current = null
      setSim(null)
      setPlaying(false)
    }
  }, [enabled, reset])

  // Bucle en tiempo real.
  useEffect(() => {
    if (!playing || !compiled) return
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = ((now - last) / 1000) * speed
      last = now
      apply((simRef.current?.state.time ?? 0) + dt)
    }, TICK_MS)
    return () => clearInterval(id)
  }, [playing, speed, compiled, apply])

  const setInput = useCallback(
    (name, value) => {
      const current = simRef.current
      if (!current) return
      // Analógicas: el valor (en unidades físicas); digitales: 0 / 1.
      const v = typeof value === 'number' ? value : value ? 1 : 0
      const recording = current.recording && recordEvent(current.recording, current.state.time, name, v)
      // Tocar una entrada durante una reproducción la interrumpe: a partir de ahí manda el usuario.
      const next = { ...current, inputs: { ...current.inputs, [name]: v }, recording, playback: null }
      simRef.current = next
      setSim(next)
      // En pausa no evoluciona: se usa "Paso" para ver el efecto.
    },
    [],
  )

  // Grabar: desde la situación inicial, con el tiempo en marcha.
  const startRecording = useCallback(() => {
    reset()
    if (!simRef.current) return
    simRef.current = { ...simRef.current, recording: [] }
    setSim(simRef.current)
    setPlaying(true)
  }, [reset])

  // Termina la grabación y devuelve el escenario (o null si no se tocó ninguna entrada).
  const stopRecording = useCallback(() => {
    const current = simRef.current
    if (!current?.recording) return null
    setPlaying(false)
    simRef.current = { ...current, recording: null }
    setSim(simRef.current)
    if (!current.recording.length) return null
    return { events: current.recording, duration: Math.round(current.state.time * 1000) / 1000 }
  }, [])

  const playScenario = useCallback(
    (scenario) => {
      reset()
      if (!simRef.current) return
      simRef.current = { ...simRef.current, playback: { scenario, next: 0 } }
      setSim(simRef.current)
      setPlaying(true)
    },
    [reset],
  )

  const step = useCallback(() => apply(simRef.current?.state.time ?? 0, { singleStep: true }), [apply])
  const advance = useCallback((seconds) => apply((simRef.current?.state.time ?? 0) + seconds), [apply])

  // Lo que el lienzo necesita para pintar; solo cambia cuando cambia algo visible.
  const view = useMemo(() => {
    if (!compiled || !sim) return null
    const { enabled: validated, ready } = inspect(compiled, sim.state)
    return { active: withMacros(compiled, sim.state.active), enabled: validated, ready, values: sim.state.values }
  }, [compiled, sim])
  const viewKey = view
    ? [
        [...view.active].sort().join(),
        [...view.enabled].sort().join(),
        [...view.ready].sort().join(),
        Object.entries(view.values)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}=${v}`)
          .join(),
      ].join('|')
    : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps -- se recalcula solo cuando cambia lo visible
  const stableView = useMemo(() => view, [viewKey])

  return {
    compiled,
    sim,
    view: stableView,
    playing,
    setPlaying,
    speed,
    setSpeed,
    setInput,
    step,
    advance,
    reset,
    startRecording,
    stopRecording,
    playScenario,
  }
}
