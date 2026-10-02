import { normalizeAction } from './actions'
import { actionSymbol, parseExpression, projectVariables } from './symbols'
import { typeInfo } from './addressing'
import { resolveStepPrefix, stepVar } from './stepNames'

// Modelo intermedio grafcet + tabla de variables, independiente del dibujo. Es la entrada
// prevista para el simulador y para la traducción a ladder:
//
// {
//   steps:       [{ id, label, initial, macro, variable, address, actions: [...] }]
//   transitions: [{ id, condition, from: [stepId], to: [stepId], inputs, timers }]
//   variables:   [{ name, type, address, preset, comment, uses: [nodeId] }]
// }
//
// Evolución (IEC 60848): una transición es franqueable si todas sus etapas `from` están
// activas y su receptividad es verdadera; al franquearla se desactivan `from` y se activan `to`.
// En ladder, cada etapa es una marca con SET/RESET según estas reglas.
export function buildPlcModel(nodes, edges, plc) {
  const symbols = projectVariables(nodes, plc.variables)
  const P = resolveStepPrefix(plc)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const stepIdsWhere = (ids) => ids.filter((id) => byId.get(id)?.type === 'step')

  const steps = nodes
    .filter((n) => n.type === 'step')
    .map((n) => ({
      id: n.id,
      label: n.data.label,
      initial: !!n.data.initial,
      macro: !!n.data.macro,
      variable: stepVar(n.data.label, P),
      address: plc.steps[n.id]?.address ?? '',
      comment: plc.steps[n.id]?.comment ?? '',
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

  const transitions = nodes
    .filter((n) => n.type === 'transition')
    .map((n) => {
      const { inputs, timers } = parseExpression(n.data.condition)
      return {
        id: n.id,
        condition: n.data.condition ?? '',
        from: stepIdsWhere(edges.filter((e) => e.target === n.id).map((e) => e.source)),
        to: stepIdsWhere(edges.filter((e) => e.source === n.id).map((e) => e.target)),
        inputs,
        timers: timers.map((t) => t.key),
      }
    })

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
    }
  })

  return { steps, transitions, variables }
}
