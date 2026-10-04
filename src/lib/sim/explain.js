// «¿Por qué no avanza?»: explica, término a término, por qué una transición se franquea o no en
// el próximo ciclo de la simulación. Puro: se prueba sin navegador.
//
// Se evalúa como lo hará el motor en el próximo ciclo: con las entradas pendientes (las cambiadas
// en pausa todavía no se han aplicado) y con el ciclo anterior para los flancos.
import { makeContext } from './engine'
import { evaluate, truthy } from './expression'
import { t as tr } from '../i18n'

const num = (v) => String(Math.round(Number(v) * 100) / 100).replace('.', ',')

// Texto de una subexpresión, con la notación del editor.
export function showExpression(ast, parent = null) {
  switch (ast.op) {
    case 'num':
      return String(ast.value).replace('.', ',')
    case 'var':
      return ast.name
    case 'step':
      return `X${ast.step}`
    case 'timer':
      return `${num(ast.seconds)}s/X${ast.step}`
    case 'not':
      return `!${wrap(ast.arg)}`
    case 'rise':
    case 'fall':
      return `${ast.op === 'rise' ? '↑' : '↓'}${wrap(ast.arg)}`
    case 'cmp':
      return `${showExpression(ast.left)} ${ast.cmp} ${showExpression(ast.right)}`
    case 'and':
    case 'or': {
      const text = `${showExpression(ast.left, ast.op)} ${ast.op === 'and' ? '·' : '+'} ${showExpression(ast.right, ast.op)}`
      // Paréntesis solo cuando hacen falta: un O dentro de un Y.
      return parent === 'and' && ast.op === 'or' ? `(${text})` : text
    }
    default:
      return '?'
  }
}
const wrap = (ast) => (['and', 'or', 'cmp'].includes(ast.op) ? `(${showExpression(ast)})` : showExpression(ast))

// Términos de un Y o un O seguidos (a · b · c) como una sola lista.
const flatten = (ast, op) => (ast.op === op ? [...flatten(ast.left, op), ...flatten(ast.right, op)] : [ast])

// Árbol de la explicación: { text, ok, detail?, op?, children? }.
function explainTerm(ast, ctx, info) {
  const ok = truthy(evaluate(ast, ctx))
  const text = showExpression(ast)
  switch (ast.op) {
    case 'and':
    case 'or':
      return { text, ok, op: ast.op, children: flatten(ast, ast.op).map((a) => explainTerm(a, ctx, info)) }
    case 'not': {
      const inner = explainTerm(ast.arg, ctx, info)
      // Negación de algo simple: una sola línea («!Paro: vale 1»).
      if (!inner.children) return { text, ok, detail: inner.detail ?? (inner.ok ? tr('es verdadera') : tr('es falsa')) }
      return { text, ok, op: 'not', children: [inner] }
    }
    case 'num':
      return { text, ok, detail: ok ? tr('siempre verdadera') : tr('siempre falsa: nunca se franquea') }
    case 'var': {
      const type = info.types.get(ast.name)
      const own = type === 'output' || type === 'memory'
      const value = num(ctx.value(ast.name))
      return { text, ok, detail: own ? tr('vale {valor} (la pone el propio grafcet)', { valor: value }) : tr('vale {valor}', { valor: value }) }
    }
    case 'step':
      return { text, ok, detail: ok ? tr('etapa activa') : tr('etapa no activa') }
    case 'timer': {
      if (!ctx.step(ast.step)) return { text, ok, detail: tr('X{etapa} no está activa: la temporización no cuenta', { etapa: ast.step }) }
      const left = Math.max(0, ast.seconds - ctx.elapsed(ast.step))
      return { text, ok, detail: ok ? tr('tiempo cumplido') : tr('quedan {segundos} s', { segundos: num(left) }) }
    }
    case 'rise':
    case 'fall': {
      const arg = wrap(ast.arg)
      const rise = ast.op === 'rise'
      if (ok) return { text, ok, detail: tr('{variable} acaba de pasar de {antes} a {ahora}', { variable: arg, antes: rise ? 0 : 1, ahora: rise ? 1 : 0 }) }
      if (!ctx.prev) return { text, ok, detail: tr('un flanco necesita un cambio: todavía no ha habido ninguno') }
      const target = rise ? 1 : 0
      const now = truthy(evaluate(ast.arg, ctx)) ? 1 : 0
      const detail =
        now === target
          ? rise
            ? tr('{variable} ya vale {valor}: hace falta que cambie (desactívala y vuelve a activarla)', { variable: arg, valor: target })
            : tr('{variable} ya vale {valor}: hace falta que cambie (actívala y vuelve a desactivarla)', { variable: arg, valor: target })
          : tr('{variable} vale {valor}: hace falta que pase a {objetivo}', { variable: arg, valor: now, objetivo: target })
      return { text, ok, detail }
    }
    case 'cmp': {
      const shown = [ast.left, ast.right].filter((a) => a.op === 'var').map((a) => `${a.name} = ${num(ctx.value(a.name))}`)
      return { text, ok, detail: shown.length ? shown.join(', ') : ok ? tr('verdadera') : tr('falsa') }
    }
    default:
      return { text, ok }
  }
}

// Primer término que falla (para el resumen): baja por los Y; un O falla entero.
export function firstFailure(term) {
  if (term.ok) return null
  if (term.op === 'and') {
    for (const c of term.children) {
      const f = firstFailure(c)
      if (f) return f
    }
  }
  return term
}

// Explicación de una transición en el estado actual de la simulación (sim: { state, inputs } de
// useSimulation). Devuelve { status, steps, receptivity, summary }; status: 'ready' | 'waiting' |
// 'not-validated' | 'forced' | 'error'.
export function explainTransition(compiled, sim, transitionId) {
  const t = compiled.transitions.find((x) => x.id === transitionId)
  if (!t) return null
  const { state, inputs } = sim
  const values = { ...state.values, ...inputs }
  const prev = state.prev ? { ...state.prev, activatedAt: state.activatedAt } : null
  const ctx = makeContext(compiled, values, state.active, state.activatedAt, state.time, prev)
  const variable = (id) => compiled.steps.find((s) => s.id === id)?.variable ?? '?'
  const steps = t.from.map((id) => ({ id, variable: variable(id), active: state.active.has(id) }))
  const types = new Map(compiled.variables.map((v) => [v.name, v.type]))

  // Grafcet parcial forzado: sus transiciones no se franquean.
  const forcing = compiled.forcings.find(
    (f) => state.active.has(f.stepId) && t.from.some((id) => compiled.grafcetOf.get(id) === f.grafcet),
  )
  const receptivity = t.ast ? explainTerm(t.ast, ctx, { types }) : null
  const missing = steps.filter((s) => !s.active)
  let status
  let summary
  if (!t.ast) {
    status = 'error'
    summary = compiled.errors.find((e) => e.nodeId === t.id)?.message ?? tr('La receptividad no es válida (se toma como falsa).')
  } else if (forcing) {
    status = 'forced'
    summary = tr('El grafcet {grafcet} está forzado ({forzado}) por {etapa}: no evoluciona solo.', { grafcet: forcing.grafcet, forzado: forcing.text, etapa: variable(forcing.stepId) })
  } else if (!steps.length) {
    status = 'not-validated'
    summary = tr('No tiene ninguna etapa anterior enlazada: nunca se valida.')
  } else if (missing.length) {
    status = 'not-validated'
    summary =
      steps.length > 1
        ? tr('No está validada: falta {etapas} (convergencia en Y: tienen que estar activas todas).', { etapas: missing.map((s) => s.variable).join(', ') })
        : tr('No está validada: {etapa} no está activa.', { etapa: missing[0].variable })
  } else if (receptivity.ok) {
    status = 'ready'
    summary = tr('Validada y con la receptividad verdadera: se franquea en el próximo ciclo.')
  } else {
    status = 'waiting'
    const f = firstFailure(receptivity)
    summary = f.detail ? tr('Validada, espera a {condicion} ({detalle}).', { condicion: f.text, detalle: f.detail }) : tr('Validada, espera a {condicion}.', { condicion: f.text })
  }
  return { id: t.id, condition: t.condition, status, steps, receptivity, summary }
}

// Lo que espera el grafcet ahora: las transiciones validadas y lo que les falta.
// `stuck`: hay transiciones pero ninguna validada (el grafcet no puede evolucionar).
export function waitingFor(compiled, sim) {
  const all = compiled.transitions.map((t) => explainTransition(compiled, sim, t.id))
  const validated = all.filter((e) => e.steps.length && e.steps.every((s) => s.active))
  return { list: validated, stuck: compiled.transitions.length > 0 && validated.length === 0 }
}
