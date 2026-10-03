// Recorrido ortogonal de un cable (o tubo) entre dos bornes: el mismo en el editor (WireEdge) y en
// el plano estático (ElecStatic), para que lo que se ve al editar sea lo que sale en el PDF.
//  a, b: { x, y, side: 'top' | 'bottom' } (cada borne saca el cable hacia su lado);
//  bend: altura del tramo horizontal, para separar cables paralelos (si no, automática);
//  bendX: posición del tramo vertical cuando el cable tiene que rodear (sale hacia el lado
//  contrario de donde está el otro borne). Los dos, medidos desde el borne `a` (así el cable
//  conserva su forma al mover los aparatos).
// Devuelve { points: [{ x, y }…], label: { x, y } } (el número de cable, en el tramo principal).
export const OUT = 20

export function wireRoute(a, b, { bend, bendX } = {}) {
  const dir = (p) => (p.side === 'top' ? -1 : 1)
  const has = (v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))
  // (Con 10 px de tolerancia: dos bornes a la misma altura, uno debajo de otro, se unen en recto.)
  const facing = (p, q) => (dir(p) > 0 ? q.y >= p.y - 10 : q.y <= p.y + 10) && dir(p) !== dir(q)
  let points
  if (dir(a) !== dir(b) && facing(a, b)) {
    // Uno hacia el otro (p. ej. de un borne de abajo a uno de arriba más bajo): recto si están en
    // la misma vertical; si no, con un tramo horizontal entre los dos.
    if (a.x === b.x && !has(bend)) points = [a, b]
    else {
      const lo = Math.min(a.y, b.y)
      const hi = Math.max(a.y, b.y)
      const y = has(bend) ? Math.min(hi, Math.max(lo, a.y + Number(bend))) : (a.y + b.y) / 2
      points = [a, { x: a.x, y }, { x: b.x, y }, b]
    }
  } else if (dir(a) === dir(b)) {
    // Los dos hacia arriba (o hacia abajo): el tramo horizontal por encima (o por debajo) de ambos.
    const y = has(bend) ? a.y + Number(bend) : dir(a) < 0 ? Math.min(a.y, b.y) - OUT : Math.max(a.y, b.y) + OUT
    points = [a, { x: a.x, y }, { x: b.x, y }, b]
  } else {
    // De espaldas: sale de cada borne hacia su lado y rodea por un tramo vertical.
    const a1 = { x: a.x, y: a.y + dir(a) * OUT }
    const b1 = { x: b.x, y: b.y + dir(b) * OUT }
    const x = has(bendX) ? a.x + Number(bendX) : a.x === b.x ? a.x + 2 * OUT : (a.x + b.x) / 2
    points = [a, a1, { x, y: a1.y }, { x, y: b1.y }, b1, b]
  }
  // Sin puntos repetidos (tramos de longitud cero).
  points = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y)
  // Número de cable: en el tramo más largo.
  let best = { len: -1, x: a.x, y: a.y }
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1]
    const q = points[i]
    const len = Math.abs(q.x - p.x) + Math.abs(q.y - p.y)
    if (len > best.len) best = { len, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
  }
  return { points, label: { x: best.x, y: best.y } }
}

export const routePath = (points) => points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
