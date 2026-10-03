// Verificación de conformidad con IEC 60848 (reglas de sintaxis y de evolución).
// Devuelve [{ severity: 'error' | 'warning', message, nodeIds }]:
// - error: el grafcet no es conforme o no puede evolucionar.
// - warning: es sintácticamente válido pero probablemente no es lo que se quiere.

import { frameOf, macroName, membersOf } from './frames'
import { parseForcing } from './forcing'
import { normalizeAction } from './actions'
import { checkExclusive, describeExample, exclusiveFix } from './exclusivity'

const stepName = (n) => `Etapa ${n.data.label?.trim() || '(sin número)'}`
const transitionName = (n) => `Transición «${n.data.condition?.trim() || 'sin receptividad'}»`
const nameOf = (n) => (n.type === 'step' ? stepName(n) : transitionName(n))

export function validateGrafcet(nodes, edges) {
  const issues = []
  const add = (severity, message, nodeIds = []) => issues.push({ severity, message, nodeIds })
  if (!nodes.length) return issues

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const steps = nodes.filter((n) => n.type === 'step')
  const transitions = nodes.filter((n) => n.type === 'transition')
  // Índices de enlaces por nodo: buscarlos filtrando todos los enlaces para cada nodo sería
  // cuadrático y se nota en diagramas grandes (la verificación se repite al editar).
  const incomingOf = new Map()
  const outgoingOf = new Map()
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    incomingOf.set(e.target, [...(incomingOf.get(e.target) ?? []), e])
    outgoingOf.set(e.source, [...(outgoingOf.get(e.source) ?? []), e])
  }
  const incoming = (id) => incomingOf.get(id) ?? []
  const outgoing = (id) => outgoingOf.get(id) ?? []
  const y = (id) => byId.get(id).position.y

  // Marcos (grafcets parciales y expansiones de macroetapas) y órdenes de forzado.
  const frames = nodes.filter((n) => n.type === 'frame')
  const frameName = (f) => String(f.data.name ?? '').trim().toUpperCase()
  const grafcetOf = (n) => (frameOf(n, frames, 'grafcet') ? frameName(frameOf(n, frames, 'grafcet')) : null)
  const byFrameName = new Map()
  for (const f of frames) {
    if (!frameName(f)) add('error', 'Marco sin nombre: un grafcet parcial se llama G1, G2...; una expansión, como su macroetapa (M1).', [f.id])
    else byFrameName.set(frameName(f), [...(byFrameName.get(frameName(f)) ?? []), f])
  }
  for (const [name, list] of byFrameName) {
    if (list.length > 1) add('error', `El nombre ${name} está repetido en ${list.length} marcos.`, list.map((f) => f.id))
  }
  // Expansiones: entrada E.. y salida S.. (o la etapa sin entrada / sin salida dentro del marco).
  const expansions = new Map() // id de la macroetapa -> { entry, exit, members }
  const expansionRole = new Map() // id de etapa -> 'entry' | 'exit'
  for (const f of frames.filter((x) => x.data.kind === 'macro')) {
    const macro = steps.find((s) => s.data.macro && macroName(s.data.label) === frameName(f))
    if (!macro) {
      add('warning', `La expansión ${frameName(f)} no corresponde a ninguna macroetapa: crea la macroetapa ${frameName(f)} o renombra el marco.`, [f.id])
      continue
    }
    const members = membersOf(f, steps)
    const find = (re, dir) =>
      members.find((s) => re.test(String(s.data.label))) ?? members.find((s) => (dir === 'in' ? incoming(s.id) : outgoing(s.id)).length === 0)
    const entry = find(/^E/i, 'in')
    const exit = find(/^S/i, 'out')
    if (!entry) add('error', `La expansión ${frameName(f)} no tiene etapa de entrada (E${frameName(f).slice(1)}).`, [f.id])
    if (!exit) add('error', `La expansión ${frameName(f)} no tiene etapa de salida (S${frameName(f).slice(1)}).`, [f.id])
    if (entry) expansionRole.set(entry.id, 'entry')
    if (exit) expansionRole.set(exit.id, 'exit')
    expansions.set(macro.id, { entry, exit, members })
  }
  for (const s of steps) {
    if (s.data.macro && !expansions.has(s.id)) {
      add('warning', `Macroetapa ${macroName(s.data.label)} sin expansión: dibuja un marco «${macroName(s.data.label)}» con sus etapas (de E a S). Mientras tanto se simula como una etapa normal.`, [s.id])
    }
  }
  // Forzados: grafcet destino existente, distinto del propio y con esas etapas.
  const grafcetSteps = new Map()
  for (const s of steps) {
    const g = grafcetOf(s)
    if (g) grafcetSteps.set(g, [...(grafcetSteps.get(g) ?? []), s])
  }
  const forcedOn = new Map() // id de etapa que fuerza -> [ids de etapas que activa]
  for (const s of steps) {
    for (const raw of s.data.actions ?? []) {
      const f = parseForcing(normalizeAction(raw).text)
      if (!f) continue
      const isGrafcet = frames.some((x) => x.data.kind === 'grafcet' && frameName(x) === f.grafcet)
      if (!isGrafcet) {
        add('error', `${stepName(s)}: el forzado F/${f.grafcet}{…} se refiere a un grafcet parcial que no existe (encierra sus etapas en un marco «${f.grafcet}»).`, [s.id])
        continue
      }
      if (grafcetOf(s) === f.grafcet) {
        add('error', `${stepName(s)}: un grafcet no puede forzarse a sí mismo (F/${f.grafcet}).`, [s.id])
        continue
      }
      const members = grafcetSteps.get(f.grafcet) ?? []
      const missing = f.steps.filter((l) => !members.some((m) => String(m.data.label) === String(l)))
      if (missing.length) add('error', `${stepName(s)}: ${missing.map((l) => `la etapa ${l}`).join(', ')} no ${missing.length > 1 ? 'son' : 'es'} del grafcet ${f.grafcet}.`, [s.id])
      const targets = f.mode === 'init' ? members.filter((m) => m.data.initial) : members.filter((m) => f.steps.includes(String(m.data.label)))
      forcedOn.set(s.id, [...(forcedOn.get(s.id) ?? []), ...targets.map((m) => m.id)])
    }
  }
  const forcedTargets = new Set([...forcedOn.values()].flat())

  // Situación inicial: sin etapa inicial el grafcet no puede arrancar.
  if (steps.length && !steps.some((s) => s.data.initial)) {
    add('error', 'No hay ninguna etapa inicial: el grafcet no puede arrancar. Marca al menos una (doble cuadrado).')
  }

  // Identificación de etapas: número obligatorio y único.
  const byLabel = new Map()
  for (const s of steps) {
    const label = s.data.label?.trim()
    if (!label) add('error', 'Etapa sin número: toda etapa debe estar identificada.', [s.id])
    else byLabel.set(label, [...(byLabel.get(label) ?? []), s.id])
  }
  for (const [label, ids] of byLabel) {
    if (ids.length > 1) add('error', `El número de etapa ${label} está repetido ${ids.length} veces.`, ids)
  }

  for (const s of steps) {
    if (s.data.macro && s.data.initial) add('error', `${stepName(s)}: una macroetapa no puede ser inicial.`, [s.id])
  }

  // Alternancia etapa / transición.
  for (const e of edges) {
    const s = byId.get(e.source)
    const t = byId.get(e.target)
    if (s && t && s.type === t.type) {
      add(
        'error',
        `Enlace directo entre dos ${s.type === 'step' ? 'etapas' : 'transiciones'}: deben alternarse siempre.`,
        [s.id, t.id],
      )
    }
  }

  for (const s of steps) {
    if (!s.data.initial && incoming(s.id).length === 0 && expansionRole.get(s.id) !== 'entry' && !forcedTargets.has(s.id)) {
      add('warning', `${stepName(s)} no tiene enlace de entrada: nunca se activará.`, [s.id])
    }
    if (outgoing(s.id).length === 0 && expansionRole.get(s.id) !== 'exit') {
      add('warning', `${stepName(s)} no tiene transición de salida: una vez activa no se desactiva nunca.`, [s.id])
    }
  }

  for (const t of transitions) {
    if (!t.data.condition?.trim()) {
      add('error', 'Transición sin receptividad: toda transición la necesita (usa 1 si siempre se cumple).', [t.id])
    }
    if (incoming(t.id).length === 0) {
      add('error', `${transitionName(t)} no tiene etapa anterior: nunca podrá franquearse.`, [t.id])
    }
    const out = outgoing(t.id)
    if (out.length === 0) {
      add('error', `${transitionName(t)} no tiene etapa posterior: al franquearla no se activaría nada.`, [t.id])
    }
    const loops = out.filter((e) => y(e.target) < y(t.id))
    if (loops.length && out.length > loops.length) {
      add(
        'error',
        `${transitionName(t)} vuelve atrás y continúa a la vez: activaría ambas etapas simultáneamente. Para «volver O seguir» usa dos transiciones alternativas (divergencia en O).`,
        [t.id],
      )
    } else if (loops.length > 1 && !loops.every((e) => outgoing(e.target).some((next) => incoming(next.target).length > 1))) {
      // Varios bucles a la vez solo tienen sentido si esas etapas se esperan después en una
      // convergencia en Y (p. ej. devolver un recurso compartido junto con el reposo de su
      // secuencia, IEC 60848); si no, suele ser un «volver aquí O allí» mal dibujado.
      add('error', `${transitionName(t)} tiene varios bucles: activaría todas esas etapas a la vez.`, [t.id])
    }
  }

  // Divergencias en O: las receptividades de una elección deben ser excluyentes; si no, se
  // franquearían varias transiciones a la vez y se activarían varias ramas.
  for (const s of steps) {
    const options = outgoing(s.id)
      .map((e) => byId.get(e.target))
      .filter((t) => t?.type === 'transition' && t.data.condition?.trim())
    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        const [a, b] = [options[i], options[j]].sort((x, y) => x.position.x - y.position.x)
        const ca = a.data.condition.trim()
        const cb = b.data.condition.trim()
        const result = checkExclusive(ca, cb)
        if (result.exclusive === false) {
          add(
            'warning',
            `Divergencia en O desde la ${stepName(s).toLowerCase()}: «${ca}» y «${cb}» pueden cumplirse a la vez (p. ej. con ${describeExample(
              result.example,
            )}) y se activarían las dos ramas. Hazlas excluyentes, p. ej. «${exclusiveFix(ca, cb)}».`,
            [s.id, a.id, b.id],
          )
        } else if (result.exclusive === null && result.reason === 'size') {
          add('warning', `Divergencia en O desde la ${stepName(s).toLowerCase()}: no se ha podido comprobar si «${ca}» y «${cb}» son excluyentes (demasiadas variables).`, [s.id, a.id, b.id])
        }
      }
    }
  }

  // Accesibilidad: etapas a las que no se puede llegar desde ninguna etapa inicial.
  const reached = new Set()
  const queue = steps.filter((s) => s.data.initial).map((s) => s.id)
  while (queue.length) {
    const id = queue.pop()
    if (reached.has(id)) continue
    reached.add(id)
    for (const e of outgoing(id)) queue.push(e.target)
    // Una macroetapa activa su expansión; un forzado activa las etapas que indica.
    const expansion = expansions.get(id)
    if (expansion) queue.push(...expansion.members.map((m) => m.id))
    queue.push(...(forcedOn.get(id) ?? []))
  }
  if (reached.size) {
    for (const s of steps) {
      if (!reached.has(s.id) && (incoming(s.id).length > 0 || expansionRole.get(s.id) === 'entry')) {
        add('warning', `${stepName(s)} no es alcanzable desde ninguna etapa inicial.`, [s.id])
      }
    }
  }

  return issues
}

// Índice nodo -> problemas, para marcar los nodos en el lienzo.
export function issuesByNode(issues) {
  const map = new Map()
  for (const issue of issues) {
    for (const id of issue.nodeIds) map.set(id, [...(map.get(id) ?? []), issue])
  }
  return map
}

export { nameOf }
