// Ordenar nodos seleccionados: alinear en columna y espaciar la secuencia con las distancias
// estándar del editor (las mismas que usa el "+" al encadenar). Solo etapas y transiciones.
// Devuelven un Map id -> nueva posición; los nodos que no cambian no aparecen.

import { GRID } from './layout'

const STEP_TO_TRANSITION = 100
const TRANSITION_TO_STEP = 70
const isGrafcet = (n) => n.type === 'step' || n.type === 'transition'
const snap = (v) => Math.round(v / GRID) * GRID

// Todos a la x del nodo más alto (etapas y transiciones miden 56 px de ancho: quedan centrados).
export function alignColumn(nodes) {
  const list = nodes.filter(isGrafcet)
  if (list.length < 2) return new Map()
  const top = list.reduce((a, b) => (b.position.y < a.position.y ? b : a))
  const x = snap(top.position.x)
  return new Map(list.filter((n) => n.position.x !== x).map((n) => [n.id, { x, y: n.position.y }]))
}

// De arriba abajo, cada nodo a la distancia estándar del anterior: etapa -> transición 100 px,
// transición -> etapa 70 px (entre dos del mismo tipo, 100 px). El primero no se mueve.
export function spaceSequence(nodes) {
  const list = nodes.filter(isGrafcet).sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
  const moves = new Map()
  if (list.length < 2) return moves
  let y = list[0].position.y
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1]
    y += prev.type === 'transition' && list[i].type === 'step' ? TRANSITION_TO_STEP : STEP_TO_TRANSITION
    if (list[i].position.y !== y) moves.set(list[i].id, { x: list[i].position.x, y })
  }
  return moves
}
