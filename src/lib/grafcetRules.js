// Reglas estructurales de IEC 60848 que el editor hace cumplir.
//
// - Etapas y transiciones se alternan: nunca se unen dos del mismo tipo.
// - Todas las etapas de salida de una transición se activan A LA VEZ al franquearla. Por eso
//   una transición tiene como salida, o bien un único bucle (enlace hacia arriba), o bien una o
//   varias etapas hacia abajo (varias = divergencia en Y). Mezclar bucle y etapas significaría
//   "volver Y seguir a la vez", casi nunca lo que se quiere: "volver O seguir" se modela con
//   dos transiciones alternativas desde la etapa anterior (divergencia en O).

// Salida actual de una transición: null (ninguna), 'loop' (vuelve hacia arriba) o 'step' (sigue hacia abajo).
export function transitionOutput(transitionId, edges, yOf) {
  const out = edges.filter((e) => e.source === transitionId)
  if (!out.length) return null
  const y = yOf(transitionId)
  return out.some((e) => yOf(e.target) < y) ? 'loop' : 'step'
}

export function isValidGrafcetConnection({ source, target }, getNode, edges) {
  const s = getNode(source)
  const t = getNode(target)
  if (!s || !t || s.type === t.type) return false
  if (s.type !== 'transition') return true

  const yOf = (id) => getNode(id)?.position.y ?? Infinity
  const others = edges.filter((e) => !(e.source === source && e.target === target))
  const current = transitionOutput(source, others, yOf)
  if (!current) return true
  const goesUp = t.position.y < s.position.y
  // Solo se admite añadir más etapas hacia abajo a una salida que ya va hacia abajo (rama en Y).
  return current === 'step' && !goesUp
}
