// La CPU S7-200 simulada (s7200cpu.js) conectada al editor: las entradas y salidas de la planta y
// del panel de simulación van por nombre; el programa usa direcciones. La tabla de variables las
// relaciona (dirección de cada variable). Las analógicas, en valor bruto (lib/analog.js).
import { rawRange, toRaw } from '../analog'
import { PlcError, createCpu, parseProgram } from './s7200cpu'

export const SCAN = 0.01 // ciclo de la CPU simulada (s)

const bitAddress = (a) => /^(I|Q|M|V)\d+\.[0-7]$/.test(a)

// Valor bruto -> valor físico (la inversa de toRaw).
function fromRaw(raw, entry) {
  const [r0, r1] = rawRange(entry.signal ?? '4-20mA', 's7200')
  const min = Number(entry.min ?? 0)
  const max = Number(entry.max ?? 100)
  return Math.round((min + ((raw - r0) / (r1 - r0)) * (max - min)) * 100) / 100
}

// variables: las del modelo (name, type, address, analog). Devuelve { errors, warnings, runner }.
export function makeCpuRunner(text, variables) {
  const withAddress = variables.filter((v) => v.address?.trim())
  const byName = new Map(withAddress.map((v) => [v.name.toLowerCase(), v.address.trim().toUpperCase()]))
  const { blocks, errors } = parseProgram(text, (symbol) => byName.get(symbol.toLowerCase()))
  const warnings = []
  const missing = variables.filter((v) => !v.address?.trim() && ['input', 'output', 'analogIn', 'analogOut'].includes(v.type) && v.uses?.length)
  if (missing.length) warnings.push(`Sin dirección (no se conectan con la CPU): ${missing.map((v) => v.name).join(', ')}. Asígnalas en Variables.`)
  if (errors.length) return { errors, warnings, runner: null }

  const cpu = createCpu({ blocks })
  const ins = withAddress.filter((v) => v.type === 'input' || v.type === 'analogIn')
  const outs = withAddress.filter((v) => !(v.type === 'input' || v.type === 'analogIn'))
  const runner = {
    cpu,
    // Un ciclo: entradas (por nombre) -> CPU -> salidas y marcas (por nombre).
    scan(inputs, dt) {
      for (const v of ins) {
        const a = v.address.toUpperCase()
        if (v.type === 'analogIn') cpu.words.set(a, toRaw(Number(inputs[v.name] ?? v.analog?.min ?? 0), v.analog ?? {}, 's7200'))
        else if (bitAddress(a)) cpu.bits.set(a, Boolean(Number(inputs[v.name] ?? 0)))
      }
      cpu.scan(dt)
      const values = { ...inputs }
      for (const v of outs) {
        const a = v.address.toUpperCase()
        if (v.type === 'analogOut') values[v.name] = fromRaw(cpu.words.get(a) ?? 0, v.analog ?? {})
        else if (bitAddress(a)) values[v.name] = cpu.bits.get(a) ? 1 : 0
        else if (/^[TC]\d+$/.test(a)) values[v.name] = a.startsWith('T') ? (cpu.timers.get(a)?.q ? 1 : 0) : (cpu.counters.get(a)?.cv ?? 0)
        else if (/W\d+$/.test(a)) values[v.name] = cpu.words.get(a) ?? 0
      }
      return values
    },
  }
  return { errors, warnings, runner }
}

// Avanza CPU y planta hasta `until` en ciclos de SCAN: la planta se mueve con las salidas del ciclo
// anterior y sus sensores son las entradas del siguiente (como advanceWorld con el grafcet).
// scenario: cambios de entradas del escenario que se reproduce (opcional).
// Devuelve { state, inputs, world, next, error }; state: { time, values, active (vacío)… }.
export function advanceCpu(runner, { state, inputs, world: worldState }, until, { world, scenario, next = 0 } = {}) {
  let t = state.time
  let values = state.values
  const events = scenario?.events ?? []
  try {
    while (t < until - 1e-9) {
      const dt = Math.min(SCAN, until - t)
      t += dt
      while (next < events.length && events[next].t <= t + 1e-9) {
        inputs = { ...inputs, [events[next].name]: events[next].value }
        next++
      }
      if (world?.active) {
        worldState = world.step(worldState, values, dt)
        inputs = { ...inputs, ...world.inputs(worldState) }
      }
      values = runner.scan(inputs, dt)
    }
  } catch (err) {
    if (!(err instanceof PlcError)) throw err
    return { state: { ...state, time: t, values }, inputs, world: worldState, next, error: err.message }
  }
  return { state: { ...state, time: t, values, prev: null }, inputs, world: worldState, next, error: null }
}
