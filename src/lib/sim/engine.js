// Motor de simulación de grafcet según las reglas de evolución de IEC 60848.
//
// 1. Situación inicial: solo las etapas iniciales están activas.
// 2. Una transición está validada si todas sus etapas anteriores están activas.
// 3. Se franquea si está validada y su receptividad es verdadera.
// 4. Al franquearla se activan las etapas siguientes y se desactivan las anteriores.
// 5. Las transiciones franqueables a la vez se franquean simultáneamente.
// 6. Si una etapa se activa y se desactiva a la vez, queda activa.
// Evolución fugaz: tras franquear se vuelve a evaluar (con las mismas entradas) hasta llegar a
// una situación estable. Las acciones continuas solo se emiten en situación estable; las
// memorizadas (en la activación / desactivación) se ejecutan aunque la situación sea fugaz.
//
// Todo es puro: compile() prepara el modelo y evolve() calcula el estado siguiente.

import { normalizeAction } from '../actions'
import { actionSymbol } from '../symbols'
import { ExpressionError, evaluate, evaluateArithmetic, parseAssignment, parseCondition, truthy } from './expression'

const MAX_ITERATIONS = 100

const tryParse = (fn, text, errors, where) => {
  try {
    return fn(text)
  } catch (err) {
    if (!(err instanceof ExpressionError)) throw err
    errors.push({ nodeId: where.nodeId, message: `${where.label}: ${err.message}` })
    return null
  }
}

// Prepara el modelo de buildPlcModel para simular: receptividades y acciones ya interpretadas.
// Las expresiones con errores se anotan en `errors` y se tratan como falsas.
export function compile(model) {
  const errors = []
  const stepByLabel = new Map(model.steps.map((s) => [String(s.label), s.id]))

  const steps = model.steps.map((s) => ({
    ...s,
    actions: s.actions.map((a, i) => {
      const action = normalizeAction(a)
      const where = { nodeId: s.id, label: `Etapa ${s.label}, acción ${i + 1}` }
      const needsCondition = action.kind === 'conditional' || action.kind === 'event'
      return {
        ...action,
        symbol: actionSymbol(action)?.symbol ?? null,
        assignment: tryParse(parseAssignment, action.text, errors, where),
        conditionAst: needsCondition && action.condition?.trim() ? tryParse(parseCondition, action.condition, errors, where) : null,
      }
    }),
  }))

  const transitions = model.transitions.map((t) => ({
    ...t,
    ast: tryParse(parseCondition, t.condition, errors, { nodeId: t.id, label: `Transición «${t.condition || '(vacía)'}»` }),
  }))

  // Salidas gobernadas por acciones continuas o condicionadas: se recalculan en cada ciclo.
  const driven = new Set()
  for (const s of steps) {
    for (const a of s.actions) {
      if (!a.assignment && a.symbol && (a.kind === 'continuous' || a.kind === 'conditional')) driven.add(a.symbol)
    }
  }

  return { steps, transitions, stepByLabel, driven, variables: model.variables, errors }
}

export function initialState(compiled) {
  const active = new Set(compiled.steps.filter((s) => s.initial).map((s) => s.id))
  const values = {}
  for (const v of compiled.variables) values[v.name] = 0
  return {
    time: 0,
    active,
    activatedAt: new Map([...active].map((id) => [id, 0])),
    values,
    prev: null, // { values, active } del ciclo anterior, para los flancos
    unstable: false,
  }
}

function makeContext(compiled, values, active, activatedAt, time, prev) {
  const stepActive = (label) => active.has(compiled.stepByLabel.get(String(label)))
  return {
    value: (name) => values[name] ?? 0,
    step: stepActive,
    elapsed: (label) => {
      const id = compiled.stepByLabel.get(String(label))
      return active.has(id) ? time - (activatedAt.get(id) ?? time) : 0
    },
    prev: prev ? makeContext(compiled, prev.values, prev.active, prev.activatedAt, time, null) : null,
  }
}

const evalBool = (ast, ctx) => (ast ? truthy(evaluate(ast, ctx)) : false)

// Ejecuta una acción memorizada: "A:=expr", o simplemente "A" (se pone a 1).
function runStored(action, values, ctx) {
  if (action.assignment) values[action.assignment.target] = evaluateArithmetic(action.assignment.value, ctx)
  else if (action.symbol) values[action.symbol] = 1
}

// Calcula el estado siguiente.
// - inputs: { nombre: valor } de las entradas en este instante.
// - options.singleStep: franquea una sola vez (para ver la evolución fugaz paso a paso).
// Devuelve { state, events, fired } con los franqueos producidos.
export function evolve(compiled, state, inputs, time, { singleStep = false } = {}) {
  const values = { ...state.values, ...inputs }
  let active = new Set(state.active)
  const activatedAt = new Map(state.activatedAt)
  const events = []
  const fired = new Set()
  let unstable = false
  // Los flancos solo existen en la primera evaluación: en la evolución fugaz posterior las
  // entradas no han cambiado.
  let prev = state.prev ? { ...state.prev, activatedAt: state.activatedAt } : null

  for (let iteration = 0; ; iteration++) {
    const ctx = makeContext(compiled, values, active, activatedAt, time, prev)
    const firable = compiled.transitions.filter((t) => t.from.every((id) => active.has(id)) && evalBool(t.ast, ctx))
    if (!firable.length) break

    const deactivated = new Set(firable.flatMap((t) => t.from))
    const activated = new Set(firable.flatMap((t) => t.to))
    const next = new Set([...active].filter((id) => !deactivated.has(id) || activated.has(id)))
    for (const id of activated) next.add(id)

    for (const step of compiled.steps) {
      const leaves = active.has(step.id) && !next.has(step.id)
      const enters = activated.has(step.id)
      if (leaves) {
        activatedAt.delete(step.id)
        for (const a of step.actions) if (a.kind === 'stored-off') runStored(a, values, ctx)
      }
      if (enters) {
        activatedAt.set(step.id, time)
        for (const a of step.actions) if (a.kind === 'stored-on') runStored(a, values, ctx)
      }
    }

    for (const t of firable) {
      fired.add(t.id)
      events.push({ time, transitionId: t.id, condition: t.condition, from: t.from, to: t.to })
    }
    prev = { values: { ...values }, active, activatedAt: new Map(activatedAt) }
    active = next

    if (singleStep) break
    if (iteration + 1 >= MAX_ITERATIONS) {
      unstable = true
      break
    }
  }

  // Situación estable: acciones continuas, condicionadas y al evento.
  const ctx = makeContext(compiled, values, active, activatedAt, time, state.prev ? { ...state.prev } : null)
  for (const name of compiled.driven) values[name] = 0
  for (const step of compiled.steps) {
    if (!active.has(step.id)) continue
    for (const a of step.actions) {
      if (a.assignment && a.kind !== 'event') continue
      if (a.kind === 'continuous' && a.symbol) values[a.symbol] = 1
      if (a.kind === 'conditional' && a.symbol && evalBool(a.conditionAst, ctx)) values[a.symbol] = 1
      if (a.kind === 'event' && evalBool(a.conditionAst, ctx)) runStored(a, values, ctx)
    }
  }

  return {
    state: {
      time,
      active,
      activatedAt,
      values,
      prev: { values: { ...values }, active: new Set(active), activatedAt: new Map(activatedAt) },
      unstable,
    },
    events,
    fired,
  }
}

// Vista instantánea para pintar el lienzo: transiciones validadas y con receptividad verdadera.
export function inspect(compiled, state) {
  const ctx = makeContext(compiled, state.values, state.active, state.activatedAt, state.time, null)
  const enabled = new Set()
  const ready = new Set()
  for (const t of compiled.transitions) {
    if (!t.from.every((id) => state.active.has(id))) continue
    enabled.add(t.id)
    if (evalBool(t.ast, ctx)) ready.add(t.id)
  }
  return { enabled, ready }
}
