// Separa las columnas de un grafcet en horizontal para que ningún texto (receptividades, acciones)
// pise lo que tiene a su derecha. Las medidas dependen de la letra y el tamaño, así que se toman del
// lienzo ya dibujado: boxes[id] = { left, right, top, bottom } del cuerpo del nodo y { textRight,
// textTop, textBottom } de lo que dibuja a su derecha, en coordenadas del lienzo.
// Se escalan las distancias entre centros con un mismo factor (desde la columna de más a la
// izquierda): las columnas siguen alineadas y las ramas conservan su forma.

const MARGIN = 16
const MAX_FACTOR = 3
const NOTE_GAP = 40

export function spreadFactor(boxes) {
  const list = Object.values(boxes)
  let factor = 1
  for (const a of list) {
    const ca = (a.left + a.right) / 2
    for (const b of list) {
      const cb = (b.left + b.right) / 2
      if (b === a || cb - ca < 1) continue
      if (a.textBottom <= b.top || b.bottom <= a.textTop) continue // no comparten altura
      const missing = a.textRight + MARGIN - b.left
      if (missing > 0) factor = Math.max(factor, (cb - ca + missing) / (cb - ca))
    }
  }
  return Math.min(MAX_FACTOR, factor)
}

// Aplica el factor: etapas y transiciones por su centro; marcos (posición y ancho) por su borde
// izquierdo, y las notas de la derecha, además, a la derecha de los textos (mantienen su hueco;
// también sin separar columnas, si ya los pisaban).
// El resto de nodos no se mueve.
export function spreadNodes(nodes, boxes, factor) {
  const centers = Object.values(boxes).map((b) => (b.left + b.right) / 2)
  if (!centers.length) return nodes
  const origin = Math.min(...centers)
  const scale = (x) => origin + (x - origin) * factor
  const textRight = Math.max(...Object.values(boxes).map((b) => b.textRight))
  const scaledTextRight = Math.max(...Object.values(boxes).map((b) => scale((b.left + b.right) / 2) + b.textRight - (b.left + b.right) / 2))
  const placeNote = (x) => {
    if (x <= Math.max(...centers)) return Math.round(scale(x)) // notas entre columnas o a la izquierda
    return Math.round(Math.max(scale(x), scaledTextRight + Math.max(NOTE_GAP, x - textRight)))
  }
  return nodes.map((n) => {
    const box = boxes[n.id]
    if (box) {
      const half = (box.right - box.left) / 2
      return { ...n, position: { ...n.position, x: Math.round(scale(box.left + half) - half) } }
    }
    if (n.type === 'frame') {
      const x = Math.round(scale(n.position.x))
      const right = scale(n.position.x + (n.width ?? n.measured?.width ?? 0))
      return { ...n, position: { ...n.position, x }, ...(n.width ? { width: Math.round(right - x) } : {}) }
    }
    if (n.type === 'note') return { ...n, position: { ...n.position, x: placeNote(n.position.x) } }
    return n
  })
}
