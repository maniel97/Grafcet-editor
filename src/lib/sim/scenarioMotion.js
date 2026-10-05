// Lo que hace la planta con un escenario de prueba, sin tiempo real (para el dossier y para
// corregir ejercicios): el registro de movimientos de sus cilindros, como el que anota la
// simulación, ya convertido en diagrama espacio-fase. null si no hay cilindros o escenario.
import { compile, evolve, initialState } from './engine'
import { buildSpacePhase, cylindersOf, motionSample, pushMotion } from './spacePhase'
import { advanceWorld, makeWorld } from './world'

export function scenarioMotion(plc, scenario, model) {
  const cylinders = cylindersOf(plc.scene)
  if (!cylinders.length || !scenario) return null
  const compiled = compile(model)
  const world = makeWorld(plc.scene, () => null, plc.electrical, compiled.variables)
  let w = world.init()
  let inputs = { ...Object.fromEntries(compiled.variables.filter((v) => v.type === 'input').map((v) => [v.name, 0])), ...world.inputs(w) }
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  const phase = (s) => [...s.active].sort().join(',')
  let trace = pushMotion([], motionSample(0, w, cylinders, phase(state)))
  let next = 0
  const end = scenario.duration ?? (scenario.events.at(-1)?.t ?? 0) + 1
  for (let t = 0.05; t <= end + 1e-9; t = Math.round((t + 0.05) * 1e6) / 1e6) {
    const r = advanceWorld(compiled, { state, inputs, world: w }, t, { world, scenario, next })
    ;({ state, inputs, next } = r)
    w = r.world
    trace = pushMotion(trace, motionSample(t, w, cylinders, phase(state)))
  }
  return buildSpacePhase(trace, cylinders)
}

