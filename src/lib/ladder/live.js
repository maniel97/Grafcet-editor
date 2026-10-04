// Ladder en vivo: estado de cada contacto y de cada segmento con la situación de la simulación,
// como lo vería el autómata al final de un ciclo. Puro: se prueba sin navegador.
//
// - Contactos de variables, etapas y temporizaciones: con los valores de la simulación.
// - Marcas internas (Tr de transición, Aux de expresiones): el valor de su propio segmento.
// - Flancos (P/N) y primer ciclo: duran un solo ciclo; en una situación estable, abiertos.
import { withMacros } from '../sim/engine'
import { truthy } from '../sim/expression'

const CMP = {
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '=': (a, b) => a === b,
  '<>': (a, b) => a !== b,
}

// Devuelve { closed(nodo de la red) -> true | false | null, energized(segmento) -> boolean }.
export function ladderLive(ladder, compiled, state) {
  const active = withMacros(compiled, state.active)
  const stepId = (label) => compiled.stepByLabel.get(String(label))
  const rungs = ladder.sections.flatMap((s) => s.rungs)
  // Segmento que calcula cada marca interna (su bobina).
  const markRung = new Map()
  for (const r of rungs) {
    for (const o of r.outputs) {
      if (o.type === 'coil' && (o.operand.kind === 'trans' || o.operand.kind === 'aux')) markRung.set(`${o.operand.kind}:${o.operand.name}`, r)
    }
  }
  const marks = new Map()

  const operand = (op) => {
    switch (op.kind) {
      case 'var':
        return truthy(state.values[op.name] ?? 0)
      case 'step':
        return active.has(stepId(op.label))
      case 'timer': {
        // TON de una temporización t1/a/t2: a lleva `seconds` a 1 (o a 0, el de la bajada).
        if (op.delay) {
          const d = state.delays?.get(op.delay)
          return Boolean(d) && d.input !== op.falling && state.time - d.since >= op.seconds - 1e-9
        }
        const id = stepId(op.step)
        return state.active.has(id) && state.time - (state.activatedAt.get(id) ?? state.time) >= op.seconds - 1e-9
      }
      case 'trans':
      case 'aux': {
        // Marca de una temporización t1/a/t2 (con S y R, no con bobina): su salida.
        if (op.delay) return Boolean(state.delays?.get(op.delay)?.out)
        const key = `${op.kind}:${op.name}`
        if (!marks.has(key)) {
          marks.set(key, false) // por si hubiera un ciclo
          const r = markRung.get(key)
          marks.set(key, r ? network(r.network) : false)
        }
        return marks.get(key)
      }
      default:
        return false
    }
  }
  // Valor numérico de un operando de una comparación (las analógicas, en unidades físicas).
  const numeric = (op) => (op.kind === 'num' ? (op.physical ?? op.value) : Number(state.values[op.name] ?? 0))

  const closed = (node) => {
    switch (node.type) {
      case 'contact':
        if (node.kind === 'NO') return operand(node.operand)
        if (node.kind === 'NC') return !operand(node.operand)
        if (node.kind === 'P' || node.kind === 'N') return false
        return null
      case 'compare':
        return CMP[node.op]?.(numeric(node.a), numeric(node.b)) ?? null
      default:
        return null
    }
  }
  const network = (net) => {
    switch (net.type) {
      case 'series':
        return net.items.every(network)
      case 'parallel':
        return net.items.some(network)
      case 'not':
        return !network(net.item)
      case 'true':
        return true
      case 'false':
        return false
      default:
        return Boolean(closed(net))
    }
  }
  return { closed, energized: (rung) => network(rung.network) }
}
