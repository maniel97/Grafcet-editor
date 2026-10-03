// Mundo de la simulación: la escena de la planta (scene.js, plc.scene), que produce las entradas
// del grafcet a partir de sus salidas. Su estado es el de la escena (y, en `elec`, el del esquema).
// Con el esquema eléctrico activado (plc.electrical.enabled, lib/elec), las señales pasan por los
// cables: los mandos y detectores de la planta accionan sus contactos del esquema, las bobinas,
// electroválvulas, pilotos y motores mueven la planta y, si hay autómata, sus entradas son las que
// llegan por los cables a sus bornes y sus salidas cierran los contactos de los bornes Q.
import { sceneInit, sceneInputNames, sceneInputs, scenePhysical, sceneStep } from './scene'
import { advanceWithEvents } from './scenario'
import { elecAction, elecInit, elecStep } from '../elec/solve'
import { terminalAddress } from '../elec/catalog'

// Paso máximo del mundo: a velocidades altas el tiempo avanza a saltos y se trocea, para que los
// sensores no se salten (p. ej. un final de carrera que se pisa solo un instante).
export const WORLD_DT = 0.05

export function makeWorld(scene = null, analogRange = () => null, electrical = null, variables = []) {
  const elec = electrical?.enabled && electrical.components?.length ? electrical : null
  const withPlc = Boolean(elec?.components.some((c) => c.type === 'plc'))
  const inVars = variables.filter((v) => v.type === 'input' && v.address)
  const outVars = variables.filter((v) => v.type === 'output' && v.address)
  const outNames = new Set(variables.filter((v) => v.type === 'output').map((v) => v.name))
  const step = (state, values, dt) => {
    if (!elec) return sceneStep(scene, state, values, dt)
    const plcOut = {}
    for (const v of outVars) plcOut[terminalAddress(v.address)] = Boolean(Number(values[v.name]))
    const r = elecStep(elec, state.elec, { physical: scenePhysical(scene, state), plcOut }, dt)
    // Con autómata, la planta solo se mueve por lo que llega por los cables.
    const driven = withPlc ? Object.fromEntries(Object.entries(values).filter(([k]) => !outNames.has(k))) : values
    const next = sceneStep(scene, state, { ...driven, ...r.actuators }, dt)
    return { ...next, elec: r.state }
  }
  return {
    active: (scene?.elements?.length ?? 0) > 0 || Boolean(elec),
    electrical: elec,
    // Estado inicial; con `current`, conserva lo que ya existe (elementos añadidos al vuelo).
    init: (current) => {
      const fresh = { ...sceneInit(scene), ...(elec ? { elec: elecInit() } : {}) }
      if (!current) return fresh
      return { ...fresh, ...current, pos: { ...fresh.pos, ...current.pos }, level: { ...fresh.level, ...current.level } }
    },
    step,
    inputs: (state) => {
      const inputs = sceneInputs(scene, state, analogRange)
      if (!withPlc) return inputs
      const plcIn = state.elec?.view?.plcIn ?? {}
      for (const v of inVars) inputs[v.name] = plcIn[terminalAddress(v.address)] ? 1 : 0
      return inputs
    },
    inputNames: () => sceneInputNames(scene),
    // Acción sobre el esquema (pulsar, conmutar, disparar…), con el esquema recalculado al momento.
    elecDo: (state, id, action, values) => (elec ? step({ ...state, elec: elecAction(elec, state.elec, id, action) }, values, 0) : state),
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
