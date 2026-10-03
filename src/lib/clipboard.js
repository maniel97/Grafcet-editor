import { nextStepLabel, nextTransitionLabel } from './layout'

export const PASTE_OFFSET = 40

// Copia de los nodos seleccionados y de los enlaces entre ellos (los enlaces hacia fuera de la
// selección no se copian: quedarían colgando).
export function copySelection(nodes, edges) {
  // La tabla de variables del lienzo es única: no se copia.
  const selected = nodes.filter((n) => n.selected && n.type !== 'variables')
  const ids = new Set(selected.map((n) => n.id))
  if (!ids.size) return null
  return {
    // width/height: tamaño de las notas (las etapas y transiciones no lo llevan).
    nodes: selected.map(({ id, type, position, data, width, height }) => ({ id, type, position, data, width, height })),
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  }
}

// Prepara una copia para pegar: ids nuevos, desplazada y con las etapas renumeradas para no
// repetir números (la norma exige que sean únicos). Las transiciones con nombre automático
// (T1, T2...) también se renumeran; las receptividades escritas a mano se conservan.
export function prepareClipboard(clip, existingNodes, offset = PASTE_OFFSET) {
  const idMap = new Map()
  const working = [...existingNodes]
  const nodes = clip.nodes.map((n) => {
    const id = crypto.randomUUID()
    idMap.set(n.id, id)
    // Sin hoja: lo pegado va a la hoja activa (lib/sheets.js).
    let data = { ...n.data }
    delete data.sheet
    if (n.type === 'step') data = { ...data, label: nextStepLabel(working) }
    else if (/^T\d+$/i.test(String(data.condition ?? '').trim())) data = { ...data, condition: nextTransitionLabel(working) }
    const node = { id, type: n.type, position: { x: n.position.x + offset, y: n.position.y + offset }, data, selected: true }
    if (n.width) Object.assign(node, { width: n.width, height: n.height })
    working.push(node)
    return node
  })
  const edges = clip.edges.map((e) => {
    const source = idMap.get(e.source)
    const target = idMap.get(e.target)
    return { ...e, id: `e-${source}-${target}`, source, target, selected: false }
  })
  return { nodes, edges }
}
