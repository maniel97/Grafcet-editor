// Consejos de Verificar: cosas válidas según IEC 60848 que casi siempre son un descuido (errores
// típicos al aprender). No son errores ni avisos: severity 'tip', con `why` explicando la regla.
// Devuelve [{ severity: 'tip', message, why, nodeIds }].
import { buildPlcModel } from './plcModel'
import { t as tr } from './i18n'
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
  // topic: el artículo de la ayuda que lo explica (src/help).
  const add = (message, why, nodeIds, topic = 'transiciones') => tips.push({ severity: 'tip', message, why, nodeIds, topic })
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
        tr('La receptividad {receptividad} usa {salida}, que es una salida.', { receptividad: text, salida: o }),
        tr('Una receptividad describe lo que se espera del proceso: normalmente entradas (sensores, pulsadores) o el estado de otras etapas (X3). Una salida la pone el propio grafcet, así que esperar por ella suele ser un descuido: usa el sensor que confirma que la orden se ha cumplido. Si es una marca interna, cámbiale el tipo a «Marca» en Variables.'),
        [t.id],
      )
    }

    // 2. Temporización de una etapa que no es la anterior.
    for (const timer of timersOf(t.ast)) {
      const from = t.from.map((id) => String(stepById.get(id)?.label))
      if (!from.includes(String(timer.step))) {
        add(
          tr('La temporización {temporizacion} está en una transición que no sale de X{etapa} (sale de {origen}).', {
            temporizacion: `${timer.seconds}s/X${timer.step}`,
            etapa: timer.step,
            origen: t.from.map(name).join(', ') || '—',
          }),
          tr('t/Xn cuenta el tiempo desde que se activó la etapa n y vuelve a 0 cuando se desactiva. Lo habitual es temporizar la etapa anterior a la transición ({propuesta}); si de verdad quieres medir otra etapa, está bien así.', {
            propuesta: from.length ? `${timer.seconds}s/X${from[0]}` : tr('t/X de la etapa anterior'),
          }),
          [t.id],
          'temporizaciones',
        )
      }
    }

    // 3. Receptividad constante.
    if (t.ast.op === 'num') {
      if (!truthy(t.ast.value)) {
        add(
          tr('La receptividad {receptividad} es siempre falsa: la transición no se franquea nunca.', { receptividad: text }),
          tr('Una receptividad 0 bloquea la secuencia. Escribe la condición que debe cumplirse para avanzar.'),
          [t.id],
        )
      } else {
        const acting = t.from.map((id) => stepById.get(id)).filter((s) => s && continuous(s).length)
        if (acting.length) {
          add(
            tr('Receptividad «1» después de {etapas}, que tiene acciones continuas: no llegarán a ejecutarse.', { etapas: acting.map((s) => s.variable).join(', ') }),
            tr('Con una receptividad siempre verdadera la etapa se desactiva en el mismo instante en que se activa (evolución fugaz). Según IEC 60848, en una situación inestable las acciones continuas no se ejecutan; solo las memorizadas (al activar / al desactivar). Usa una acción memorizada o espera a una condición real.'),
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
      const vars = { etapa: s.variable, entrada: before.condition, salida: out.condition }
      add(
        continuous(s).length
          ? tr('{etapa} se atraviesa sin detenerse: si «{entrada}» es verdadera, «{salida}» también lo es y sus acciones continuas no se ejecutan.', vars)
          : tr('{etapa} se atraviesa sin detenerse: si «{entrada}» es verdadera, «{salida}» también lo es.', vars),
        tr('Al franquear «{entrada}» se activa {etapa}, y como «{salida}» ya se cumple se franquea también en ese mismo instante (evolución fugaz, IEC 60848). Pasa a menudo al usar el mismo pulsador para avanzar dos veces: usa un flanco ({flanco}) en la segunda transición o una condición distinta.', {
          ...vars,
          flanco: `↑${firstVar(out.ast) ?? 'a'}`,
        }),
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
      tr('{salida} se manda con acción continua ({continuas}) y memorizada ({memorizadas}).', {
        salida: output,
        continuas: steps.map((s) => s.variable).join(', '),
        memorizadas: stored.map((s) => s.variable).join(', '),
      }),
      tr('Una acción continua asigna la salida en cada instante (1 mientras la etapa está activa, 0 si no); una memorizada la deja en un valor hasta que otra la cambie. Mezclar las dos en la misma salida hace que la continua tape a la memorizada. Elige un solo tipo para cada salida.'),
      [...new Set([...steps, ...stored].map((s) => s.id))],
      'acciones',
    )
  }
  // 6-8. Acciones memorizadas y contadores: qué escribe cada acción en cada variable.
  //   set: A, A:=1 (cualquier constante distinta de 0) · reset: A:=0
  //   up / down: C:=C+1 / C:=C-1 · other: cualquier otra expresión (N:=A*2)
  const writes = new Map()
  const reads = new Map() // variable -> ids de los nodos que la leen
  const compared = new Map() // variable -> ids de los nodos que la comparan ([C >= 3])
  for (const s of compiled.steps) {
    for (const a of s.actions) {
      if (a.conditionAst) for (const n of booleanVarsLoose(a.conditionAst)) push(reads, n, s.id)
      if (a.conditionAst) for (const n of comparedVars(a.conditionAst)) push(compared, n, s.id)
      if (a.kind !== 'stored-on' && a.kind !== 'stored-off' && a.kind !== 'event') continue
      if (!a.assignment) {
        if (a.symbol) push(writes, a.symbol, { step: s, how: 'set' })
        continue
      }
      const { target, value } = a.assignment
      for (const n of booleanVarsLoose(value)) if (n !== target) push(reads, n, s.id)
      push(writes, target, { step: s, how: writeKind(target, value) })
    }
  }
  for (const t of compiled.transitions) {
    if (!t.ast) continue
    for (const n of booleanVarsLoose(t.ast)) push(reads, n, t.id)
    for (const n of comparedVars(t.ast)) push(compared, n, t.id)
  }
  // Un visor de la planta también lee la variable (p. ej. las piezas hechas en un display).
  for (const e of plc?.scene?.elements ?? []) if (e.variable && !reads.has(e.variable)) reads.set(e.variable, [])
  const stepsOf = (list) => [...new Set(list.map((w) => w.step))]
  const where = (list) => stepsOf(list).map((s) => s.variable).join(', ')
  for (const [v, list] of writes) {
    const hows = new Set(list.map((w) => w.how))
    const counts = hows.has('up') || hows.has('down')
    // 6. Se pone a 1 y nada la vuelve a 0 (si además tiene acción continua, ya avisa la regla 5).
    if (hows.size === 1 && hows.has('set') && !continuousIn.has(v)) {
      add(
        tr('{variable} se pone a 1 en {etapas} y ninguna acción la vuelve a poner a 0: se queda activa para siempre.', { variable: v, etapas: where(list) }),
        tr('Una acción memorizada deja la variable en ese valor hasta que otra acción memorizada la cambie; desactivar la etapa no la apaga. Añade {reset} en la etapa donde tenga que apagarse (o «al desactivar» en la misma etapa). Si solo debe estar activa mientras dura la etapa, usa una acción continua.', {
          reset: `${v}:=0`,
        }),
        stepsOf(list).map((s) => s.id),
        'acciones',
      )
    }
    if (!counts) continue
    // 7. Cuenta pero nadie mira la cuenta.
    if (!reads.has(v)) {
      add(
        tr('{contador} se cuenta en {etapas} pero no se lee en ninguna receptividad ni condición.', { contador: v, etapas: where(list) }),
        tr('Un contador sirve para decidir algo cuando llega a un valor: compáralo en una receptividad, p. ej. {ejemplo}. Si no, contar no cambia nada.', {
          ejemplo: `[${v} >= 3]`,
        }),
        stepsOf(list).map((s) => s.id),
        'contadores',
      )
    } else if (compared.has(v) && !hows.has('reset') && !hows.has('other') && !hows.has('set') && !(hows.has('up') && hows.has('down'))) {
      // 8. Se compara, solo sube (o solo baja) y nunca vuelve a su valor de partida. Si sube y baja
      // (plazas de un aparcamiento) la cuenta es un saldo, y si solo se muestra (un total de piezas en
      // un visor) tampoco hace falta ponerla a cero.
      const counting = list.filter((w) => w.how === 'up' || w.how === 'down')
      add(
        tr('{contador} se cuenta en {etapas} pero nunca se pone a cero: en el segundo ciclo empieza con la cuenta del anterior.', { contador: v, etapas: where(counting) }),
        tr('Al empezar la simulación vale 0, pero al volver a la etapa inicial sigue con el valor al que llegó. Ponlo a cero con {reset} como acción memorizada al activar la etapa inicial (o la etapa donde empieza cada cuenta).', {
          reset: `${v}:=0`,
        }),
        stepsOf(counting).map((s) => s.id),
        'contadores',
      )
    }
  }
  // 9. Se compara un contador que no cambia nunca (solo se pone a 0, o es una marca que nadie escribe).
  for (const [v, ids] of compared) {
    const list = writes.get(v) ?? []
    const declared = types.get(v) === 'memory' || types.get(v) === 'counter'
    if (list.length ? list.some((w) => w.how !== 'reset') : !declared) continue
    add(
      tr('{contador} se compara pero ninguna acción lo cuenta: vale siempre 0.', { contador: v }),
      tr('Para que un contador avance, súmale uno en la etapa que se activa con cada cosa contada: {cuenta} como acción memorizada al activar (o al evento, p. ej. con ↑P).', {
        cuenta: `${v}:=${v}+1`,
      }),
      [...new Set([...ids, ...stepsOf(list).map((s) => s.id)])],
      'contadores',
    )
  }
  return tips
}

// Qué hace una asignación con su variable (ver reglas 6-8).
function writeKind(target, value) {
  if (value.op === 'num') return value.value ? 'set' : 'reset'
  if (value.op === 'arith' && (value.fn === '+' || value.fn === '-')) {
    const self = (x) => x.op === 'var' && x.name === target
    const constant = (x) => x.op === 'num' && x.value > 0
    if (self(value.left) && constant(value.right)) return value.fn === '+' ? 'up' : 'down'
    if (value.fn === '+' && constant(value.left) && self(value.right)) return 'up'
  }
  return 'other'
}

// Variables que aparecen dentro de una comparación ([C >= 3]).
function comparedVars(ast, out = new Set()) {
  if (ast.op === 'cmp') return booleanVarsLoose(ast, out)
  if (ast.arg) comparedVars(ast.arg, out)
  if (ast.left) comparedVars(ast.left, out)
  if (ast.right) comparedVars(ast.right, out)
  return out
}

const push =(map, key, value) => map.set(key, [...(map.get(key) ?? []), value])

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
