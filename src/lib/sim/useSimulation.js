import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildPlcModel } from '../plcModel'
import { compile, evolve, initialState, inspect, withMacros } from './engine'
import { recordEvent } from './scenario'
import { sceneAction } from './scene'
import { advanceWorld, makeWorld } from './world'
import { cylindersOf, motionSample, pushMotion } from './spacePhase'
import { SCAN, advanceCpu, makeCpuRunner } from '../plc/cpuRun'
import { generateLadder } from '../ladder/generate'
import { toS7200 } from '../ladder/exportS7200'

const TICK_MS = 50
const MAX_LOG = 200
const MAX_SAMPLES = 4000

// Señales binarias que se registran para el cronograma: etapas, entradas y salidas.
export function sampleOf(compiled, state) {
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
  // Escena de la planta (scene.js): produce las entradas a partir de las salidas.
  const scene = plc.scene
  const analogRange = useCallback(
    (name) => {
      const v = compiled?.variables.find((x) => x.name === name)
      return v?.analog ? { min: v.analog.min ?? 0, max: v.analog.max ?? 100 } : null
    },
    [compiled],
  )
  const world = useMemo(
    () => makeWorld(enabled ? scene : null, analogRange, enabled ? plc.electrical : null, compiled?.variables ?? []),
    [enabled, scene, analogRange, plc.electrical, compiled],
  )
  // Cilindros de la planta, para el diagrama espacio-fase (spacePhase.js).
  const cylinders = useMemo(() => cylindersOf(enabled ? scene : null), [enabled, scene])

  // Modo «Autómata» (plc.cpu.enabled): la lógica la pone un programa S7-200 (el generado del grafcet
  // o uno de Micro/WIN) en la CPU simulada, en lugar del grafcet. Solo se rehace (y la CPU vuelve a
  // empezar) si cambian el programa o las direcciones, no al mover la planta.
  const cpuConfig = plc.cpu
  const cpuText = useMemo(() => {
    if (!enabled || !cpuConfig?.enabled) return null
    if (cpuConfig.source === 'file') return cpuConfig.text ?? ''
    return toS7200(generateLadder(nodes, edges, plc), plc, { title: '' }).text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cpuConfig, nodes, edges, plc.variables, plc.steps, plc.scheme])
  const addressKey = compiled ? compiled.variables.map((v) => `${v.name}=${v.address}:${v.type}`).join('|') : ''
  const cpuSetup = useMemo(
    () => (cpuText === null || !compiled ? null : makeCpuRunner(cpuText, compiled.variables)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cpuText, addressKey],
  )
  const cpuRunner = cpuSetup?.runner ?? null
  // Fase = etapas activas (con el autómata no hay etapas: null).
  const phaseOf = useCallback((state) => (cpuSetup ? null : [...state.active].sort().join(',')), [cpuSetup])

  // { state, inputs, log, samples, recording: [eventos] | null, playback: { scenario, next } | null,
  //   world: estado de la escena de la planta }
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
      // Elementos añadidos durante la simulación: parten de su estado inicial.
      const from = { state: current.state, inputs: current.inputs, world: world.init(current.world) }
      let cpuError = null
      let result
      if (cpuSetup) {
        // Autómata: un ciclo con «Paso»; si el programa falla, la CPU se para (STOP) con el motivo.
        if (!cpuRunner || current.cpuError) return
        const target = options?.singleStep ? current.state.time + SCAN : until
        const r = advanceCpu(cpuRunner, from, target, { world, scenario: playback?.scenario, next: playback?.next ?? 0 })
        cpuError = r.error
        if (cpuError) setPlaying(false)
        result = { ...r, events: [] }
      } else {
        result = advanceWorld(compiled, from, until, { world, scenario: playback?.scenario, next: playback?.next ?? 0, options })
      }
      const { state, inputs, world: worldState, next: nextEvent, events } = result
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
      const motion = pushMotion(current.motion, motionSample(time, worldState, cylinders, phaseOf(state)))
      const next = { ...current, cpuError, state, inputs, world: worldState, log, samples, motion, playback: playback && !finished ? { ...playback, next: nextEvent } : null }
      simRef.current = next
      setSim(next)
    },
    [compiled, world, cpuSetup, cpuRunner, cylinders, phaseOf],
  )

  const reset = useCallback(() => {
    if (!compiled) return
    cpuRunner?.cpu.reset()
    const state = initialState(compiled)
    const inputs = {}
    for (const v of compiled.variables) {
      if (v.type === 'input') inputs[v.name] = 0
      if (v.type === 'analogIn') inputs[v.name] = v.analog?.min ?? 0
    }
    const worldState = world.init()
    Object.assign(inputs, world.inputs(worldState))
    const first = { state, inputs, world: worldState, log: [], samples: [], motion: [], recording: null, playback: null }
    simRef.current = first
    // Evolución inicial (p. ej. receptividades "1" desde la situación inicial). Con el autómata,
    // ninguna etapa: las salidas las da el programa.
    const settled = cpuSetup ? { ...state, active: new Set(), activatedAt: new Map(), values: { ...state.values, ...inputs } } : evolve(compiled, state, inputs, 0).state
    const ready = {
      ...first,
      state: settled,
      samples: [{ t: 0, values: sampleOf(compiled, settled) }],
      motion: pushMotion([], motionSample(0, worldState, cylinders, phaseOf(settled))),
    }
    simRef.current = ready
    setSim(ready)
  }, [compiled, world, cpuSetup, cpuRunner, cylinders, phaseOf])

  // Al cambiar de lógica o de programa, la simulación vuelve a empezar.
  const cpuKeyRef = useRef(cpuSetup)
  useEffect(() => {
    if (cpuKeyRef.current === cpuSetup) return
    cpuKeyRef.current = cpuSetup
    if (simRef.current) reset()
  }, [cpuSetup, reset])

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

  // Acciones del usuario sobre el mundo (pulsar un mando, nueva pieza, provocar una avería…):
  // sus sensores cambian al momento.
  const changeWorld = useCallback(
    (update) => {
      const current = simRef.current
      if (!current) return
      const worldState = update(world.init(current.world))
      const next = { ...current, world: worldState, inputs: { ...current.inputs, ...world.inputs(worldState) } }
      simRef.current = next
      setSim(next)
    },
    [world],
  )
  const sceneDo = useCallback((id, action) => changeWorld((w) => sceneAction(scene, w, id, action)), [changeWorld, scene])
  // Esquema eléctrico: pulsar un mando, conmutar o rearmar una protección…
  const elecDo = useCallback(
    (id, action) => changeWorld((w) => world.elecDo(w, id, action, simRef.current?.state.values ?? {})),
    [changeWorld, world],
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
    // Autómata: { errors, warnings } del programa y el error de ejecución (si se ha parado).
    cpu: cpuSetup ? { errors: cpuSetup.errors, warnings: cpuSetup.warnings, error: sim?.cpuError ?? null, source: cpuConfig?.source ?? 'generated', text: cpuText } : null,
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
    sceneDo,
    elecDo,
    world,
    cylinders,
    sceneCount: scene?.elements?.length ?? 0,
  }
}
