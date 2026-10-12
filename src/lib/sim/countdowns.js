// Cuenta atrás de las temporizaciones (5s/X2) para pintarla junto a su transición mientras se
// simula. Cambia en cada tick: en vez de pasar por el contexto del editor (que redibujaría todos
// los nodos), va en un almacén pequeño al que solo se suscribe cada transición con temporización.
import { useSyncExternalStore } from 'react'

// Lo que le falta a cada transición: Map id -> texto («1.6 s»). Solo las temporizaciones con su
// etapa activa y aún sin cumplir; si hay varias en una receptividad, la que menos le queda.
export function timerCountdowns(compiled, state) {
  const out = new Map()
  if (!compiled || !state) return out
  for (const t of compiled.transitions) {
    if (!t.ast) continue
    let left = null
    for (const { seconds, step } of timersOf(t.ast)) {
      const id = compiled.stepByLabel.get(String(step))
      if (!state.active.has(id)) continue
      const remaining = seconds - (state.time - (state.activatedAt.get(id) ?? state.time))
      if (remaining > 1e-9 && (left === null || remaining < left)) left = remaining
    }
    // Hacia arriba a la décima: no marca 0.0 mientras aún falta algo.
    if (left !== null) out.set(t.id, `${(Math.ceil(left * 10 - 1e-6) / 10).toFixed(1)} s`)
  }
  return out
}

function timersOf(ast, out = []) {
  if (ast.op === 'timer') out.push(ast)
  for (const k of ['arg', 'left', 'right']) if (ast[k]) timersOf(ast[k], out)
  return out
}

export function createCountdownStore() {
  let current = new Map()
  const listeners = new Set()
  return {
    get: (id) => current.get(id) ?? null,
    set(next) {
      const before = current
      current = next
      // Solo se avisa si cambia algún texto (a la décima, no en cada tick).
      if (next.size === before.size && [...next].every(([k, v]) => before.get(k) === v)) return
      for (const fn of listeners) fn()
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

// Texto de la cuenta atrás de una transición (null si no tiene ninguna en marcha).
const noStore = { get: () => null, subscribe: () => () => {} }
export function useCountdown(store, id) {
  const s = store ?? noStore
  return useSyncExternalStore(s.subscribe, () => s.get(id))
}
