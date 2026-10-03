// Mundo de la simulación: la escena de la planta (scene.js, plc.scene), que produce las entradas
// del grafcet a partir de sus salidas. Su estado es el de la escena.
import { sceneInit, sceneInputNames, sceneInputs, sceneStep } from './scene'
import { advanceWithEvents } from './scenario'

// Paso máximo del mundo: a velocidades altas el tiempo avanza a saltos y se trocea, para que los
// sensores no se salten (p. ej. un final de carrera que se pisa solo un instante).
export const WORLD_DT = 0.05

export function makeWorld(scene = null, analogRange = () => null) {
  return {
    active: (scene?.elements?.length ?? 0) > 0,
    // Estado inicial; con `current`, conserva lo que ya existe (elementos añadidos al vuelo).
    init: (current) => {
      const fresh = sceneInit(scene)
      if (!current) return fresh
      return { ...fresh, ...current, pos: { ...fresh.pos, ...current.pos }, level: { ...fresh.level, ...current.level } }
    },
    step: (state, values, dt) => sceneStep(scene, state, values, dt),
    inputs: (state) => sceneInputs(scene, state, analogRange),
    inputNames: () => sceneInputNames(scene),
  }
}

// Avanza simulación y mundo hasta `until`: a trozos de WORLD_DT, el mundo se mueve con las
// salidas del trozo anterior y sus sensores son las entradas del siguiente. Sin mundo, de un salto.
// Devuelve { state, inputs, world, next, events }.
export function advanceWorld(compiled, { state, inputs, world: worldState }, until, { world, scenario, next = 0, options } = {}) {
  const events = []
  const active = world?.active
  let t = state.time
  do {
    const to = active ? Math.min(until, t + WORLD_DT) : until
    if (active) {
      worldState = world.step(worldState, state.values, to - t)
      inputs = { ...inputs, ...world.inputs(worldState) }
    }
    const r = advanceWithEvents(compiled, state, inputs, to, scenario, next, options)
    state = r.state
    inputs = r.inputs
    next = r.next
    events.push(...r.events)
    t = to
  } while (t < until - 1e-9)
  return { state, inputs, world: worldState, next, events }
}
