// Mundo de la simulación: la escena de la planta (scene.js, plc.scene), que produce las entradas
// del grafcet a partir de sus salidas. Su estado es el de la escena (y, en `elec`, el del esquema).
// El esquema eléctrico (plc.electrical, lib/elec) se simula siempre que tenga componentes. Conectado
// (plc.electrical.enabled), las señales pasan por sus cables: los mandos y detectores de la planta
// accionan sus contactos, las bobinas, electroválvulas, pilotos y motores mueven la planta y, si hay
// autómata, sus entradas son las que llegan por los cables a sus bornes y sus salidas cierran los
// contactos de los bornes Q.
import { sceneInit, sceneInputNames, sceneInputs, scenePhysical, sceneStep } from './scene'
import { advanceWithEvents } from './scenario'
import { elecAction, elecInit, elecStep } from '../elec/solve'
import { terminalAddress } from '../elec/catalog'

// Paso máximo del mundo: a velocidades altas el tiempo avanza a saltos y se trocea, para que los
// sensores no se salten (p. ej. un final de carrera que se pisa solo un instante).
export const WORLD_DT = 0.05

export function makeWorld(scene = null, analogRange = () => null, electrical = null, variables = []) {
  const elec = electrical?.components?.length ? electrical : null
  const linked = Boolean(elec?.enabled)
  const withPlc = linked && elec.components.some((c) => c.type === 'plc')
  const inVars = variables.filter((v) => v.type === 'input' && v.address)
  const outVars = variables.filter((v) => v.type === 'output' && v.address)
  const outNames = new Set(variables.filter((v) => v.type === 'output').map((v) => v.name))
  // Analógicas: en el esquema van como mA o V (según la señal de cada variable); en la planta y en
  // el grafcet, en unidades físicas. pct: tanto por uno del rango físico.
  const analogIns = variables.filter((v) => v.type === 'analogIn')
  const analogOuts = variables.filter((v) => v.type === 'analogOut' && /^AQW\d+$/i.test(terminalAddress(v.address)))
  const range = (v) => ({ min: Number(v.analog?.min ?? 0), max: Number(v.analog?.max ?? 100), signal: v.analog?.signal ?? '4-20mA' })
  const toPct = (v, value) => {
    const { min, max } = range(v)
    return max === min ? 0 : Math.min(1, Math.max(0, (Number(value) - min) / (max - min)))
  }
  const toSignal = (v, pct) => (range(v).signal === '0-10V' ? { value: 10 * pct, unit: 'V' } : { value: 4 + 16 * pct, unit: 'mA' })
  const step = (state, values, dt) => {
    if (!elec) return sceneStep(scene, state, values, dt)
    const plcOut = {}
    for (const v of outVars) plcOut[terminalAddress(v.address)] = Boolean(Number(values[v.name]))
    const plcOutAnalog = {}
    for (const v of analogOuts) plcOutAnalog[terminalAddress(v.address)] = toSignal(v, toPct(v, values[v.name] ?? range(v).min))
    const sensed = sceneInputs(scene, state, analogRange)
    const analog = Object.fromEntries(analogIns.filter((v) => v.name in sensed).map((v) => [v.name, toPct(v, sensed[v.name])]))
    const r = elecStep(elec, state.elec, { physical: scenePhysical(scene, state), analog, plcOut, plcOutAnalog }, dt)
    // Con autómata, la planta solo se mueve por lo que llega por los cables.
    const driven = withPlc ? Object.fromEntries(Object.entries(values).filter(([k]) => !outNames.has(k))) : values
    const next = sceneStep(scene, state, linked ? { ...driven, ...r.actuators } : values, dt)
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
      // Entradas analógicas por su borne AIW: mA o V -> valor físico (sin señal, el mínimo).
      const plcInAnalog = state.elec?.view?.plcInAnalog ?? {}
      for (const v of analogIns) {
        const addr = terminalAddress(v.address)
        if (!/^AIW\d+$/.test(addr)) continue
        const reading = plcInAnalog[addr]
        const { min, max, signal } = range(v)
        const pct = !reading ? 0 : signal === '0-10V' ? reading.value / 10 : (reading.value - 4) / 16
        inputs[v.name] = Math.round((min + Math.min(1, Math.max(0, pct)) * (max - min)) * 100) / 100
      }
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
