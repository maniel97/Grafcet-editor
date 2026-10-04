// Verificación de conformidad con IEC 60848 (reglas de sintaxis y de evolución).
// Devuelve [{ severity: 'error' | 'warning', message, nodeIds }]:
// - error: el grafcet no es conforme o no puede evolucionar.
// - warning: es sintácticamente válido pero probablemente no es lo que se quiere.

import { frameOf, macroName, membersOf } from './frames'
import { parseForcing } from './forcing'
import { normalizeAction } from './actions'
import { checkExclusive, describeExample, exclusiveFix } from './exclusivity'
import { t } from './i18n'

// (Mensajes traducibles: lib/i18n.js, con sus partes variables como marcadores {nombre}.)
const stepLabel = (n) => n.data.label?.trim() || t('(sin número)')
const stepName = (n) => t('Etapa {etapa}', { etapa: stepLabel(n) })
const transitionName = (n) => t('Transición «{receptividad}»', { receptividad: n.data.condition?.trim() || t('sin receptividad') })
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
    if (!frameName(f)) add('error', t('Marco sin nombre: un grafcet parcial se llama G1, G2...; una expansión, como su macroetapa (M1).'), [f.id])
    else byFrameName.set(frameName(f), [...(byFrameName.get(frameName(f)) ?? []), f])
  }
  for (const [name, list] of byFrameName) {
    if (list.length > 1) add('error', t('El nombre {nombre} está repetido en {n} marcos.', { nombre: name, n: list.length }), list.map((f) => f.id))
  }
  // Expansiones: entrada E.. y salida S.. (o la etapa sin entrada / sin salida dentro del marco).
  const expansions = new Map() // id de la macroetapa -> { entry, exit, members }
  const expansionRole = new Map() // id de etapa -> 'entry' | 'exit'
  for (const f of frames.filter((x) => x.data.kind === 'macro')) {
    const macro = steps.find((s) => s.data.macro && macroName(s.data.label) === frameName(f))
    if (!macro) {
      add('warning', t('La expansión {marco} no corresponde a ninguna macroetapa: crea la macroetapa {marco} o renombra el marco.', { marco: frameName(f) }), [f.id])
      continue
    }
    const members = membersOf(f, steps)
    const find = (re, dir) =>
      members.find((s) => re.test(String(s.data.label))) ?? members.find((s) => (dir === 'in' ? incoming(s.id) : outgoing(s.id)).length === 0)
    const entry = find(/^E/i, 'in')
    const exit = find(/^S/i, 'out')
    if (!entry) add('error', t('La expansión {marco} no tiene etapa de entrada ({etapa}).', { marco: frameName(f), etapa: `E${frameName(f).slice(1)}` }), [f.id])
    if (!exit) add('error', t('La expansión {marco} no tiene etapa de salida ({etapa}).', { marco: frameName(f), etapa: `S${frameName(f).slice(1)}` }), [f.id])
    if (entry) expansionRole.set(entry.id, 'entry')
    if (exit) expansionRole.set(exit.id, 'exit')
    expansions.set(macro.id, { entry, exit, members })
  }
  for (const s of steps) {
    if (s.data.macro && !expansions.has(s.id)) {
      add('warning', t('Macroetapa {macro} sin expansión: dibuja un marco «{macro}» con sus etapas (de E a S). Mientras tanto se simula como una etapa normal.', { macro: macroName(s.data.label) }), [s.id])
    }
  }
  // Encapsulación (IEC 60848): la etapa encapsulante «5» y su marco (data.step = '5'), con al menos
  // una etapa de su nivel con enlace de activación (*) y sin enlaces que crucen el marco.
  const encapsulated = new Set() // etapas dentro de algún marco de encapsulación
  const encapsulationLinks = new Map() // etapa encapsulante -> etapas de su nivel con *
  for (const f of frames.filter((x) => x.data.kind === 'encapsulation')) {
    const owner = steps.find((s) => s.data.encapsulating && String(s.data.label) === String(f.data.step))
    if (!owner) {
      add('error', t('El grafcet encapsulado {grafcet} no tiene etapa encapsulante: marca la etapa {etapa} como encapsulante o cambia el marco.', { grafcet: frameName(f), etapa: f.data.step ?? '?' }), [f.id])
      continue
    }
    const inner = [...membersOf(f, steps)].filter((s) => s.id !== owner.id)
    inner.forEach((s) => encapsulated.add(s.id))
    const level = inner.filter((s) => frameOf(s, frames, 'encapsulation')?.id === f.id)
    encapsulationLinks.set(owner.id, level.filter((s) => s.data.activationLink).map((s) => s.id))
    if (!level.some((s) => s.data.activationLink)) {
      add('error', t('El grafcet encapsulado {grafcet} no tiene ninguna etapa con enlace de activación (*): al activarse {etapa} no se activaría nada dentro.', { grafcet: frameName(f), etapa: stepName(owner) }), [f.id])
    }
    if (inner.some((s) => s.data.initial) && !owner.data.initial) {
      add('error', t('{etapa} encapsula etapas iniciales, así que también tiene que ser inicial (una encapsulada no puede estar activa sin su encapsulante).', { etapa: stepName(owner) }), [owner.id])
    }
    // Enlaces que entran o salen del marco: el grafcet encapsulado es independiente.
    const insideIds = new Set(membersOf(f, nodes).map((n) => n.id))
    for (const e of edges) {
      if (!byId.has(e.source) || !byId.has(e.target)) continue
      if (insideIds.has(e.source) !== insideIds.has(e.target) && e.source !== owner.id && e.target !== owner.id) {
        add('error', t('Un enlace cruza el marco del grafcet encapsulado {grafcet}: sus etapas solo se activan por el enlace de activación (*) y se desactivan con {etapa}.', { grafcet: frameName(f), etapa: stepName(owner) }), [e.source, e.target])
      }
    }
  }
  for (const s of steps) {
    if (s.data.encapsulating && !frames.some((f) => f.data.kind === 'encapsulation' && String(f.data.step) === String(s.data.label))) {
      add('warning', t('{etapa} es encapsulante pero no tiene su grafcet encapsulado: dibújalo en un marco de encapsulación de la etapa {numero}. Mientras tanto se simula como una etapa normal.', { etapa: stepName(s), numero: s.data.label }), [s.id])
    }
    if (s.data.activationLink && !encapsulated.has(s.id)) {
      add('warning', t('{etapa} tiene enlace de activación (*) pero no está dentro de ningún grafcet encapsulado.', { etapa: stepName(s) }), [s.id])
    }
    if (s.data.encapsulating && s.data.macro) add('error', t('{etapa}: una etapa no puede ser a la vez macroetapa y encapsulante.', { etapa: stepName(s) }), [s.id])
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
        add('error', t('{etapa}: el forzado F/{grafcet}{…} se refiere a un grafcet parcial que no existe (encierra sus etapas en un marco «{grafcet}»).', { etapa: stepName(s), grafcet: f.grafcet }), [s.id])
        continue
      }
      if (grafcetOf(s) === f.grafcet) {
        add('error', t('{etapa}: un grafcet no puede forzarse a sí mismo (F/{grafcet}).', { etapa: stepName(s), grafcet: f.grafcet }), [s.id])
        continue
      }
      const members = grafcetSteps.get(f.grafcet) ?? []
      const missing = f.steps.filter((l) => !members.some((m) => String(m.data.label) === String(l)))
      if (missing.length)
        add(
          'error',
          missing.length > 1
            ? t('{etapa}: las etapas {lista} no son del grafcet {grafcet}.', { etapa: stepName(s), lista: missing.join(', '), grafcet: f.grafcet })
            : t('{etapa}: la etapa {lista} no es del grafcet {grafcet}.', { etapa: stepName(s), lista: missing[0], grafcet: f.grafcet }),
          [s.id],
        )
      const targets = f.mode === 'init' ? members.filter((m) => m.data.initial) : members.filter((m) => f.steps.includes(String(m.data.label)))
      forcedOn.set(s.id, [...(forcedOn.get(s.id) ?? []), ...targets.map((m) => m.id)])
    }
  }
  const forcedTargets = new Set([...forcedOn.values()].flat())

  // Situación inicial: sin etapa inicial el grafcet no puede arrancar.
  if (steps.length && !steps.some((s) => s.data.initial)) {
    add('error', t('No hay ninguna etapa inicial: el grafcet no puede arrancar. Marca al menos una (doble cuadrado).'))
  }

  // Identificación de etapas: número obligatorio y único.
  const byLabel = new Map()
  for (const s of steps) {
    const label = s.data.label?.trim()
    if (!label) add('error', t('Etapa sin número: toda etapa debe estar identificada.'), [s.id])
    else byLabel.set(label, [...(byLabel.get(label) ?? []), s.id])
  }
  for (const [label, ids] of byLabel) {
    if (ids.length > 1) add('error', t('El número de etapa {etapa} está repetido {n} veces.', { etapa: label, n: ids.length }), ids)
  }

  for (const s of steps) {
    if (s.data.macro && s.data.initial) add('error', t('{etapa}: una macroetapa no puede ser inicial.', { etapa: stepName(s) }), [s.id])
  }

  // Alternancia etapa / transición.
  for (const e of edges) {
    const s = byId.get(e.source)
    const tn = byId.get(e.target)
    if (s && tn && s.type === tn.type) {
      add(
        'error',
        s.type === 'step' ? t('Enlace directo entre dos etapas: deben alternarse siempre.') : t('Enlace directo entre dos transiciones: deben alternarse siempre.'),
        [s.id, tn.id],
      )
    }
  }

  for (const s of steps) {
    if (!s.data.initial && incoming(s.id).length === 0 && expansionRole.get(s.id) !== 'entry' && !forcedTargets.has(s.id) && !s.data.activationLink) {
      add('warning', t('{etapa} no tiene enlace de entrada: nunca se activará.', { etapa: stepName(s) }), [s.id])
    }
    // Una etapa encapsulada sin salida es válida: la desactiva su etapa encapsulante.
    if (outgoing(s.id).length === 0 && expansionRole.get(s.id) !== 'exit' && !encapsulated.has(s.id)) {
      add('warning', t('{etapa} no tiene transición de salida: una vez activa no se desactiva nunca.', { etapa: stepName(s) }), [s.id])
    }
  }

  for (const tn of transitions) {
    if (!tn.data.condition?.trim()) {
      add('error', t('Transición sin receptividad: toda transición la necesita (usa 1 si siempre se cumple).'), [tn.id])
    }
    // Transición fuente (sin etapa anterior) y sumidero (sin etapa posterior), IEC 60848: la fuente
    // está siempre validada y activa sus etapas siguientes; el sumidero desactiva las anteriores.
    const out = outgoing(tn.id)
    if (incoming(tn.id).length === 0 && out.length === 0) {
      add('error', t('{transicion} no está unida a ninguna etapa.', { transicion: transitionName(tn) }), [tn.id])
    } else if (incoming(tn.id).length === 0 && !/[↑↓]/.test(tn.data.condition ?? '')) {
      add(
        'warning',
        t('{transicion} es una transición fuente (sin etapa anterior): está siempre validada y, sin un flanco en su receptividad (↑a), se franquea en cada ciclo mientras se cumpla.', {
          transicion: transitionName(tn),
        }),
        [tn.id],
      )
    }
    const loops = out.filter((e) => y(e.target) < y(tn.id))
    if (loops.length && out.length > loops.length) {
      add(
        'error',
        t('{transicion} vuelve atrás y continúa a la vez: activaría ambas etapas simultáneamente. Para «volver O seguir» usa dos transiciones alternativas (divergencia en O).', {
          transicion: transitionName(tn),
        }),
        [tn.id],
      )
    } else if (loops.length > 1 && !loops.every((e) => outgoing(e.target).some((next) => incoming(next.target).length > 1))) {
      // Varios bucles a la vez solo tienen sentido si esas etapas se esperan después en una
      // convergencia en Y (p. ej. devolver un recurso compartido junto con el reposo de su
      // secuencia, IEC 60848); si no, suele ser un «volver aquí O allí» mal dibujado.
      add('error', t('{transicion} tiene varios bucles: activaría todas esas etapas a la vez.', { transicion: transitionName(tn) }), [tn.id])
    }
  }

  // Divergencias en O: las receptividades de una elección deben ser excluyentes; si no, se
  // franquearían varias transiciones a la vez y se activarían varias ramas.
  for (const s of steps) {
    const options = outgoing(s.id)
      .map((e) => byId.get(e.target))
      .filter((v) => v?.type === 'transition' && v.data.condition?.trim())
    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        const [a, b] = [options[i], options[j]].sort((x, y) => x.position.x - y.position.x)
        const ca = a.data.condition.trim()
        const cb = b.data.condition.trim()
        const result = checkExclusive(ca, cb)
        if (result.exclusive === false) {
          add(
            'warning',
            t('Divergencia en O desde la etapa {etapa}: «{a}» y «{b}» pueden cumplirse a la vez (p. ej. con {ejemplo}) y se activarían las dos ramas. Hazlas excluyentes, p. ej. «{arreglo}».', {
              etapa: stepLabel(s),
              a: ca,
              b: cb,
              ejemplo: describeExample(result.example),
              arreglo: exclusiveFix(ca, cb),
            }),
            [s.id, a.id, b.id],
          )
        } else if (result.exclusive === null && result.reason === 'size') {
          add('warning', t('Divergencia en O desde la etapa {etapa}: no se ha podido comprobar si «{a}» y «{b}» son excluyentes (demasiadas variables).', { etapa: stepLabel(s), a: ca, b: cb }), [s.id, a.id, b.id])
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
    queue.push(...(encapsulationLinks.get(id) ?? []))
  }
  if (reached.size) {
    for (const s of steps) {
      if (!reached.has(s.id) && (incoming(s.id).length > 0 || expansionRole.get(s.id) === 'entry')) {
        add('warning', t('{etapa} no es alcanzable desde ninguna etapa inicial.', { etapa: stepName(s) }), [s.id])
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
