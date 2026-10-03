// Planta virtual: elementos sencillos que leen las salidas del grafcet y producen sus entradas,
// para probar sin ir pulsando finales de carrera. Puro: se prueba sin navegador.
//
import { advanceWithEvents } from './scenario'

// Configuración (plc.plant): [{ id, type, name, ...variables y tiempos }]
//   cylinder: extend (salida A+), retract (A−; vacía = simple efecto con muelle),
//             retracted (a0), extended (a1), time (s de carrera)
//   conveyor: motor, sensor (pieza al final), entry (pieza al principio, opcional), time (s de
//             recorrido); las piezas se añaden a mano («Nueva pieza») y caen al pasar del final
//   tank:     fill (válvula de llenado), drain (de vaciado), low / high (sensores de nivel),
//             level (entrada analógica, opcional), fillTime / drainTime (s de vacío a lleno)
//   lamp:     output (solo se dibuja)
// Estado: { [id]: { pos } | { pieces: [pos] } | { level } } con posiciones y nivel de 0 a 1.

export const PLANT_TYPES = {
  cylinder: {
    label: 'Cilindro',
    defaults: { extend: '', retract: '', retracted: '', extended: '', time: 1 },
    outputs: ['extend', 'retract'],
    inputs: ['retracted', 'extended'],
  },
  conveyor: {
    label: 'Cinta transportadora',
    defaults: { motor: '', sensor: '', entry: '', time: 3 },
    outputs: ['motor'],
    inputs: ['sensor', 'entry'],
  },
  tank: {
    label: 'Depósito',
    defaults: { fill: '', drain: '', low: '', high: '', level: '', fillTime: 10, drainTime: 10, initial: 0 },
    outputs: ['fill', 'drain'],
    inputs: ['low', 'high', 'level'],
  },
  lamp: { label: 'Lámpara', defaults: { output: '' }, outputs: ['output'], inputs: [] },
}

// Zonas de los sensores (fracción de recorrido o de nivel).
const END = 0.999
const CONVEYOR_SENSOR = 0.85 // la pieza tapa el sensor final desde aquí hasta el final
const CONVEYOR_ENTRY = 0.1
const TANK_LOW = 0.1
const TANK_HIGH = 0.9

const on = (values, name) => Boolean(name) && Number(values[name] ?? 0) !== 0
const clamp = (x) => Math.min(1, Math.max(0, x))

export function plantInit(elements = []) {
  const state = {}
  for (const e of elements) {
    if (e.type === 'cylinder') state[e.id] = { pos: 0 }
    if (e.type === 'conveyor') state[e.id] = { pieces: [] }
    if (e.type === 'tank') state[e.id] = { level: clamp(Number(e.initial) || 0) }
  }
  return state
}

// Avanza la planta `dt` segundos con las salidas actuales del grafcet (`values`).
export function plantStep(elements = [], state, values, dt) {
  if (!(dt > 0)) return state
  const next = { ...state }
  for (const e of elements) {
    const s = state[e.id]
    // Avería «atascado»: no se mueve (ni el vástago, ni la cinta, ni el nivel).
    if (!s || s.fault === 'stuck') continue
    if (e.type === 'cylinder') {
      const out = on(values, e.extend)
      // Simple efecto (sin A−): vuelve con el muelle en cuanto se quita A+.
      const back = e.retract ? on(values, e.retract) : !out
      const speed = dt / Math.max(0.05, Number(e.time) || 1)
      const dir = out && !back ? 1 : back && !out ? -1 : 0
      if (dir) next[e.id] = { ...s, pos: clamp(s.pos + dir * speed) }
    }
    if (e.type === 'conveyor' && on(values, e.motor)) {
      const speed = dt / Math.max(0.1, Number(e.time) || 3)
      next[e.id] = { ...s, pieces: s.pieces.map((p) => p + speed).filter((p) => p <= 1) }
    }
    if (e.type === 'tank') {
      const filling = on(values, e.fill) ? dt / Math.max(0.1, Number(e.fillTime) || 10) : 0
      const draining = on(values, e.drain) ? dt / Math.max(0.1, Number(e.drainTime) || 10) : 0
      if (filling || draining) next[e.id] = { ...s, level: clamp(s.level + filling - draining) }
    }
  }
  return next
}

// Entradas que produce la planta. `analogRange(name)` -> { min, max } de una analógica.
export function plantInputs(elements = [], state, analogRange = () => null) {
  const inputs = {}
  let broken = null
  // Avería «sensor roto» (fault 'sensor:clave'): ese sensor da siempre 0.
  const set = (name, value, key) => {
    if (name) inputs[name] = broken === key ? 0 : value
  }
  for (const e of elements) {
    const s = state[e.id]
    if (!s) continue
    broken = s.fault?.startsWith('sensor:') ? s.fault.slice('sensor:'.length) : null
    if (e.type === 'cylinder') {
      set(e.retracted, s.pos <= 1 - END ? 1 : 0, 'retracted')
      set(e.extended, s.pos >= END ? 1 : 0, 'extended')
    }
    if (e.type === 'conveyor') {
      set(e.sensor, s.pieces.some((p) => p >= CONVEYOR_SENSOR) ? 1 : 0, 'sensor')
      set(e.entry, s.pieces.some((p) => p <= CONVEYOR_ENTRY) ? 1 : 0, 'entry')
    }
    if (e.type === 'tank') {
      set(e.low, s.level >= TANK_LOW ? 1 : 0, 'low')
      set(e.high, s.level >= TANK_HIGH ? 1 : 0, 'high')
      if (e.level && broken !== 'level') {
        const range = analogRange(e.level) ?? { min: 0, max: 100 }
        inputs[e.level] = Math.round((range.min + s.level * (range.max - range.min)) * 100) / 100
      }
    }
  }
  return inputs
}

// Nombres de las entradas que gobierna la planta (no se cambian a mano mientras simula).
export function plantInputNames(elements = []) {
  const names = new Set()
  for (const e of elements) for (const key of PLANT_TYPES[e.type]?.inputs ?? []) if (e[key]) names.add(e[key])
  return names
}

// Acciones manuales sobre la planta: nueva pieza en una cinta, quitar la del final.
export function plantAction(state, id, action) {
  const s = state[id]
  if (!s?.pieces) return state
  if (action === 'add-piece' && !s.pieces.some((p) => p <= CONVEYOR_ENTRY)) return { ...state, [id]: { ...s, pieces: [...s.pieces, 0] } }
  if (action === 'remove-piece') return { ...state, [id]: { ...s, pieces: s.pieces.filter((p) => p < CONVEYOR_SENSOR) } }
  return state
}

// Averías que se pueden provocar en un elemento (solo durante la simulación, no se guardan):
// [{ id, label }]. 'stuck' = atascado; 'sensor:clave' = ese sensor roto (da siempre 0).
export function plantFaults(element) {
  const type = PLANT_TYPES[element.type]
  if (!type || element.type === 'lamp') return []
  const stuck = { cylinder: 'Cilindro atascado', conveyor: 'Cinta atascada', tank: 'Válvulas atascadas' }[element.type]
  const sensors = type.inputs.filter((key) => element[key]).map((key) => ({ id: `sensor:${key}`, label: `Sensor ${element[key]} roto` }))
  return [{ id: 'stuck', label: stuck }, ...sensors]
}
export const setPlantFault = (state, id, fault) => (state[id] ? { ...state, [id]: { ...state[id], fault: fault || null } } : state)

// Propone elementos a partir de los nombres de las variables (convenio de la neumática): cada
// salida «A+» con, si existen, «A−», «a0» y «a1» es un cilindro (sin «A−», de simple efecto).
// No repite los que ya usan esa salida.
export function detectPlant(variables, existing = []) {
  const names = new Set(variables.map((v) => v.name))
  const used = new Set(existing.flatMap((e) => Object.values(e)))
  const pick = (...options) => options.find((o) => names.has(o)) ?? ''
  const found = []
  for (const v of variables) {
    if (!v.name.endsWith('+') || used.has(v.name)) continue
    const n = v.name.slice(0, -1)
    if (!/^[A-Za-z]\w*$/.test(n)) continue
    found.push({
      id: `p${n}`,
      type: 'cylinder',
      name: n,
      ...PLANT_TYPES.cylinder.defaults,
      extend: v.name,
      retract: pick(`${n}-`, `${n}−`),
      retracted: pick(`${n.toLowerCase()}0`, `${n}0`),
      extended: pick(`${n.toLowerCase()}1`, `${n}1`),
    })
  }
  return found
}

// Paso máximo de la planta: a velocidades altas el tiempo avanza a saltos y se trocea, para que
// los sensores no se salten (p. ej. un final de carrera que se pisa solo un instante).
export const PLANT_DT = 0.05

// Avanza simulación y planta hasta `until`: a trozos de PLANT_DT, la planta se mueve con las
// salidas del trozo anterior y sus sensores son las entradas del siguiente. Sin planta, de un
// salto (como antes). Devuelve { state, inputs, plant, next, events }.
export function advanceWithPlant(compiled, { state, inputs, plant }, until, { elements = [], analogRange, scenario, next = 0, options } = {}) {
  const events = []
  let t = state.time
  do {
    const to = elements.length ? Math.min(until, t + PLANT_DT) : until
    if (elements.length) {
      plant = plantStep(elements, plant, state.values, to - t)
      inputs = { ...inputs, ...plantInputs(elements, plant, analogRange) }
    }
    const r = advanceWithEvents(compiled, state, inputs, to, scenario, next, options)
    state = r.state
    inputs = r.inputs
    next = r.next
    events.push(...r.events)
    t = to
  } while (t < until - 1e-9)
  return { state, inputs, plant, next, events }
}
