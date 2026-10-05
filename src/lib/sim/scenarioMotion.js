// Lo que hace la máquina con un escenario de prueba, sin tiempo real (para el dossier y para
// corregir ejercicios): el grafcet con su planta y su esquema, como en la simulación.
//   runScenarioWorld -> { samples: [{ t, values }] (salidas, entradas y etapas, en cada cambio),
//                         counts: piezas en cada recogida al final, motion: registro de cilindros }
//   scenarioMotion   -> el diagrama espacio-fase de los cilindros (null si no hay)
import { compile, evolve, initialState } from './engine'
import { buildSpacePhase, cylindersOf, motionSample, pushMotion } from './spacePhase'
import { advanceWorld, makeWorld } from './world'

const DT = 0.05

// Valores binarios que interesan al comparar: salidas, entradas y etapas (por su variable).
function valuesOf(compiled, state) {
  const values = {}
  for (const v of compiled.variables) if (v.type === 'output' || v.type === 'input') values[v.name] = Number(state.values[v.name]) ? 1 : 0
  for (const s of compiled.steps) values[s.variable] = state.active.has(s.id) ? 1 : 0
  return values
}
const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k])

export function runScenarioWorld(plc, model, scenario) {
  const compiled = compile(model)
  const cylinders = cylindersOf(plc.scene)
  const world = makeWorld(plc.scene ?? null, () => null, plc.electrical, compiled.variables)
  let w = world.init()
  let inputs = {}
  for (const v of compiled.variables) {
    if (v.type === 'input') inputs[v.name] = 0
    if (v.type === 'analogIn') inputs[v.name] = v.analog?.min ?? 0
  }
  inputs = { ...inputs, ...world.inputs(w) }
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  const phase = (s) => [...s.active].sort().join(',')
  let motion = pushMotion([], motionSample(0, w, cylinders, phase(state)))
  const samples = [{ t: 0, values: valuesOf(compiled, state) }]
  let next = 0
  const end = scenario.duration ?? (scenario.events.at(-1)?.t ?? 0) + 1
  for (let t = DT; t <= end + 1e-9; t = Math.round((t + DT) * 1e6) / 1e6) {
    const r = advanceWorld(compiled, { state, inputs, world: w }, t, { world, scenario, next })
    ;({ state, inputs, next } = r)
    w = r.world
    motion = pushMotion(motion, motionSample(t, w, cylinders, phase(state)))
    const values = valuesOf(compiled, state)
    if (!same(values, samples[samples.length - 1].values)) samples.push({ t, values })
  }
  return { samples, counts: { ...(w.counts ?? {}) }, motion, cylinders, compiled, duration: end }
}

export function scenarioMotion(plc, scenario, model) {
  if (!scenario || !cylindersOf(plc.scene).length) return null
  const { motion, cylinders } = runScenarioWorld(plc, model, scenario)
  return buildSpacePhase(motion, cylinders)
}
