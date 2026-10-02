// Trazado de enlaces según IEC 60848:
// - Los enlaces se leen de arriba abajo. El que sube (bucle / reprise de séquence) se dibuja
//   por la izquierda del diagrama y lleva una flecha hacia arriba.
// - El que baja saltándose nodos (salto de etapas) rodea por la derecha, sin flecha.
// - Divergencias desde una etapa doblan justo debajo de ella; convergencias hacia una etapa
//   doblan justo encima, de modo que las ramas se unen en una línea horizontal (ramificación en O).
// - Una transición con varias etapas de salida, o varias etapas hacia una misma transición,
//   es una ramificación en Y: las ramas se unen con una doble línea horizontal.

import { transitionLabelSpace } from './layout'

const STUB = 20 // tramo vertical al salir del origen y al entrar en el destino
const LANE_GAP = 30 // separación entre el carril lateral y el nodo más exterior
const LANE_STEP = 20 // separación entre carriles de bucles anidados
const ARROW = 6
const DOUBLE_GAP = 5 // separación entre las dos líneas de una ramificación en Y
const DOUBLE_OVERHANG = 16 // cuánto sobresale la doble línea de las ramas extremas

function box(node, labelSpace) {
  const { x, y } = node.internals.positionAbsolute
  const width = node.measured?.width ?? 56
  const height = node.measured?.height ?? 56
  return { id: node.id, x, y, width, height, right: x + width + (node.type === 'transition' ? labelSpace : 0) }
}

// Índice compartido por todos los enlaces de un mismo estado del lienzo: cajas de los nodos,
// enlaces hacia abajo por nodo y bucles. Cada enlace calcula su ruta en cada cambio del lienzo
// (al arrastrar, en cada movimiento); con el índice, el recorrido de todos los nodos y enlaces
// se hace una vez por cambio y no una vez por enlace.
let cache = { nodes: null, edges: null, labelSpace: null, index: null }

function routingIndex(state) {
  const labelSpace = transitionLabelSpace()
  if (cache.nodes === state.nodes && cache.edges === state.edges && cache.labelSpace === labelSpace) return cache.index
  const { nodeLookup, edgeLookup } = state
  // Solo etapas y transiciones son obstáculos (no la tabla de variables del lienzo).
  const boxes = []
  for (const n of nodeLookup.values()) if (n.type === 'step' || n.type === 'transition') boxes.push(box(n, labelSpace))
  const yOf = (id) => nodeLookup.get(id)?.internals.positionAbsolute.y
  const forwardOut = new Map()
  const forwardIn = new Map()
  const loops = []
  for (const e of edgeLookup.values()) {
    const ys = yOf(e.source)
    const yt = yOf(e.target)
    if (ys === undefined || yt === undefined) continue
    if (yt > ys) {
      forwardOut.set(e.source, (forwardOut.get(e.source) ?? 0) + 1)
      forwardIn.set(e.target, (forwardIn.get(e.target) ?? 0) + 1)
    } else if (yt < ys) loops.push({ id: e.id, top: yt, bottom: ys, source: e.source })
  }
  // Grafcets conexos: los obstáculos de un enlace son solo los de su mismo grafcet (dos grafcets
  // independientes uno al lado del otro no se rodean entre sí).
  const parent = new Map()
  const find = (x) => {
    while (parent.has(x) && parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)) ?? parent.get(x))
      x = parent.get(x)
    }
    return x
  }
  for (const e of edgeLookup.values()) {
    if (!nodeLookup.has(e.source) || !nodeLookup.has(e.target)) continue
    const a = find(e.source)
    const b = find(e.target)
    if (a !== b) parent.set(a, b)
  }
  for (const b of boxes) b.group = find(b.id)
  for (const l of loops) l.group = find(l.source)
  const index = { boxes, forwardOut, forwardIn, loops, groupOf: find }
  cache = { nodes: state.nodes, edges: state.edges, labelSpace, index }
  return index
}

// Decide el tipo de trazado de un enlace a partir del estado del lienzo.
// Devuelve un objeto pequeño y comparable para no re-renderizar el enlace sin necesidad.
export function computeRoute(state, { id, source, target, sourceX, sourceY, targetY }) {
  const { nodeLookup } = state
  const src = nodeLookup.get(source)
  const tgt = nodeLookup.get(target)
  if (!src || !tgt) return { kind: 'down', bendAtSource: false, laneX: 0 }
  const index = routingIndex(state)

  const top = Math.min(sourceY, targetY) - STUB
  const bottom = Math.max(sourceY, targetY) + STUB
  const group = index.groupOf(source)
  const inSpan = index.boxes.filter((b) => b.group === group && b.id !== source && b.id !== target && b.y < bottom && b.y + b.height > top)

  if (targetY < sourceY) {
    // Bucle: carril a la izquierda de todo lo que hay en su recorrido vertical. Los bucles
    // anidados dentro de este (p. ej. volver a 1 dentro de volver a 0) van más al interior.
    const myTop = tgt.internals.positionAbsolute.y
    const myBottom = src.internals.positionAbsolute.y
    let depth = 0
    for (const loop of index.loops) {
      if (loop.id === id || loop.group !== group) continue
      const inside = loop.top >= myTop && loop.bottom <= myBottom
      if (inside && (loop.top !== myTop || loop.bottom !== myBottom)) depth++
    }
    let minX = Math.min(sourceX, src.internals.positionAbsolute.x, tgt.internals.positionAbsolute.x)
    for (const b of inSpan) minX = Math.min(minX, b.x)
    return { kind: 'loop', bendAtSource: false, laneX: minX - LANE_GAP - depth * LANE_STEP }
  }

  // Ramificaciones en Y: una transición con varias etapas de salida (divergencia) o varias
  // etapas que llegan a una misma transición (convergencia) se unen por una doble línea.
  if (src.type === 'transition' && tgt.type === 'step' && (index.forwardOut.get(source) ?? 0) >= 2) {
    return { kind: 'andDiv', bendAtSource: true, laneX: 0 }
  }
  if (src.type === 'step' && tgt.type === 'transition' && (index.forwardIn.get(target) ?? 0) >= 2) {
    return { kind: 'andConv', bendAtSource: false, laneX: 0 }
  }

  // Salto hacia abajo: si hay nodos en la vertical del origen ENTRE origen y destino, rodea por la
  // derecha. Los que están a la altura del destino no cuentan: son ramas hermanas de una
  // divergencia (p. ej. otra transición alternativa bajo la misma etapa), no obstáculos.
  const blocked = inSpan.some((b) => b.x <= sourceX && sourceX <= b.x + b.width && b.y + b.height > sourceY && b.y < targetY)
  if (blocked) {
    let maxRight = src.internals.positionAbsolute.x + 56
    for (const b of inSpan) maxRight = Math.max(maxRight, b.right)
    return { kind: 'skip', bendAtSource: false, laneX: maxRight + LANE_GAP }
  }

  return { kind: 'down', bendAtSource: src.type === 'step', laneX: 0 }
}

export const sameRoute = (a, b) => a.kind === b.kind && a.laneX === b.laneX && a.bendAtSource === b.bendAtSource

// Construye el trazado SVG (y la flecha, si procede) para la ruta calculada.
export function buildPath(route, sx, sy, tx, ty) {
  if (route.kind === 'loop' || route.kind === 'skip') {
    const x = route.laneX
    const path = `M ${sx} ${sy} V ${sy + STUB} H ${x} V ${ty - STUB} H ${tx} V ${ty}`
    if (route.kind === 'skip') return { path }
    // Flecha hacia arriba en el centro del tramo vertical del carril.
    const midY = (sy + ty) / 2
    const arrow = `M ${x - ARROW} ${midY + ARROW} L ${x} ${midY - ARROW} L ${x + ARROW} ${midY + ARROW} Z`
    return { path, arrow }
  }

  if (route.kind === 'andDiv' || route.kind === 'andConv') {
    // Cada rama dibuja su tramo de doble línea, prolongado un poco a ambos lados: la unión de
    // todas las ramas forma la doble barra completa, que sobresale de las ramas extremas.
    const top = route.kind === 'andDiv' ? sy + STUB : ty - STUB - DOUBLE_GAP
    const bottom = top + DOUBLE_GAP
    const left = Math.min(sx, tx) - DOUBLE_OVERHANG
    const right = Math.max(sx, tx) + DOUBLE_OVERHANG
    return {
      path:
        `M ${sx} ${sy} V ${top} ` +
        `M ${left} ${top} H ${right} M ${left} ${bottom} H ${right} ` +
        `M ${tx} ${bottom} V ${ty}`,
    }
  }

  if (Math.abs(sx - tx) < 1) return { path: `M ${sx} ${sy} V ${ty}` }
  const gap = ty - sy
  const bendY = gap < STUB * 2 ? sy + gap / 2 : route.bendAtSource ? sy + STUB : ty - STUB
  return { path: `M ${sx} ${sy} V ${bendY} H ${tx} V ${ty}` }
}
