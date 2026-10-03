// Varias hojas por proyecto. Cada elemento lleva su hoja en data.sheet y la lista de hojas va en el
// proyecto (plc.sheets). El lienzo solo dibuja la hoja activa; la simulación, el ladder y Verificar
// ven el proyecto entero (es un solo programa). Los enlaces entre hojas se dibujan como referencias
// («a la etapa 5 (Hoja 2)»).

export const FIRST_SHEET = { id: 'h1', name: 'Hoja 1' }

export const sheetsOf = (plc) => (plc.sheets?.length ? plc.sheets : [FIRST_SHEET])

// Hoja de un elemento; sin hoja (recién creado, pegado, de un ejemplo...) es de la hoja activa.
export const sheetOf = (node, current) => node.data?.sheet ?? current

// Nodos y enlaces para el lienzo: los de otras hojas, ocultos (sin crear objetos nuevos si no
// cambia nada, para no redibujar de más). Los enlaces entre hojas también se ocultan: se dibujan
// como referencias (crossSheetRefs).
export function visibleNodes(nodes, current) {
  return nodes.map((n) => {
    const hide = sheetOf(n, current) !== current
    return !!n.hidden === hide ? n : { ...n, hidden: hide }
  })
}
export function visibleEdges(edges, nodes, current) {
  const sheet = new Map(nodes.map((n) => [n.id, sheetOf(n, current)]))
  return edges.map((e) => {
    const hide = sheet.get(e.source) !== sheet.get(e.target) || sheet.get(e.source) !== current
    return !!e.hidden === hide ? e : { ...e, hidden: hide }
  })
}

const describe = (n) => (!n ? '?' : n.type === 'step' ? `la etapa ${n.data.label}` : `«${String(n.data.condition ?? '').trim() || 'transición'}»`)

// Referencias de los enlaces entre hojas que tocan a la hoja activa:
// [{ nodeId, side: 'out' | 'in', text }] («a la etapa 5 (Hoja 2)» / «de «Fc» (Hoja 1)»).
export function crossSheetRefs(nodes, edges, plc, current) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const name = new Map(sheetsOf(plc).map((s) => [s.id, s.name]))
  const refs = []
  for (const e of edges) {
    const a = byId.get(e.source)
    const b = byId.get(e.target)
    if (!a || !b) continue
    const sa = sheetOf(a, current)
    const sb = sheetOf(b, current)
    if (sa === sb) continue
    if (sa === current) refs.push({ nodeId: a.id, side: 'out', text: `a ${describe(b)} (${name.get(sb) ?? sb})` })
    if (sb === current) refs.push({ nodeId: b.id, side: 'in', text: `de ${describe(a)} (${name.get(sa) ?? sa})` })
  }
  return refs
}
