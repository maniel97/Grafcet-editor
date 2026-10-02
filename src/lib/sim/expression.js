// Intérprete de receptividades y condiciones de acción (IEC 60848) para el simulador.
//
// Sintaxis admitida (la misma que acepta el editor):
//   a · b   a * b   a & b   a AND b      Y lógica
//   a + b   a | b   a OR b               O lógica
//   !a   !(a + b)   NOT a   ¬a           negación (en el diagrama: raya encima)
//   ↑a   ↓a   ↑(a · b)                   flanco de subida / bajada
//   X2                                   etapa 2 activa
//   5s/X2   500ms/X3   1min/X1           temporización: X2 activa desde hace al menos 5 s
//   C >= 3   T1 < 2s   a = 1   a <> b    comparaciones numéricas
//   1  0  TRUE  FALSE                    constantes
//
// Y tiene prioridad sobre O; la negación y los flancos, sobre ambas.

const KEYWORDS = { AND: 'and', OR: 'or', NOT: 'not', TRUE: 'true', FALSE: 'false' }
const UNIT_SECONDS = { ms: 0.001, s: 1, min: 60, h: 3600 }

export class ExpressionError extends Error {}

export function tokenize(text) {
  const tokens = []
  const src = String(text ?? '')
  let i = 0
  const push = (type, value, length) => {
    tokens.push({ type, value, pos: i })
    i += length
  }
  while (i < src.length) {
    const rest = src.slice(i)
    const ch = src[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    const two = rest.slice(0, 2)
    if (['>=', '<=', '<>', '!=', '=='].includes(two)) {
      push('cmp', two === '!=' ? '<>' : two === '==' ? '=' : two, 2)
      continue
    }
    if ('><='.includes(ch)) {
      push('cmp', ch, 1)
      continue
    }
    if ('!¬'.includes(ch)) {
      push('not', ch, 1)
      continue
    }
    if (ch === '↑' || ch === '↓') {
      push('edge', ch === '↑' ? 'rise' : 'fall', 1)
      continue
    }
    if ('·*&'.includes(ch)) {
      push('and', ch, 1)
      continue
    }
    if ('+|'.includes(ch)) {
      push('or', ch, 1)
      continue
    }
    if (ch === '-') {
      push('minus', ch, 1)
      continue
    }
    if (ch === '/') {
      push('slash', ch, 1)
      continue
    }
    if (ch === '(' || ch === ')') {
      push(ch, ch, 1)
      continue
    }
    const number = /^(\d+(?:[.,]\d+)?)(ms|s|min|h)?(?![\p{L}\p{N}_])/u.exec(rest)
    if (number) {
      const value = parseFloat(number[1].replace(',', '.'))
      if (number[2]) push('duration', value * UNIT_SECONDS[number[2]], number[0].length)
      else push('number', value, number[0].length)
      continue
    }
    const ident = /^[\p{L}_][\p{L}\p{N}_.]*/u.exec(rest)
    if (ident) {
      const keyword = KEYWORDS[ident[0].toUpperCase()]
      if (keyword === 'true' || keyword === 'false') push('number', keyword === 'true' ? 1 : 0, ident[0].length)
      else if (keyword) push(keyword, ident[0], ident[0].length)
      else push('ident', ident[0], ident[0].length)
      continue
    }
    throw new ExpressionError(`Carácter no válido «${ch}» en la posición ${i + 1}.`)
  }
  return tokens
}

// --- Expresiones booleanas -------------------------------------------------------------------

export function parseCondition(text) {
  const tokens = tokenize(text)
  if (!tokens.length) throw new ExpressionError('La receptividad está vacía.')
  let pos = 0
  const peek = () => tokens[pos]
  const take = (type) => {
    const t = tokens[pos]
    if (!t || (type && t.type !== type)) {
      throw new ExpressionError(t ? `Se esperaba ${describe(type)} y hay «${t.value}».` : `Falta ${describe(type)} al final.`)
    }
    pos++
    return t
  }

  const parseOr = () => {
    let node = parseAnd()
    while (peek()?.type === 'or') {
      take()
      node = { op: 'or', left: node, right: parseAnd() }
    }
    return node
  }
  const parseAnd = () => {
    let node = parseUnary()
    while (peek()?.type === 'and') {
      take()
      node = { op: 'and', left: node, right: parseUnary() }
    }
    return node
  }
  const parseUnary = () => {
    const t = peek()
    if (t?.type === 'not') {
      take()
      return { op: 'not', arg: parseUnary() }
    }
    if (t?.type === 'edge') {
      take()
      return { op: t.value, arg: parseUnary() }
    }
    return parseComparison()
  }
  const parseComparison = () => {
    const left = parsePrimary()
    if (peek()?.type === 'cmp') {
      const op = take().value
      return { op: 'cmp', cmp: op, left, right: parsePrimary() }
    }
    return left
  }
  const parsePrimary = () => {
    const t = peek()
    if (!t) throw new ExpressionError('La expresión termina de forma incompleta.')
    if (t.type === '(') {
      take()
      const node = parseOr()
      take(')')
      return node
    }
    if (t.type === 'minus') {
      take()
      const n = take()
      if (n.type !== 'number' && n.type !== 'duration') throw new ExpressionError('Tras «-» se esperaba un número.')
      return { op: 'num', value: -n.value }
    }
    if (t.type === 'duration') {
      take()
      // Temporización normalizada "5s/X2"
      if (peek()?.type === 'slash') {
        take()
        const step = take('ident')
        const m = /^X(.+)$/.exec(step.value)
        if (!m) throw new ExpressionError(`En «${t.value}s/${step.value}» se esperaba una etapa (X2, X10…).`)
        return { op: 'timer', seconds: t.value, step: m[1] }
      }
      return { op: 'num', value: t.value }
    }
    if (t.type === 'number') {
      take()
      return { op: 'num', value: t.value }
    }
    if (t.type === 'ident') {
      take()
      const m = /^X(\p{N}[\p{L}\p{N}_.]*)$/u.exec(t.value)
      return m ? { op: 'step', step: m[1] } : { op: 'var', name: t.value }
    }
    throw new ExpressionError(`«${t.value}» no puede ir aquí.`)
  }

  const ast = parseOr()
  if (pos < tokens.length) {
    const t = tokens[pos]
    throw new ExpressionError(
      t.type === 'ident' || t.type === 'number'
        ? `Falta un operador antes de «${t.value}» (usa · para Y, + para O).`
        : `«${t.value}» sobra o está mal colocado.`,
    )
  }
  return ast
}

const describe = (type) =>
  ({ ')': '«)»', ident: 'un nombre', number: 'un número' })[type] ?? 'algo más'

// ctx: { value(name), step(label), elapsed(label), prev?: ctx }
// `prev` es el contexto del ciclo anterior, para los flancos; sin él, no hay flancos.
export function evaluate(ast, ctx) {
  switch (ast.op) {
    case 'num':
      return ast.value
    case 'var':
      return Number(ctx.value(ast.name)) || 0
    case 'step':
      return ctx.step(ast.step) ? 1 : 0
    case 'timer':
      return ctx.step(ast.step) && ctx.elapsed(ast.step) >= ast.seconds - 1e-9 ? 1 : 0
    case 'not':
      return truthy(evaluate(ast.arg, ctx)) ? 0 : 1
    case 'and':
      return truthy(evaluate(ast.left, ctx)) && truthy(evaluate(ast.right, ctx)) ? 1 : 0
    case 'or':
      return truthy(evaluate(ast.left, ctx)) || truthy(evaluate(ast.right, ctx)) ? 1 : 0
    case 'rise':
    case 'fall': {
      if (!ctx.prev) return 0
      const now = truthy(evaluate(ast.arg, ctx))
      const before = truthy(evaluate(ast.arg, ctx.prev))
      return (ast.op === 'rise' ? now && !before : !now && before) ? 1 : 0
    }
    case 'cmp': {
      const a = evaluate(ast.left, ctx)
      const b = evaluate(ast.right, ctx)
      const result = { '>': a > b, '<': a < b, '>=': a >= b, '<=': a <= b, '=': a === b, '<>': a !== b }[ast.cmp]
      return result ? 1 : 0
    }
    default:
      throw new ExpressionError(`Operación desconocida: ${ast.op}`)
  }
}

export const truthy = (v) => Number(v) !== 0

// --- Asignaciones de acciones memorizadas: "A:=1", "C:=C+1", "N:=(N+2)*3" ------------------

export function parseAssignment(text) {
  const m = /^\s*([\p{L}_][\p{L}\p{N}_.]*)\s*:=\s*(.+)$/u.exec(String(text ?? ''))
  if (!m) return null
  const tokens = tokenize(m[2])
  let pos = 0
  const peek = () => tokens[pos]
  const take = () => tokens[pos++]

  const expr = () => {
    let node = term()
    while (peek()?.type === 'or' || peek()?.type === 'minus') {
      const op = take().type === 'or' ? '+' : '-'
      node = { op: 'arith', fn: op, left: node, right: term() }
    }
    return node
  }
  const term = () => {
    let node = factor()
    while (peek()?.type === 'and' && peek().value === '*') {
      take()
      node = { op: 'arith', fn: '*', left: node, right: factor() }
    }
    while (peek()?.type === 'slash') {
      take()
      node = { op: 'arith', fn: '/', left: node, right: factor() }
    }
    return node
  }
  const factor = () => {
    const t = take()
    if (!t) throw new ExpressionError('La asignación está incompleta.')
    if (t.type === 'number' || t.type === 'duration') return { op: 'num', value: t.value }
    if (t.type === 'minus') return { op: 'arith', fn: '-', left: { op: 'num', value: 0 }, right: factor() }
    if (t.type === 'ident') return { op: 'var', name: t.value }
    if (t.type === '(') {
      const node = expr()
      if (take()?.type !== ')') throw new ExpressionError('Falta «)» en la asignación.')
      return node
    }
    throw new ExpressionError(`«${t.value}» no es válido en una asignación.`)
  }

  const value = expr()
  if (pos < tokens.length) throw new ExpressionError(`«${tokens[pos].value}» sobra en la asignación.`)
  return { target: m[1], value }
}

export function evaluateArithmetic(ast, ctx) {
  if (ast.op === 'num') return ast.value
  if (ast.op === 'var') return Number(ctx.value(ast.name)) || 0
  const a = evaluateArithmetic(ast.left, ctx)
  const b = evaluateArithmetic(ast.right, ctx)
  if (ast.fn === '+') return a + b
  if (ast.fn === '-') return a - b
  if (ast.fn === '*') return a * b
  return b === 0 ? 0 : a / b
}
