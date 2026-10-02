// Verificación de conformidad con IEC 60848 (reglas de sintaxis y de evolución).
// Devuelve [{ severity: 'error' | 'warning', message, nodeIds }]:
// - error: el grafcet no es conforme o no puede evolucionar.
// - warning: es sintácticamente válido pero probablemente no es lo que se quiere.

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
  const incoming = (id) => edges.filter((e) => e.target === id && byId.has(e.source))
  const outgoing = (id) => edges.filter((e) => e.source === id && byId.has(e.target))
  const y = (id) => byId.get(id).position.y

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
    if (!s.data.initial && incoming(s.id).length === 0) {
      add('warning', `${stepName(s)} no tiene enlace de entrada: nunca se activará.`, [s.id])
    }
    if (outgoing(s.id).length === 0) {
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
    } else if (loops.length > 1) {
      add('error', `${transitionName(t)} tiene varios bucles: activaría todas esas etapas a la vez.`, [t.id])
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
  }
  if (reached.size) {
    for (const s of steps) {
      if (!reached.has(s.id) && incoming(s.id).length > 0) {
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
