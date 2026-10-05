import { evolve } from './engine'

// Escenarios de prueba de la simulación: secuencias de cambios de entradas con su instante,
//   { id, name, duration, events: [{ t, name, value }] }
// Se graban desde el panel de simulación y se guardan en el proyecto (plc.scenarios).

// Añade un cambio de entrada a una grabación (sin repetir el valor que ya tenía). previous: el
// valor antes de grabar nada de esa entrada (1 en un pulsador NC o una seta sin pulsar).
export function recordEvent(events, t, name, value, previous = 0) {
  const last = events.findLast((e) => e.name === name)
  if ((last?.value ?? previous) === value) return events
  return [...events, { t: Math.round(t * 1000) / 1000, name, value }]
}

// Avanza la simulación hasta `time` aplicando por orden los cambios de entradas pendientes:
// se evoluciona hasta el instante de cada cambio antes de aplicarlo, así una pulsación corta no
// se pierde aunque el tiempo avance a saltos (velocidades altas).
// Devuelve { state, inputs, next, events } (events: franqueos producidos, en orden).
export function advanceWithEvents(compiled, state, inputs, time, scenario, next = 0, options) {
  const fired = []
  let current = state
  let currentInputs = inputs
  let index = next
  const events = scenario?.events ?? []
  while (index < events.length && events[index].t <= time) {
    const event = events[index]
    const step = evolve(compiled, current, currentInputs, Math.max(event.t, current.time))
    fired.push(...step.events)
    current = step.state
    currentInputs = { ...currentInputs, [event.name]: event.value }
    index++
  }
  const step = evolve(compiled, current, currentInputs, time, options)
  fired.push(...step.events)
  return { state: step.state, inputs: currentInputs, next: index, events: fired }
}

// Instantes en que cambia cada señal binaria a lo largo de un escenario completo, sin tiempo real
// (para pruebas y para comprobar un diseño de golpe). dt: paso de las temporizaciones.
export function runScenario(compiled, initial, scenario, { dt = 0.05 } = {}) {
  let state = initial.state
  let inputs = initial.inputs
  let next = 0
  const fired = []
  const end = scenario.duration ?? (scenario.events.at(-1)?.t ?? 0) + 1
  for (let t = 0; t <= end + 1e-9; t = Math.round((t + dt) * 1e6) / 1e6) {
    const r = advanceWithEvents(compiled, state, inputs, t, scenario, next)
    ;({ state, inputs, next } = r)
    fired.push(...r.events)
  }
  return { state, inputs, events: fired }
}

// Cronograma en CSV: una fila por cambio, una columna por señal.
export function chronogramCsv(samples, signals) {
  const rows = [['t (s)', ...signals.map((s) => s.name)]]
  for (const sample of samples) rows.push([sample.t.toFixed(3), ...signals.map((s) => sample.values[s.name] ?? 0)])
  return rows.map((r) => r.join(';')).join('\r\n')
}
