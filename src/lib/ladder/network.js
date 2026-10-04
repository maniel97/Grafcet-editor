// Conversión de expresiones booleanas (AST de lib/sim/expression.js) a redes de contactos.
//
// Red: { type: 'series', items } | { type: 'parallel', items }
//    | { type: 'contact', kind: 'NO' | 'NC' | 'P' | 'N', operand }
//    | { type: 'compare', op, a, b }        (caja de comparación)
//    | { type: 'true' } | { type: 'false' }  (siempre / nunca: se simplifican)
// Operando: { kind: 'var', name } | { kind: 'step', label } | { kind: 'timer', key, seconds, step }
//         | { kind: 'timer', key, seconds, network, delay, falling }  (TON de una temporización t1/a/t2)
//         | { kind: 'aux', name } | { kind: 'num', value }
//
// Las negaciones se llevan hasta los contactos (forma normal negada, leyes de De Morgan):
// !(a + b) -> !a · !b  ->  dos contactos cerrados en serie.

const TRUE = { type: 'true' }
const FALSE = { type: 'false' }
const INVERSE_CMP = { '>': '<=', '<': '>=', '>=': '<', '<=': '>', '=': '<>', '<>': '=' }
const UNIT_TEXT = (seconds) => (seconds < 1 ? `${Math.round(seconds * 1000)}ms` : `${+seconds.toFixed(3)}s`)

export const timerKeyOf = (seconds, step) => `${UNIT_TEXT(seconds)}/X${step}`

export function series(...items) {
  const flat = []
  for (const item of items) {
    if (item.type === 'false') return FALSE
    if (item.type === 'true') continue
    if (item.type === 'series') flat.push(...item.items)
    else flat.push(item)
  }
  if (!flat.length) return TRUE
  return flat.length === 1 ? flat[0] : { type: 'series', items: flat }
}

export function parallel(...items) {
  const flat = []
  for (const item of items) {
    if (item.type === 'true') return TRUE
    if (item.type === 'false') continue
    if (item.type === 'parallel') flat.push(...item.items)
    else flat.push(item)
  }
  if (!flat.length) return FALSE
  return flat.length === 1 ? flat[0] : { type: 'parallel', items: flat }
}

export const contact = (operand, kind = 'NO') => ({ type: 'contact', kind, operand })

function operandOf(ast) {
  if (ast.op === 'var') return { kind: 'var', name: ast.name }
  if (ast.op === 'step') return { kind: 'step', label: ast.step }
  if (ast.op === 'timer') return { kind: 'timer', key: timerKeyOf(ast.seconds, ast.step), seconds: ast.seconds, step: ast.step }
  if (ast.op === 'num') return { kind: 'num', value: ast.value }
  return null
}

// ctx.auxFor(ast) -> nombre de una marca auxiliar que valdrá `ast` (para flancos de expresiones
// compuestas, que en ladder necesitan un contacto propio sobre el que detectar el flanco).
export function toNetwork(ast, ctx, negated = false) {
  switch (ast.op) {
    case 'num':
      return (ast.value !== 0) !== negated ? TRUE : FALSE
    case 'var':
    case 'step':
    case 'timer':
      return contact(operandOf(ast), negated ? 'NC' : 'NO')
    case 'delay':
      // t1/a/t2: el contacto de su temporizador o de su marca (ctx.delayFor, en generate.js).
      return contact(ctx.delayFor(ast), negated ? 'NC' : 'NO')
    case 'not':
      return toNetwork(ast.arg, ctx, !negated)
    case 'and':
      return negated
        ? parallel(toNetwork(ast.left, ctx, true), toNetwork(ast.right, ctx, true))
        : series(toNetwork(ast.left, ctx), toNetwork(ast.right, ctx))
    case 'or':
      return negated
        ? series(toNetwork(ast.left, ctx, true), toNetwork(ast.right, ctx, true))
        : parallel(toNetwork(ast.left, ctx), toNetwork(ast.right, ctx))
    case 'rise':
    case 'fall': {
      const simple = operandOf(ast.arg)
      const operand = simple && simple.kind !== 'num' ? simple : { kind: 'aux', name: ctx.auxFor(ast.arg) }
      const edge = contact(operand, ast.op === 'rise' ? 'P' : 'N')
      // Flanco negado ("no hay flanco"): contacto de flanco seguido de un contacto NOT.
      return negated ? { type: 'not', item: edge } : edge
    }
    case 'cmp': {
      const a = operandOf(ast.left)
      const b = operandOf(ast.right)
      if (!a || !b) throw new Error('Comparación demasiado compleja para ladder.')
      return { type: 'compare', op: negated ? INVERSE_CMP[ast.cmp] : ast.cmp, a, b }
    }
    default:
      throw new Error(`No se puede pasar a ladder: ${ast.op}`)
  }
}

// Recorre la red y devuelve los operandos usados (para declarar variables).
export function walk(net, visit) {
  if (!net) return
  if (net.type === 'series' || net.type === 'parallel') net.items.forEach((i) => walk(i, visit))
  else if (net.type === 'not') walk(net.item, visit)
  else visit(net)
}
