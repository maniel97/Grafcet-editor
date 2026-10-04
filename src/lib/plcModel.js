import { normalizeAction } from './actions'
import { actionSymbol, parseExpression, projectVariables } from './symbols'
import { typeInfo } from './addressing'
import { resolveStepPrefix, stepVar } from './stepNames'
import { frameOf, macroName, membersOf } from './frames'
import { parseForcing } from './forcing'
import { analogConfig, isAnalog } from './analog'

// Modelo intermedio grafcet + tabla de variables, independiente del dibujo. Es la entrada
// prevista para el simulador y para la traducción a ladder:
//
// {
//   steps:       [{ id, label, initial, macro, encapsulating, activationLink, variable, address, grafcet, actions: [...], forcings: [...] }]
//   transitions: [{ id, condition, from: [stepId], to: [stepId], alsoSet: [stepId], alsoReset: [stepId], inputs, timers }]
//   variables:   [{ name, type, address, preset, comment, uses: [nodeId] }]
//   grafcets:    [{ name, frameId, steps: [stepId] }]   grafcets parciales (marcos G1, G2...)
//   macros:      [{ stepId, name, frameId, entry, exit, members: [stepId] }]
//   encapsulations: [{ stepId, name, frameId, members: [stepId], links: [stepId] }]
// }
//
// Macroetapas (IEC 60848): si M1 tiene expansión (marco «M1» con E1 ... S1), las transiciones que
// llegaban a M1 activan E1 y las que salían de M1 solo se validan con S1 activa. M1 está activa
// mientras lo esté cualquier etapa de su expansión.
//
// Evolución (IEC 60848): una transición es franqueable si todas sus etapas `from` están
// activas y su receptividad es verdadera; al franquearla se desactivan `from` y se activan `to`.
// En ladder, cada etapa es una marca con SET/RESET según estas reglas.
export function buildPlcModel(nodes, edges, plc) {
  const symbols = projectVariables(nodes, plc.variables)
  const P = resolveStepPrefix(plc)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const stepIdsWhere = (ids) => ids.filter((id) => byId.get(id)?.type === 'step')

  const frames = nodes.filter((n) => n.type === 'frame')
  const stepNodes = nodes.filter((n) => n.type === 'step')
  const steps = stepNodes
    .map((n) => ({
      id: n.id,
      label: n.data.label,
      initial: !!n.data.initial,
      macro: !!n.data.macro,
      encapsulating: !!n.data.encapsulating,
      activationLink: !!n.data.activationLink,
      variable: stepVar(n.data.label, P),
      address: plc.steps[n.id]?.address ?? '',
      comment: plc.steps[n.id]?.comment ?? '',
      grafcet: frameOf(n, frames, 'grafcet')?.data.name?.toUpperCase() ?? null,
      forcings: (n.data.actions ?? []).map((raw) => parseForcing(normalizeAction(raw).text)).filter(Boolean),
      actions: (n.data.actions ?? []).map((raw) => {
        const action = normalizeAction(raw)
        const target = actionSymbol(action)
        return {
          ...action,
          symbol: target?.symbol ?? null,
          address: target ? (plc.variables[target.symbol]?.address ?? '') : '',
        }
      }),
    }))

  // Grafcets parciales (marcos G1, G2...).
  const grafcets = frames
    .filter((f) => f.data.kind === 'grafcet')
    .map((f) => ({
      name: String(f.data.name).toUpperCase(),
      frameId: f.id,
      steps: steps.filter((s) => s.grafcet === String(f.data.name).toUpperCase()).map((s) => s.id),
    }))

  // Expansiones de macroetapas: entrada E.. y salida S.. (o, si no se llaman así, la etapa sin
  // enlaces de entrada / salida dentro del marco).
  const macros = []
  for (const s of steps.filter((x) => x.macro)) {
    const name = macroName(s.label)
    const frame = frames.find((f) => f.data.kind === 'macro' && String(f.data.name).toUpperCase() === name)
    if (!frame) continue
    const members = membersOf(frame, stepNodes).map((n) => n.id)
    const memberSet = new Set(members)
    const linkedInside = (id, dir) =>
      edges.some((e) => {
        const [from, to] = dir === 'in' ? [e.target, e.source] : [e.source, e.target]
        if (from !== id) return false
        // Etapa -> transición -> etapa: se mira la etapa al otro lado de la transición.
        const t = byId.get(to)
        if (t?.type !== 'transition') return false
        return edges.some((e2) => (dir === 'in' ? e2.target === t.id && memberSet.has(e2.source) : e2.source === t.id && memberSet.has(e2.target)))
      })
    const byLabel = (re) => members.find((id) => re.test(String(byId.get(id).data.label)))
    const entry = byLabel(/^E/i) ?? members.find((id) => !linkedInside(id, 'in')) ?? null
    const exit = byLabel(/^S/i) ?? members.find((id) => !linkedInside(id, 'out')) ?? null
    macros.push({ stepId: s.id, name, frameId: frame.id, entry, exit, members })
  }
  // Encapsulaciones (IEC 60848): la etapa encapsulante «5» y su marco (data.step = '5'). Al
  // activarse se activan las etapas de su nivel con enlace de activación (*); al desactivarse, todas
  // las encapsuladas (también las de encapsulaciones anidadas dentro del marco).
  const encapsulations = []
  for (const s of steps.filter((x) => x.encapsulating)) {
    const frame = frames.find((f) => f.data.kind === 'encapsulation' && String(f.data.step) === String(s.label))
    if (!frame) continue
    const members = membersOf(frame, stepNodes).map((n) => n.id).filter((id) => id !== s.id)
    const links = members.filter((id) => byId.get(id).data.activationLink && frameOf(byId.get(id), frames, 'encapsulation')?.id === frame.id)
    encapsulations.push({ stepId: s.id, name: String(frame.data.name ?? ''), frameId: frame.id, members, links })
  }
  // Situación inicial: una etapa encapsulante inicial sin etapas iniciales dentro activa sus enlaces.
  const initialLinks = encapsulationActivations(
    encapsulations,
    encapsulations.filter((e) => steps.find((x) => x.id === e.stepId)?.initial && !e.members.some((id) => steps.find((x) => x.id === id)?.initial)).map((e) => e.stepId),
  )
  for (const s of steps) if (initialLinks.includes(s.id)) s.initial = true

  const entryOf = new Map(macros.filter((m) => m.entry).map((m) => [m.stepId, m.entry]))
  const exitOf = new Map(macros.filter((m) => m.exit).map((m) => [m.stepId, m.exit]))

  const transitions = nodes
    .filter((n) => n.type === 'transition')
    .map((n) => {
      const { inputs, timers } = parseExpression(n.data.condition)
      return {
        id: n.id,
        condition: n.data.condition ?? '',
        from: stepIdsWhere(edges.filter((e) => e.target === n.id).map((e) => e.source)).map((id) => exitOf.get(id) ?? id),
        to: stepIdsWhere(edges.filter((e) => e.source === n.id).map((e) => e.target)).map((id) => entryOf.get(id) ?? id),
        inputs,
        timers: timers.map((t) => t.key),
      }
    })
  // Lo que además hace cada transición por las encapsulaciones: activar los enlaces de las
  // encapsulantes que activa y desactivar lo encapsulado por las que desactiva.
  for (const t of transitions) {
    t.alsoSet = encapsulationActivations(encapsulations, t.to).filter((id) => !t.to.includes(id))
    const leaving = t.from.filter((id) => !t.to.includes(id))
    t.alsoReset = [...new Set(encapsulations.filter((e) => leaving.includes(e.stepId)).flatMap((e) => e.members))].filter((id) => !t.to.includes(id) && !t.alsoSet.includes(id))
  }

  const variables = [...symbols].map(([name, found]) => {
    const entry = plc.variables[name] ?? {}
    const type = entry.type ?? found.type
    return {
      name,
      type,
      typeLabel: typeInfo(type).label,
      address: entry.address ?? '',
      preset: entry.preset ?? found.preset ?? '',
      comment: entry.comment ?? '',
      uses: [...found.uses],
      // Analógicas: señal y rango físico (lib/analog.js).
      ...(isAnalog(type) ? { analog: analogConfig(entry) } : {}),
    }
  })

  return { steps, transitions, variables, grafcets, macros, encapsulations }
}

// Etapas que se activan al activarse unas etapas encapsulantes: sus enlaces de activación (*) y,
// si alguno es a su vez encapsulante, los de este, etc.
export function encapsulationActivations(encapsulations, stepIds) {
  const byStep = new Map(encapsulations.map((e) => [e.stepId, e]))
  const out = []
  const queue = [...stepIds]
  while (queue.length) {
    const e = byStep.get(queue.shift())
    if (!e) continue
    for (const id of e.links) {
      if (out.includes(id)) continue
      out.push(id)
      queue.push(id)
    }
  }
  return out
}
