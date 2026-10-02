// Navegación por el grafcet con el teclado (Alt + flechas), sin ratón.
//   abajo: el siguiente en la secuencia (si hay ramificación, la rama de más a la izquierda)
//   arriba: el anterior (sin contar los bucles, que llegan desde abajo)
//   izquierda / derecha: el elemento del mismo tipo más cercano a esa altura (ramas vecinas)
// Sin nada seleccionado se empieza por la etapa inicial (o la primera etapa).

const NAVIGABLE = new Set(['step', 'transition'])
const SAME_ROW = 40 // px de diferencia vertical para considerar que están a la misma altura

const byX = (a, b) => a.position.x - b.position.x

export function startNode(nodes) {
  const steps = nodes.filter((n) => n.type === 'step')
  return steps.find((n) => n.data.initial) ?? steps.sort((a, b) => a.position.y - b.position.y || byX(a, b))[0] ?? null
}

export function neighbor(nodes, edges, current, dir) {
  if (!current || !NAVIGABLE.has(current.type)) return startNode(nodes)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const { x, y } = current.position

  if (dir === 'down' || dir === 'up') {
    const linked =
      dir === 'down'
        ? edges.filter((e) => e.source === current.id).map((e) => byId.get(e.target))
        : edges.filter((e) => e.target === current.id).map((e) => byId.get(e.source))
    const candidates = linked.filter((n) => n && NAVIGABLE.has(n.type) && (dir === 'down' ? n.position.y > y : n.position.y < y))
    // La más cercana en horizontal: en una convergencia se vuelve por la misma rama.
    return candidates.sort((a, b) => Math.abs(a.position.x - x) - Math.abs(b.position.x - x) || byX(a, b))[0] ?? null
  }

  const sign = dir === 'right' ? 1 : -1
  const candidates = nodes.filter(
    (n) => n.id !== current.id && n.type === current.type && Math.abs(n.position.y - y) <= SAME_ROW && (n.position.x - x) * sign > 0,
  )
  return candidates.sort((a, b) => Math.abs(a.position.x - x) - Math.abs(b.position.x - x))[0] ?? null
}

export const ARROWS = {
  ArrowUp: { dir: 'up', dx: 0, dy: -1 },
  ArrowDown: { dir: 'down', dx: 0, dy: 1 },
  ArrowLeft: { dir: 'left', dx: -1, dy: 0 },
  ArrowRight: { dir: 'right', dx: 1, dy: 0 },
}
