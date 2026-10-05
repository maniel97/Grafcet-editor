// Editor de formas de onda de los escenarios: pasar los cambios de entradas de un escenario
// ({ t, name, value }) a valores por casilla de tiempo, pintarlos y volver. Puro: se prueba sin
// navegador. Las entradas empiezan a 0 salvo las que el escenario diga en t = 0.

export const STEP = 0.1 // s: resolución del editor

const cells = (duration) => Math.max(1, Math.round(duration / STEP))

// Escenario -> { [entrada]: [0|1 por casilla] }.
export function seriesOf(scenario, inputs, initial = {}) {
  const n = cells(scenario.duration ?? 10)
  const out = {}
  for (const name of inputs) {
    const row = new Array(n).fill(initial[name] ? 1 : 0)
    for (const e of (scenario.events ?? []).filter((x) => x.name === name).sort((a, b) => a.t - b.t)) {
      const from = Math.max(0, Math.round(e.t / STEP))
      for (let i = from; i < n; i++) row[i] = e.value ? 1 : 0
    }
    out[name] = row
  }
  return out
}

// Pintar en una fila: de la casilla `a` a la `b` (incluidas, en cualquier orden) con `value`.
export function paint(row, a, b, value) {
  const [from, to] = a <= b ? [a, b] : [b, a]
  return row.map((v, i) => (i >= from && i <= to ? value : v))
}

// { [entrada]: fila } -> eventos del escenario (solo los cambios respecto a `initial`).
export function eventsOf(series, initial = {}) {
  const events = []
  for (const [name, row] of Object.entries(series)) {
    let value = initial[name] ? 1 : 0
    row.forEach((v, i) => {
      if (v !== value) {
        events.push({ t: Math.round(i * STEP * 10) / 10, name, value: v })
        value = v
      }
    })
  }
  return events.sort((a, b) => a.t - b.t || a.name.localeCompare(b.name))
}

// Cambiar la duración: las filas se recortan o se alargan con su último valor.
export function resize(series, duration) {
  const n = cells(duration)
  return Object.fromEntries(Object.entries(series).map(([name, row]) => [name, Array.from({ length: n }, (_, i) => row[Math.min(i, row.length - 1)] ?? 0)]))
}
