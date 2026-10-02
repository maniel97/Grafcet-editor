// Exclusión mutua de receptividades (IEC 60848): en una divergencia en O, si dos receptividades
// pueden ser verdaderas a la vez se franquearían las dos transiciones y se activarían las dos
// ramas. Se comprueba de forma exacta probando todas las combinaciones de valores con el mismo
// intérprete del simulador (lib/sim/expression.js):
// - variables binarias: 0 y 1; variables comparadas con números: los valores frontera (c-1, c, c+1);
// - etapas (X3): activa o no; temporizaciones (5s/X3): antes y después de cumplirse;
// - flancos (↑a): también el valor del ciclo anterior.

import { ExpressionError, evaluate, parseCondition, truthy } from './sim/expression'

export const MAX_COMBINATIONS = 1 << 16

// Recorre el árbol y apunta qué hay que probar.
function collect(ast, domain, underEdge = false) {
  switch (ast.op) {
    case 'var':
      domain.vars.set(ast.name, domain.vars.get(ast.name) ?? new Set([0, 1]))
      if (underEdge) domain.prevVars.add(ast.name)
      break
    case 'step':
      domain.steps.add(ast.step)
      if (underEdge) domain.prevSteps.add(ast.step)
      break
    case 'timer':
      domain.steps.add(ast.step)
      domain.timers.set(ast.step, new Set([...(domain.timers.get(ast.step) ?? [0]), ast.seconds]))
      break
    case 'cmp':
      for (const [side, other] of [
        [ast.left, ast.right],
        [ast.right, ast.left],
      ]) {
        if (side.op === 'var' && other.op === 'num') {
          const values = domain.vars.get(side.name) ?? new Set([0, 1])
          for (const v of [other.value - 1, other.value, other.value + 1]) values.add(v)
          domain.vars.set(side.name, values)
        }
      }
      collect(ast.left, domain, underEdge)
      collect(ast.right, domain, underEdge)
      break
    case 'not':
      collect(ast.arg, domain, underEdge)
      break
    case 'rise':
    case 'fall':
      collect(ast.arg, domain, true)
      break
    case 'and':
    case 'or':
      collect(ast.left, domain, underEdge)
      collect(ast.right, domain, underEdge)
      break
    default:
  }
}

// ¿Pueden cumplirse a la vez? Devuelve:
// - { exclusive: true }
// - { exclusive: false, example: { now: {nombre: valor}, before: {...}, steps: {...} } }
// - { exclusive: null, reason } si no se puede comprobar (error de sintaxis o demasiadas combinaciones).
export function checkExclusive(textA, textB) {
  let a
  let b
  try {
    a = parseCondition(textA)
    b = parseCondition(textB)
  } catch (err) {
    if (err instanceof ExpressionError) return { exclusive: null, reason: 'syntax' }
    throw err
  }
  const domain = { vars: new Map(), steps: new Set(), timers: new Map(), prevVars: new Set(), prevSteps: new Set() }
  collect(a, domain)
  collect(b, domain)

  // Dimensiones a combinar: [clave, valores posibles].
  const dims = [
    ...[...domain.vars].map(([name, values]) => [`v:${name}`, [...values].sort((x, y) => x - y)]),
    ...[...domain.prevVars].map((name) => [`pv:${name}`, [...domain.vars.get(name)].sort((x, y) => x - y)]),
    ...[...domain.steps].map((s) => [`s:${s}`, [0, 1]]),
    ...[...domain.prevSteps].map((s) => [`ps:${s}`, [0, 1]]),
    ...[...domain.timers].map(([s, values]) => [`t:${s}`, [...values].sort((x, y) => x - y)]),
  ]
  const total = dims.reduce((n, [, values]) => n * values.length, 1)
  if (total > MAX_COMBINATIONS) return { exclusive: null, reason: 'size' }

  const pick = new Map()
  const ctxFor = (prefix, stepPrefix) => ({
    value: (name) => pick.get(`${prefix}:${name}`) ?? pick.get(`v:${name}`) ?? 0,
    step: (label) => (pick.get(`${stepPrefix}:${label}`) ?? pick.get(`s:${label}`) ?? 0) === 1,
    elapsed: (label) => pick.get(`t:${label}`) ?? 0,
  })
  const ctx = { ...ctxFor('v', 's'), prev: ctxFor('pv', 'ps') }

  const walk = (i) => {
    if (i === dims.length) return truthy(evaluate(a, ctx)) && truthy(evaluate(b, ctx))
    const [key, values] = dims[i]
    for (const v of values) {
      pick.set(key, v)
      if (walk(i + 1)) return true
    }
    return false
  }
  if (!walk(0)) return { exclusive: true }

  const example = { now: {}, before: {}, steps: {} }
  for (const [key, v] of pick) {
    const [kind, name] = key.split(/:(.*)/s)
    if (kind === 'v') example.now[name] = v
    else if (kind === 'pv') example.before[name] = v
    else if (kind === 's') example.steps[name] = v
    else if (kind === 't') example.steps[`t${name}`] = v
  }
  return { exclusive: false, example }
}

// Ejemplo legible: «Marcha = 1 y Limpieza = 1» (con los flancos, «Marcha pasa de 0 a 1»).
export function describeExample(example) {
  const parts = Object.entries(example.now).map(([name, v]) =>
    name in example.before && example.before[name] !== v ? `${name} pasa de ${example.before[name]} a ${v}` : `${name} = ${v}`,
  )
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : (parts[0] ?? 'cualquier valor')
}

// Propuesta para hacerla excluyente: «B · !A» (con paréntesis si hace falta).
export function exclusiveFix(textA, textB) {
  const wrap = (t) => (/^[\p{L}_][\p{L}\p{N}_.]*$/u.test(t.trim()) ? t.trim() : `(${t.trim()})`)
  return `${wrap(textB)} · !${wrap(textA)}`
}
