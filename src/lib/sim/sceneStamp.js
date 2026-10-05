// Tampón de la paleta de la planta: dónde poner una pieza nueva sin pisar lo que hay y cómo
// repartir una fila al arrastrar (el «pincel»). Puro: se prueba sin navegador.
// Las medidas son de la escena; `bounds(element)` da su rectángulo { x, y, w, h }.

export const GAP = 20 // hueco entre piezas de una fila
const STEP = 20 // paso al buscar un hueco libre (el de la rejilla grande)

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m })

// ¿Se monta el elemento sobre alguno de los otros?
export const collides = (element, others, bounds) => {
  const b = bounds(element)
  return others.some((o) => overlaps(b, bounds(o)))
}

// Primer sitio libre (de izquierda a derecha y de arriba abajo) dentro de la zona visible
// `view` { x, y, w, h } para `element` (se prueba moviendo su origen); con un margen de 10 a lo
// que hay. Si no cabe en ningún sitio, el centro de la zona visible.
export function freeSpot(element, others, bounds, view) {
  const at = (x, y) => ({ ...element, x, y })
  const occupied = others.map((o) => grow(bounds(o), 10))
  const box0 = bounds(at(0, 0)) // el rectángulo respecto al origen
  for (let y = Math.ceil((view.y - box0.y) / STEP) * STEP; y + box0.y + box0.h <= view.y + view.h; y += STEP) {
    for (let x = Math.ceil((view.x - box0.x) / STEP) * STEP; x + box0.x + box0.w <= view.x + view.w; x += STEP) {
      const b = bounds(at(x, y))
      if (!occupied.some((o) => overlaps(b, o))) return { x, y }
    }
  }
  const snap = (v) => Math.round(v / STEP) * STEP
  return { x: snap(view.x + view.w / 2 - box0.w / 2 - box0.x), y: snap(view.y + view.h / 2 - box0.h / 2 - box0.y) }
}

// Fila de piezas al arrastrar del punto `from` al `to`: en la dirección dominante (horizontal o
// vertical), una cada (tamaño de la pieza en esa dirección + GAP). -> [{ x, y }] (la primera, en
// `from`). Sin arrastre apreciable, una sola.
export function stampRow(from, to, size) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const along = horizontal ? dx : dy
  const step = (horizontal ? size.w : size.h) + GAP
  const count = Math.floor(Math.abs(along) / step) + 1
  const sign = Math.sign(along) || 1
  return Array.from({ length: Math.min(count, 50) }, (_, i) =>
    horizontal ? { x: from.x + sign * i * step, y: from.y } : { x: from.x, y: from.y + sign * i * step },
  )
}
