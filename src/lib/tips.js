// Consejos de Verificar: cosas válidas según IEC 60848 que casi siempre son un descuido (errores
// típicos al aprender). No son errores ni avisos: severity 'tip', con `why` explicando la regla.
// Devuelve [{ severity: 'tip', message, why, nodeIds }].
import { buildPlcModel } from './plcModel'
import { compile } from './sim/engine'
import { evaluate, truthy } from './sim/expression'

const MAX_VARS = 10 // implicaciones: como mucho 2^10 combinaciones

// Variables de una receptividad; null si tiene algo que no se puede comparar solo con variables
// (etapas, temporizaciones, comparaciones numéricas).
function booleanVars(ast, out = new Set()) {
  switch (ast.op) {
    case 'var':
      out.add(ast.name)
      return out
    case 'num':
      return out
    case 'not':
    case 'rise':
    case 'fall':
      return booleanVars(ast.arg, out)
    case 'and':
    case 'or':
      return booleanVars(ast.left, out) && booleanVars(ast.right, out)
    default:
      return null
  }
}
const hasEdge = (ast) =>
  ast.op === 'rise' || ast.op === 'fall' || (ast.arg && hasEdge(ast.arg)) || (ast.left && (hasEdge(ast.left) || hasEdge(ast.right)))

// Cuando se franquea por un flanco, en ese ciclo ↑a vale lo mismo que a (y ↓a que !a).
const withoutEdges = (ast) => {
  if (ast.op === 'rise') return withoutEdges(ast.arg)
  if (ast.op === 'fall') return { op: 'not', arg: withoutEdges(ast.arg) }
  if (ast.arg) return { ...ast, arg: withoutEdges(ast.arg) }
  if (ast.left) return { ...ast, left: withoutEdges(ast.left), right: withoutEdges(ast.right) }
  return ast
}

// ¿Siempre que `a` es verdadera también lo es `b`? (null si no se puede saber).
function implies(a, b) {
  const va = booleanVars(a)
  const vb = booleanVars(b)
  if (!va || !vb) return null
  const names = [...new Set([...va, ...vb])]
  if (names.length > MAX_VARS) return null
  for (let mask = 0; mask < 1 << names.length; mask++) {
    const values = Object.fromEntries(names.map((n, i) => [n, (mask >> i) & 1]))
    const ctx = { value: (n) => values[n] ?? 0, step: () => false, elapsed: () => 0, prev: null }
    if (truthy(evaluate(a, ctx)) && !truthy(evaluate(b, ctx))) return false
  }
  return true
}

export function studentTips(nodes, edges, plc) {
  let compiled
  try {
    compiled = compile(buildPlcModel(nodes, edges, plc))
  } catch {
    return []
  }
  const tips = []
  const add = (message, why, nodeIds) => tips.push({ severity: 'tip', message, why, nodeIds })
  const types = new Map(compiled.variables.map((v) => [v.name, v.type]))
  const stepById = new Map(compiled.steps.map((s) => [s.id, s]))
  const name = (id) => stepById.get(id)?.variable ?? '?'
  const continuous = (s) => s.actions.filter((a) => (a.kind === 'continuous' || a.kind === 'conditional') && a.symbol && !a.assignment)

  for (const t of compiled.transitions) {
    if (!t.ast) continue
    const text = `«${t.condition}»`

    // 1. Una salida en una receptividad.
    const outputs = [...(booleanVarsLoose(t.ast) ?? [])].filter((n) => types.get(n) === 'output')
    for (const o of outputs) {
      add(
        `La receptividad ${text} usa ${o}, que es una salida.`,
        'Una receptividad describe lo que se espera del proceso: normalmente entradas (sensores, pulsadores) o el estado de otras etapas (X3). Una salida la pone el propio grafcet, así que esperar por ella suele ser un descuido: usa el sensor que confirma que la orden se ha cumplido. Si es una marca interna, cámbiale el tipo a «Marca» en Variables.',
        [t.id],
      )
    }

    // 2. Temporización de una etapa que no es la anterior.
    for (const timer of timersOf(t.ast)) {
      const from = t.from.map((id) => String(stepById.get(id)?.label))
      if (!from.includes(String(timer.step))) {
        add(
          `La temporización ${timer.seconds}s/X${timer.step} está en una transición que no sale de X${timer.step} (sale de ${t.from.map(name).join(', ') || '—'}).`,
          `t/Xn cuenta el tiempo desde que se activó la etapa n y vuelve a 0 cuando se desactiva. Lo habitual es temporizar la etapa anterior a la transición (${from.length ? `${timer.seconds}s/X${from[0]}` : 't/X de la etapa anterior'}); si de verdad quieres medir otra etapa, está bien así.`,
          [t.id],
        )
      }
    }

    // 3. Receptividad constante.
    if (t.ast.op === 'num') {
      if (!truthy(t.ast.value)) {
        add(`La receptividad ${text} es siempre falsa: la transición no se franquea nunca.`, 'Una receptividad 0 bloquea la secuencia. Escribe la condición que debe cumplirse para avanzar.', [t.id])
      } else {
        const acting = t.from.map((id) => stepById.get(id)).filter((s) => s && continuous(s).length)
        if (acting.length) {
          add(
            `Receptividad «1» después de ${acting.map((s) => s.variable).join(', ')}, que tiene acciones continuas: no llegarán a ejecutarse.`,
            'Con una receptividad siempre verdadera la etapa se desactiva en el mismo instante en que se activa (evolución fugaz). Según IEC 60848, en una situación inestable las acciones continuas no se ejecutan; solo las memorizadas (al activar / al desactivar). Usa una acción memorizada o espera a una condición real.',
            [t.id, ...acting.map((s) => s.id)],
          )
        }
      }
    }
  }

  // 4. Etapa atravesada sin detenerse: la receptividad de salida se cumple siempre que se
  //    cumple la de entrada (p. ej. el mismo pulsador para entrar y salir).
  for (const s of compiled.steps) {
    const incoming = compiled.transitions.filter((t) => t.ast && t.to.includes(s.id))
    const outgoing = compiled.transitions.filter((t) => t.ast && t.from.includes(s.id) && t.from.length === 1)
    for (const out of outgoing) {
      if (hasEdge(out.ast) || out.ast.op === 'num') continue
      const before = incoming.find((inc) => inc.ast.op !== 'num' && implies(withoutEdges(inc.ast), out.ast))
      if (!before) continue
      const actions = continuous(s).length ? ' y sus acciones continuas no se ejecutan' : ''
      add(
        `${s.variable} se atraviesa sin detenerse: si «${before.condition}» es verdadera, «${out.condition}» también lo es${actions}.`,
        `Al franquear «${before.condition}» se activa ${s.variable}, y como «${out.condition}» ya se cumple se franquea también en ese mismo instante (evolución fugaz, IEC 60848). Pasa a menudo al usar el mismo pulsador para avanzar dos veces: usa un flanco (↑${firstVar(out.ast) ?? 'a'}) en la segunda transición o una condición distinta.`,
        [s.id, before.id, out.id],
      )
    }
  }

  // 5. Misma salida con acción continua y memorizada.
  const continuousIn = new Map()
  const storedIn = new Map()
  for (const s of compiled.steps) {
    for (const a of s.actions) {
      if ((a.kind === 'continuous' || a.kind === 'conditional') && a.symbol && !a.assignment) push(continuousIn, a.symbol, s)
      if (a.kind === 'stored-on' || a.kind === 'stored-off' || a.kind === 'event') {
        const target = a.assignment?.target ?? a.symbol
        if (target) push(storedIn, target, s)
      }
    }
  }
  for (const [output, steps] of continuousIn) {
    const stored = storedIn.get(output)
    if (!stored) continue
    add(
      `${output} se manda con acción continua (${steps.map((s) => s.variable).join(', ')}) y memorizada (${stored.map((s) => s.variable).join(', ')}).`,
      'Una acción continua asigna la salida en cada instante (1 mientras la etapa está activa, 0 si no); una memorizada la deja en un valor hasta que otra la cambie. Mezclar las dos en la misma salida hace que la continua tape a la memorizada. Elige un solo tipo para cada salida.',
      [...new Set([...steps, ...stored].map((s) => s.id))],
    )
  }
  return tips
}

const push = (map, key, value) => map.set(key, [...(map.get(key) ?? []), value])

// Variables de una expresión cualquiera (también dentro de comparaciones).
function booleanVarsLoose(ast, out = new Set()) {
  if (ast.op === 'var') out.add(ast.name)
  if (ast.arg) booleanVarsLoose(ast.arg, out)
  if (ast.left) booleanVarsLoose(ast.left, out)
  if (ast.right) booleanVarsLoose(ast.right, out)
  return out
}
function timersOf(ast, out = []) {
  if (ast.op === 'timer') out.push({ seconds: ast.seconds, step: ast.step })
  if (ast.arg) timersOf(ast.arg, out)
  if (ast.left) timersOf(ast.left, out)
  if (ast.right) timersOf(ast.right, out)
  return out
}
const firstVar = (ast) => [...booleanVarsLoose(ast)][0]
