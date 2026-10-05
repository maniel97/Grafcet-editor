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

// Mandos de la planta: pulsado = 1, salvo los de contacto NC y las setas (pulsado = 0).
const CONTROLS = ['button', 'switch', 'emergency']
const isNC = (e) => e.type === 'emergency' || e.contact === 'NC'

export function makeWorld(scene = null, analogRange = () => null, electrical = null, variables = []) {
  const elec = electrical?.components?.length ? electrical : null
  const linked = Boolean(elec?.enabled)
  const withPlc = linked && elec.components.some((c) => c.type === 'plc')
  const inVars = variables.filter((v) => v.type === 'input' && v.address)
  const outVars = variables.filter((v) => v.type === 'output' && v.address)
  const inNames = new Set(variables.filter((v) => v.type === 'input').map((v) => v.name))
  const outNames = new Set(variables.filter((v) => v.type === 'output').map((v) => v.name))
  const controls = (scene?.elements ?? []).filter((e) => CONTROLS.includes(e.type) && e.variable)
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
      const blank = { ...sceneInit(scene), ...(elec ? { elec: elecInit() } : {}) }
      // Con esquema, se calcula ya (sin tiempo ni salidas): el primer ciclo del autómata lee sus
      // entradas como están (un contacto NC, a 1), no todas a 0.
      const fresh = elec ? { ...blank, elec: step(blank, {}, 0).elec } : blank
      if (!current) return fresh
      return { ...fresh, ...current, pos: { ...fresh.pos, ...current.pos }, level: { ...fresh.level, ...current.level } }
    },
    step,
    inputs: (state) => {
      const inputs = sceneInputs(scene, state, analogRange)
      // Conectado y sin autómata: los detectores de los cilindros neumáticos (a0, a1…) llegan al
      // grafcet si hay una entrada con ese nombre.
      if (linked && !withPlc) for (const [name, on] of Object.entries(state.elec?.pneuSignals ?? {})) if (inNames.has(name)) inputs[name] = on
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
    // Mandos de la planta: un escenario los acciona como lo haría una persona, y su señal llega al
    // autómata como siempre (por los cables, si hay esquema). Sin esto, la planta volvía a escribir
    // la entrada con el mando sin pulsar y el escenario solo daba un pulso de un instante.
    // operate(estado, entrada, valor que debe leer el autómata) -> estado; null si no es de un mando.
    operate: (state, name, value) => {
      const own = controls.filter((e) => e.variable === name)
      if (!own.length) return null
      const pressed = { ...state.pressed }
      for (const e of own) pressed[e.id] = isNC(e) ? !Number(value) : Boolean(Number(value))
      return { ...state, pressed }
    },
    // Valor lógico que da el mando de una entrada (para grabar los clics en la planta); null si no hay.
    controlValue: (state, name) => {
      const e = controls.find((x) => x.variable === name)
      return e ? (Boolean(state.pressed?.[e.id]) !== isNC(e) ? 1 : 0) : null
    },
    controlNames: () => [...new Set(controls.map((e) => e.variable))],
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
    // Los eventos de entradas que vienen de un mando de la planta lo accionan (y así se mantienen).
    if (active && world.operate) {
      for (const e of (scenario?.events ?? []).slice(next, r.next)) worldState = world.operate(worldState, e.name, e.value) ?? worldState
    }
    next = r.next
    events.push(...r.events)
    t = to
  } while (t < until - 1e-9)
  return { state, inputs, world: worldState, next, events }
}
