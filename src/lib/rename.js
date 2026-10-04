// Renombrar en todo el diagrama, sustituyendo nombres completos (nunca trozos: renombrar «a»
// no toca «Pieza»). Se usa la misma regla de identificador que la detección de variables
// (lib/symbols.js), así que cambia exactamente lo que el editor considera esa variable.
// - renameVariable: receptividades, acciones (texto y condición), tabla de variables y escenarios.
// - renumberStep: referencias a la etapa (X5, 5s/X5) y forzados F/G..{5} hacia su grafcet.

import { normalizeAction } from './actions'
import { parseForcing } from './forcing'

const KEEP = new Set(['id', 'type', 'text', 'tag', 'ref', 'kind', 'color', 'place'])
const IDENTIFIER = /(?<![\p{L}\p{N}_.])[\p{L}_][\p{L}\p{N}_.]*/gu
const NAME = /^[\p{L}_][\p{L}\p{N}_.]*$/u

export const isValidName = (name) => NAME.test(String(name ?? '').trim())

// Sustituye el identificador `from` por `to` en una expresión.
export function renameInExpression(text, from, to) {
  if (!text) return text
  return String(text).replace(IDENTIFIER, (id) => (id === from ? to : id))
}

// Acción: "Motor" (el texto es el símbolo), "A:=expr" (destino y expresión) o forzado (no cambia).
function renameInAction(raw, from, to) {
  const action = normalizeAction(raw)
  const text = action.text.trim()
  let next = action.text
  if (!parseForcing(text)) {
    const assignment = /^([\p{L}_][\p{L}\p{N}_.]*)(\s*:=\s*)(.*)$/u.exec(text)
    if (assignment) next = `${assignment[1] === from ? to : assignment[1]}${assignment[2]}${renameInExpression(assignment[3], from, to)}`
    else if (text === from) next = to
  }
  const condition = action.condition ? renameInExpression(action.condition, from, to) : action.condition
  if (next === action.text && condition === action.condition) return raw
  return { ...action, text: next, condition }
}

const mapActions = (node, fn) => {
  const actions = node.data.actions ?? []
  const next = actions.map(fn)
  return next.some((a, i) => a !== actions[i]) ? { ...node, data: { ...node.data, actions: next } } : node
}

// Devuelve { nodes, plc, changed } con la variable renombrada (changed: nodos modificados).
export function renameVariable(nodes, plc, from, to) {
  let changed = 0
  const out = nodes.map((n) => {
    let next = n
    if (n.type === 'transition') {
      const condition = renameInExpression(n.data.condition, from, to)
      if (condition !== n.data.condition) next = { ...n, data: { ...n.data, condition } }
    } else if (n.type === 'step') {
      next = mapActions(n, (a) => renameInAction(a, from, to))
    }
    if (next !== n) changed++
    return next
  })
  const variables = { ...plc.variables }
  if (variables[from]) {
    // Los datos de la variable renombrada mandan (una entrada vacía con el nombre nuevo no los borra).
    variables[to] = { ...variables[to], ...variables[from] }
    delete variables[from]
  }
  const scenarios = (plc.scenarios ?? []).map((s) => ({ ...s, events: s.events.map((e) => (e.name === from ? { ...e, name: to } : e)) }))
  // Planta y esquema eléctrico: sus enlaces con las variables van por nombre (variable, extend,
  // motor, signal…). Se cambian los campos que valen el nombre viejo; el texto, el identificador y
  // el tipo, no.
  const relink = (item) => {
    let next = item
    for (const [key, value] of Object.entries(item)) {
      if (KEEP.has(key) || value !== from) continue
      next = next === item ? { ...item } : next
      next[key] = to
    }
    return next
  }
  const scene = plc.scene?.elements ? { ...plc.scene, elements: plc.scene.elements.map(relink) } : plc.scene
  const electrical = plc.electrical?.components ? { ...plc.electrical, components: plc.electrical.components.map(relink) } : plc.electrical
  return {
    nodes: out,
    plc: { ...plc, variables, ...(plc.scenarios ? { scenarios } : {}), ...(plc.scene ? { scene } : {}), ...(plc.electrical ? { electrical } : {}) },
    changed,
  }
}

// Al cambiar el número de una etapa, actualiza lo que se refiere a ella. `grafcetOf(node)` da el
// nombre del grafcet parcial de un nodo (para los forzados F/G2{5}).
export function renumberStep(nodes, stepId, from, to, grafcetOf = () => null) {
  if (!from || !to || from === to) return nodes
  const step = nodes.find((n) => n.id === stepId)
  const grafcet = step ? grafcetOf(step) : null
  const ref = (text) => renameInExpression(text, `X${from}`, `X${to}`)
  return nodes.map((n) => {
    if (n.type === 'transition') {
      const condition = ref(n.data.condition)
      return condition === n.data.condition ? n : { ...n, data: { ...n.data, condition } }
    }
    if (n.type !== 'step') return n
    return mapActions(n, (raw) => {
      const action = normalizeAction(raw)
      const forcing = parseForcing(action.text)
      if (forcing) {
        if (!grafcet || forcing.grafcet !== grafcet || !forcing.steps.includes(String(from))) return raw
        const text = action.text.replace(/\{([^}]*)\}/, (_, body) =>
          `{${body
            .split(',')
            .map((s) => (s.trim().replace(/^X/i, '') === String(from) ? s.replace(String(from), String(to)) : s))
            .join(',')}}`,
        )
        return { ...action, text }
      }
      const text = action.text.includes(':=') ? action.text.replace(/(:=)(.*)$/, (_, op, expr) => op + ref(expr)) : action.text
      const condition = action.condition ? ref(action.condition) : action.condition
      return text === action.text && condition === action.condition ? raw : { ...action, text, condition }
    })
  })
}
