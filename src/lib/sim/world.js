// Mundo de la simulación: lo que rodea al grafcet y produce sus entradas a partir de sus
// salidas. Reúne la planta por elementos (plant.js, plc.plant) y la escena (scene.js, plc.scene).
// Estado: { plant, scene }.
import { PLANT_DT, plantInit, plantInputNames, plantInputs, plantStep } from './plant'
import { sceneInit, sceneInputNames, sceneInputs, sceneStep } from './scene'
import { advanceWithEvents } from './scenario'

export function makeWorld(plant = [], scene = null, analogRange = () => null) {
  const sceneElements = scene?.elements ?? []
  return {
    active: plant.length > 0 || sceneElements.length > 0,
    // Estado inicial; con `current`, conserva lo que ya existe (elementos añadidos al vuelo).
    init: (current) => ({
      plant: { ...plantInit(plant), ...current?.plant },
      scene: current?.scene ? { ...sceneInit(scene), ...current.scene, pos: { ...sceneInit(scene).pos, ...current.scene.pos } } : sceneInit(scene),
    }),
    step: (state, values, dt) => ({ plant: plantStep(plant, state.plant, values, dt), scene: sceneStep(scene, state.scene, values, dt) }),
    inputs: (state) => ({ ...plantInputs(plant, state.plant, analogRange), ...sceneInputs(scene, state.scene) }),
    inputNames: () => new Set([...plantInputNames(plant), ...sceneInputNames(scene)]),
  }
}

// Avanza simulación y mundo hasta `until`: a trozos de PLANT_DT, el mundo se mueve con las
// salidas del trozo anterior y sus sensores son las entradas del siguiente (a velocidades altas
// no se salta ningún final de carrera). Sin mundo, de un salto.
// Devuelve { state, inputs, world, next, events }.
export function advanceWorld(compiled, { state, inputs, world: worldState }, until, { world, scenario, next = 0, options } = {}) {
  const events = []
  const active = world?.active
  let t = state.time
  do {
    const to = active ? Math.min(until, t + PLANT_DT) : until
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
