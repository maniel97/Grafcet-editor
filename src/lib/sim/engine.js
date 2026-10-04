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
// Forzado de grafcets parciales (F/G2{3}): mientras la etapa que lo ordena está activa, el
// grafcet forzado toma la situación indicada y no evoluciona por sí mismo (el forzado tiene
// prioridad sobre las reglas de evolución). Macroetapas: ver lib/plcModel.js.
//
// Todo es puro: compile() prepara el modelo y evolve() calcula el estado siguiente.

import { normalizeAction } from '../actions'
import { actionSymbol } from '../symbols'
import { describeForcing } from '../forcing'
import { collectDelays, ExpressionError, evaluate, evaluateArithmetic, parseAssignment, parseCondition, stepDelay, truthy } from './expression'

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

  // Grafcets parciales y órdenes de forzado, con las etapas ya resueltas a ids.
  const grafcets = new Map((model.grafcets ?? []).map((g) => [g.name, new Set(g.steps)]))
  const grafcetOf = new Map(steps.filter((s) => s.grafcet).map((s) => [s.id, s.grafcet]))
  const forcings = []
  for (const s of steps) {
    for (const f of s.forcings ?? []) {
      const members = grafcets.get(f.grafcet)
      // Un grafcet no puede forzarse a sí mismo (lo marca Verificar).
      if (!members || s.grafcet === f.grafcet) continue
      const byLabel = new Map([...members].map((id) => [String(steps.find((x) => x.id === id)?.label), id]))
      const targets =
        f.mode === 'steps'
          ? new Set(f.steps.map((l) => byLabel.get(String(l))).filter(Boolean))
          : f.mode === 'init'
            ? new Set([...members].filter((id) => steps.find((x) => x.id === id)?.initial))
            : new Set()
      forcings.push({ stepId: s.id, grafcet: f.grafcet, mode: f.mode, targets, text: describeForcing(f) })
    }
  }
  // Macroetapas: activas mientras lo esté alguna etapa de su expansión.
  const macroMembers = new Map((model.macros ?? []).map((m) => [m.stepId, m.members]))

  // Temporizaciones t1/a/t2 de receptividades y condiciones: su estado se lleva ciclo a ciclo.
  const delays = new Map()
  for (const t of transitions) collectDelays(t.ast, delays)
  for (const s of steps) for (const a of s.actions) collectDelays(a.conditionAst, delays)
  return { steps, transitions, stepByLabel, driven, variables: model.variables, errors, grafcets, grafcetOf, forcings, macroMembers, delays }
}

// Etapas activas vistas desde fuera: incluye las macroetapas con alguna etapa activa.
export function withMacros(compiled, active) {
  if (!compiled.macroMembers?.size) return active
  const out = new Set(active)
  for (const [id, members] of compiled.macroMembers) if (members.some((m) => active.has(m))) out.add(id)
  return out
}

// Órdenes de forzado vigentes en una situación: Map grafcet -> orden (la primera, si hay varias).
function forcingOrders(compiled, active) {
  const orders = new Map()
  for (const f of compiled.forcings) if (active.has(f.stepId) && !orders.has(f.grafcet)) orders.set(f.grafcet, f)
  return orders
}

// Aplica los forzados (salvo {*}, que solo congela): las etapas del grafcet forzado quedan
// exactamente las indicadas.
function applyForcing(compiled, active, orders) {
  let next = active
  for (const [name, order] of orders) {
    if (order.mode === 'freeze') continue
    const members = compiled.grafcets.get(name)
    const result = new Set([...next].filter((id) => !members.has(id)))
    for (const id of order.targets) result.add(id)
    next = result
  }
  return next
}
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))

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
    delays: new Map(), // clave "3s/a/2s" -> { input, since, out }
    unstable: false,
  }
}

export function makeContext(compiled, values, active, activatedAt, time, prev, delays) {
  const stepActive = (label) => {
    const id = compiled.stepByLabel.get(String(label))
    const members = compiled.macroMembers?.get(id)
    return members ? members.some((m) => active.has(m)) : active.has(id)
  }
  return {
    value: (name) => values[name] ?? 0,
    step: stepActive,
    elapsed: (label) => {
      const id = compiled.stepByLabel.get(String(label))
      return active.has(id) ? time - (activatedAt.get(id) ?? time) : 0
    },
    delay: (key) => Boolean(delays?.get(key)?.out),
    prev: prev ? makeContext(compiled, prev.values, prev.active, prev.activatedAt, time, null, prev.delays ?? delays) : null,
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
  // Temporizaciones t1/a/t2: se actualizan una vez por ciclo, con las entradas de este instante.
  const delays = new Map(state.delays ?? [])
  if (compiled.delays?.size) {
    const now = makeContext(compiled, values, active, activatedAt, time, null, state.delays)
    for (const [key, d] of compiled.delays) delays.set(key, stepDelay(delays.get(key), truthy(evaluate(d.arg, now)), time, d))
  }

  for (let iteration = 0; ; iteration++) {
    const ctx = makeContext(compiled, values, active, activatedAt, time, prev, delays)
    // Las transiciones de un grafcet forzado no se franquean.
    const forced = forcingOrders(compiled, active)
    // Una transición fuente (sin etapas anteriores) está siempre validada; si sus etapas siguientes
    // ya están activas, franquearla no cambia nada y no se cuenta (si no, la evolución no acabaría).
    const firable = compiled.transitions.filter(
      (t) =>
        t.from.every((id) => active.has(id)) &&
        !(t.from.length ? t.from : t.to).some((id) => forced.has(compiled.grafcetOf.get(id))) &&
        !(t.from.length === 0 && t.to.every((id) => active.has(id))) &&
        evalBool(t.ast, ctx),
    )

    const deactivated = new Set(firable.flatMap((t) => t.from))
    const activated = new Set(firable.flatMap((t) => t.to))
    const evolved = new Set([...active].filter((id) => !deactivated.has(id) || activated.has(id)))
    for (const id of activated) evolved.add(id)
    // Forzados ordenados por la nueva situación.
    const orders = forcingOrders(compiled, evolved)
    const next = applyForcing(compiled, evolved, orders)
    if (!firable.length && sameSet(next, active)) break
    for (const id of next) if (!evolved.has(id)) activated.add(id)

    for (const step of compiled.steps) {
      const leaves = active.has(step.id) && !next.has(step.id)
      const enters = activated.has(step.id) && next.has(step.id)
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
    for (const [name, order] of orders) {
      const members = compiled.grafcets.get(name)
      const before = [...evolved].filter((id) => members.has(id))
      const after = [...next].filter((id) => members.has(id))
      if (order.mode !== 'freeze' && !sameSet(new Set(before), new Set(after))) {
        events.push({ time, transitionId: null, forcing: order.text, stepId: order.stepId, from: before, to: after })
      }
    }
    prev = { values: { ...values }, active, activatedAt: new Map(activatedAt), delays }
    active = next

    if (singleStep) break
    if (iteration + 1 >= MAX_ITERATIONS) {
      unstable = true
      break
    }
  }

  // Situación estable: acciones continuas, condicionadas y al evento.
  const ctx = makeContext(compiled, values, active, activatedAt, time, state.prev ? { ...state.prev } : null, delays)
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
      prev: { values: { ...values }, active: new Set(active), activatedAt: new Map(activatedAt), delays },
      delays,
      unstable,
    },
    events,
    fired,
  }
}

// Vista instantánea para pintar el lienzo: transiciones validadas y con receptividad verdadera.
export function inspect(compiled, state) {
  const ctx = makeContext(compiled, state.values, state.active, state.activatedAt, state.time, null, state.delays)
  const enabled = new Set()
  const ready = new Set()
  // En un grafcet forzado ninguna transición está validada.
  const forced = forcingOrders(compiled, state.active)
  for (const t of compiled.transitions) {
    if (!t.from.every((id) => state.active.has(id)) || (t.from.length ? t.from : t.to).some((id) => forced.has(compiled.grafcetOf.get(id)))) continue
    enabled.add(t.id)
    if (evalBool(t.ast, ctx)) ready.add(t.id)
  }
  return { enabled, ready }
}
