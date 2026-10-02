import { normalizeAction } from './actions'

// Detección de las variables que usa el grafcet, para la tabla de variables:
// - receptividades y condiciones de acción -> entradas (identificadores)
// - temporizaciones "5s/X2"                 -> temporizadores (con su preselección y etapa)
// - acciones "Motor ON", "A+"               -> salidas (el texto completo es el símbolo)
// - acciones de asignación "A:=1", "C:=C+1" -> marcas (la variable de la izquierda)
// "X2" se refiere a la etapa 2 (su variable de etapa), no es un símbolo propio.

const KEYWORDS = new Set(['AND', 'OR', 'NOT', 'XOR', 'TRUE', 'FALSE', 'Y', 'O'])
const TIMER = /(\d+(?:[.,]\d+)?)\s*(ms|s|min|h)\s*\/\s*X\s*([\p{L}\p{N}_.]+)/giu
// No debe ir pegado a una cifra: en "5s" la "s" es la unidad, no una variable.
const IDENTIFIER = /(?<![\p{L}\p{N}_.])[\p{L}_][\p{L}\p{N}_.]*/gu
const STEP_VARIABLE = /^X[\p{N}]/u

// Clave estable de un temporizador: "5s/X2".
export const timerKey = (value, unit, step) => `${value.replace(',', '.')}${unit.toLowerCase()}/X${step}`

// Símbolos de una expresión booleana (receptividad o condición de acción).
export function parseExpression(text) {
  const timers = []
  const rest = String(text ?? '').replace(TIMER, (_, value, unit, step) => {
    timers.push({ key: timerKey(value, unit, step), preset: `${value.replace(',', '.')}${unit.toLowerCase()}`, step })
    return ' '
  })
  const inputs = (rest.match(IDENTIFIER) ?? []).filter((id) => !KEYWORDS.has(id.toUpperCase()) && !STEP_VARIABLE.test(id))
  return { inputs: [...new Set(inputs)], timers }
}

// La misma expresión con cada símbolo sustituido por su dirección (lo que no tiene dirección
// se deja tal cual). "Marcha · 5s/X1" -> "I0.0 · T1". `lookup` = { symbol(name), step(label) }.
export function addressExpression(text, lookup) {
  return String(text ?? '')
    .replace(TIMER, (match, value, unit, step) => lookup.symbol(timerKey(value, unit, step)) || match)
    .replace(IDENTIFIER, (id) => {
      const stepRef = /^X([\p{L}\p{N}_.]+)$/u.exec(id)
      if (stepRef) return lookup.step(stepRef[1]) || id
      if (KEYWORDS.has(id.toUpperCase())) return id
      return lookup.symbol(id) || id
    })
}

// Variable que gobierna una acción.
export function actionSymbol(action) {
  const { text } = normalizeAction(action)
  const trimmed = text.trim()
  if (!trimmed) return null
  const assignment = /^([\p{L}_][\p{L}\p{N}_.]*)\s*:=/u.exec(trimmed)
  return assignment ? { symbol: assignment[1], type: 'memory' } : { symbol: trimmed, type: 'output' }
}

// Recorre el diagrama y devuelve Map símbolo -> { type, uses: Set<nodeId>, preset?, step? }
// El orden del Map es el de aparición (de arriba abajo), útil para asignar direcciones.
export function extractSymbols(nodes) {
  const found = new Map()
  const add = (symbol, type, nodeId, extra = {}) => {
    const entry = found.get(symbol) ?? { type, uses: new Set(), ...extra }
    entry.uses.add(nodeId)
    found.set(symbol, entry)
  }
  const addExpression = (text, nodeId) => {
    const { inputs, timers } = parseExpression(text)
    for (const t of timers) add(t.key, 'timer', nodeId, { preset: t.preset, step: t.step })
    for (const id of inputs) add(id, 'input', nodeId)
  }

  const ordered = [...nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
  for (const n of ordered) {
    if (n.type === 'transition') addExpression(n.data.condition, n.id)
    if (n.type !== 'step') continue
    for (const raw of n.data.actions ?? []) {
      const action = normalizeAction(raw)
      const target = actionSymbol(action)
      if (target) add(target.symbol, target.type, n.id)
      if (action.kind === 'conditional' || action.kind === 'event') addExpression(action.condition, n.id)
    }
  }
  return found
}

// Variables del proyecto: las detectadas en el diagrama más las añadidas a mano en la tabla
// que aún no se usan (van al final, con `uses` vacío). Es lo que muestran y gestionan la tabla,
// la asignación automática, las comprobaciones y el modelo para PLC.
export function projectVariables(nodes, plcVariables = {}) {
  const found = extractSymbols(nodes)
  for (const [name, entry] of Object.entries(plcVariables)) {
    if (!found.has(name)) found.set(name, { type: entry.type ?? 'input', uses: new Set(), preset: entry.preset })
  }
  return found
}
