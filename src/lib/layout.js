// Numeración automática y colocación sin solapes en la cuadrícula.

export const GRID = 10

// Tamaños por defecto (antes de que React Flow mida el nodo).
const SIZE = {
  step: { width: 56, height: 56 },
  transition: { width: 56, height: 24 },
}
// La receptividad se dibuja fuera de la caja de la transición: se reserva hueco para ella,
// proporcional al tamaño del texto del diagrama (140px con la letra por defecto de 14px).
// El tamaño lo comunica la configuración (lib/settings.js) al aplicarse: así no hay que leer
// estilos del navegador, que es caro y se haría en cada enlace al arrastrar.
let diagramFontSize = 14
export function setDiagramFontSize(px) {
  diagramFontSize = Number(px) || 14
}
export const transitionLabelSpace = () => Math.round(140 * (diagramFontSize / 14))
const MARGIN = 20

// Distancia vertical (de borde superior a borde superior) al encadenar nodos.
const STEP_TO_TRANSITION = 100
const TRANSITION_TO_STEP = 70
// Desplazamiento a la derecha cuando el hueco de debajo está ocupado (divergencia).
// Debe superar el ancho de una transición con su etiqueta más el margen, para ocupar una sola columna.
const COLUMN_SHIFT = 240

const snap = (v) => Math.round(v / GRID) * GRID

// Separa "E12" en prefijo "E" y número 12; "3" -> "" y 3.
function parseNumbered(text) {
  const m = /^(.*?)(\d+)\s*$/.exec(String(text ?? '').trim())
  return m ? { prefix: m[1], number: parseInt(m[2], 10) } : null
}

// Siguiente etapa: mayor número usado + 1, conservando el prefijo que use el diagrama (p. ej. "E").
export function nextStepLabel(nodes) {
  const parsed = nodes.filter((n) => n.type === 'step').map((n) => parseNumbered(n.data.label)).filter(Boolean)
  if (!parsed.length) return '0'
  const last = parsed.reduce((a, b) => (b.number > a.number ? b : a))
  return `${last.prefix}${last.number + 1}`
}

// Siguiente transición: T1, T2... sin repetir número y sin quedar por detrás del total de transiciones.
export function nextTransitionLabel(nodes) {
  const transitions = nodes.filter((n) => n.type === 'transition')
  const used = transitions
    .map((n) => /^T(\d+)$/i.exec(String(n.data.condition ?? '').trim()))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10))
  return `T${Math.max(transitions.length, ...used) + 1}`
}

function rectOf(node) {
  const base = SIZE[node.type] ?? SIZE.step
  const width = node.measured?.width ?? base.width
  const height = node.measured?.height ?? base.height
  const extra = node.type === 'transition' ? transitionLabelSpace() : 0
  return { x: node.position.x, y: node.position.y, width: width + extra, height }
}

const overlaps = (a, b) =>
  a.x < b.x + b.width + MARGIN &&
  b.x < a.x + a.width + MARGIN &&
  a.y < b.y + b.height + MARGIN &&
  b.y < a.y + a.height + MARGIN

// Ajusta `position` a la cuadrícula y, si choca con otro nodo, la desplaza a la derecha
// hasta encontrar sitio libre.
export function findFreePosition(position, type, nodes) {
  const candidate = rectOf({ type, position: { x: snap(position.x), y: snap(position.y) } })
  const others = nodes.map(rectOf)
  for (let i = 0; i < 50 && others.some((r) => overlaps(candidate, r)); i++) {
    candidate.x += COLUMN_SHIFT
  }
  return { x: candidate.x, y: candidate.y }
}

// Coordenada y para el siguiente elemento de la secuencia bajo `source`.
export const yBelow = (source) => source.position.y + (source.type === 'step' ? STEP_TO_TRANSITION : TRANSITION_TO_STEP)

// Posición para un nodo nuevo de `type` colocado debajo de `source`, alineado en vertical con él.
export function positionBelow(source, type, nodes) {
  return findFreePosition({ x: source.position.x, y: yBelow(source) }, type, nodes)
}
