// Comparar comportamientos (ejercicios, fase 2). Puro: se prueba sin navegador.
//
// La solución del profesor y la del alumno se ejecutan con el mismo escenario de prueba
// (lib/sim/scenarioMotion.js runScenarioWorld). Se compara lo que se ve desde fuera, no el dibujo:
// cuándo cambia cada salida (con un margen de tiempo) y cuántas piezas acaban en cada recogida.
// Las etapas no se comparan: dos grafcets correctos pueden numerarlas distinto.
import { language, t } from './i18n'

export const DEFAULT_TOLERANCE = 0.5 // s

// Cambios de una señal: { initial: 0 | 1, times: [instantes en que cambia] }.
export function edgesOf(samples, name) {
  const initial = samples[0]?.values[name] ?? 0
  const times = []
  let value = initial
  for (const s of samples) {
    const v = s.values[name] ?? 0
    if (v !== value) {
      times.push(Math.round(s.t * 100) / 100)
      value = v
    }
  }
  return { initial, times }
}

// Lo esperado, a partir de la ejecución de la solución: las salidas elegidas y las recogidas.
export function expectedFrom(run, outputs, sinks = {}) {
  const names = outputs?.length ? outputs : run.compiled.variables.filter((v) => v.type === 'output').map((v) => v.name)
  return {
    outputs: Object.fromEntries(names.map((name) => [name, edgesOf(run.samples, name)])),
    counts: Object.fromEntries(Object.keys(sinks).map((id) => [id, run.counts[id] ?? 0])),
    sinks, // id -> nombre visible
  }
}

// Segundos con una cifra decimal, con la coma o el punto del idioma elegido.
const fmt = (s) => (Math.round(s * 10) / 10).toLocaleString(language(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
// Qué pasa en el cambio número i de una señal que empieza en `initial`.
const turnsOn = (initial, i) => (initial + i + 1) % 2 === 1

// Ejecución del alumno frente a lo esperado -> { ok, problems: [{ t, text }] } (en orden de tiempo).
export function compareBehaviour(expected, run, tolerance = DEFAULT_TOLERANCE) {
  const problems = []
  for (const [name, want] of Object.entries(expected.outputs)) {
    const got = edgesOf(run.samples, name)
    if (got.initial !== want.initial) {
      problems.push({
        t: 0,
        text: want.initial
          ? t('{salida}: al empezar debería estar encendida y está apagada.', { salida: name })
          : t('{salida}: al empezar debería estar apagada y está encendida.', { salida: name }),
      })
      continue
    }
    const n = Math.max(want.times.length, got.times.length)
    for (let i = 0; i < n; i++) {
      const on = turnsOn(want.initial, i)
      const tw = want.times[i]
      const tg = got.times[i]
      if (tg === undefined) {
        problems.push({
          t: tw,
          text: on
            ? t('{salida}: debería encenderse hacia {tiempo} s y no se enciende.', { salida: name, tiempo: fmt(tw) })
            : t('{salida}: debería apagarse hacia {tiempo} s y no se apaga.', { salida: name, tiempo: fmt(tw) }),
        })
        break
      }
      if (tw === undefined) {
        problems.push({
          t: tg,
          text: on
            ? t('{salida}: se enciende a {tiempo} s y no debería.', { salida: name, tiempo: fmt(tg) })
            : t('{salida}: se apaga a {tiempo} s y no debería.', { salida: name, tiempo: fmt(tg) }),
        })
        break
      }
      if (Math.abs(tg - tw) > tolerance + 1e-9) {
        problems.push({
          t: Math.min(tg, tw),
          text: on
            ? t('{salida}: se enciende a {tiempo} s; se esperaba hacia {esperado} s.', { salida: name, tiempo: fmt(tg), esperado: fmt(tw) })
            : t('{salida}: se apaga a {tiempo} s; se esperaba hacia {esperado} s.', { salida: name, tiempo: fmt(tg), esperado: fmt(tw) }),
        })
        break
      }
    }
  }
  for (const [id, want] of Object.entries(expected.counts ?? {})) {
    const got = run.counts[id] ?? 0
    if (got !== want) {
      problems.push({
        t: Infinity, // se ve al final
        text: t('{recogida}: llegan {n} piezas; se esperaban {esperadas}.', { recogida: expected.sinks?.[id] ?? id, n: got, esperadas: want }),
      })
    }
  }
  problems.sort((a, b) => a.t - b.t)
  return { ok: problems.length === 0, problems }
}
