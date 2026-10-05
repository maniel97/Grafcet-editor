// Vista isométrica de la planta (scene.view === 'iso'; solo la vista desde arriba). El plano de la
// escena se apoya en el suelo, girado 45° y aplastado a la mitad (la isométrica «2:1» de los
// juegos), y cada elemento se levanta a su altura: su dibujo plano de siempre es la cara de arriba y
// se le añaden las dos caras que se ven (la de delante a la izquierda, «sur», y la de delante a la
// derecha, «este»). Solo es dibujo: coordenadas, física y clics no cambian (el SVG deshace la
// matriz al convertir el ratón a la escena).
//
// Todo se dibuja en coordenadas de la escena dentro de un grupo con ISO_MATRIX: subir z píxeles en
// la pantalla es desplazarse (-√2·z, -√2·z) en la escena (lift).
import { reliefBoxes } from './relief'

const K = Math.SQRT1_2
// Escala para que la escena entera (1200 × 800) quepa en el mismo lienzo.
const S = 0.84
export const ISO = { a: S * K, b: (S * K) / 2, c: -S * K, d: (S * K) / 2, e: 800 * S * K, f: 90 }
export const ISO_MATRIX = `matrix(${ISO.a} ${ISO.b} ${ISO.c} ${ISO.d} ${ISO.e} ${ISO.f})`
// De la escena a la pantalla (coordenadas del viewBox), a la altura z.
export const isoProject = ({ x, y }, z = 0) => ({ x: ISO.a * x + ISO.c * y + ISO.e, y: ISO.b * x + ISO.d * y + ISO.f - S * z })
// Subir z en la pantalla, en coordenadas de la escena.
export const lift = (z) => ({ x: -Math.SQRT2 * z, y: -Math.SQRT2 * z })

// Altura del suelo a la que va cada cosa: la cinta y las mesas, a 40; los cilindros, centrados en
// la altura de la cinta (para empujar lo que lleva); los detectores, montados a esa altura.
const BASE = { cylinder: 16, feeder: 40 }
const MOUNTED = { sensor: 40, limit: 40, distance: 40, diverter: 40, barrier: 16 }
const UNDER = new Set(['conveyor', 'platform', 'ramp', 'scale'])

// Volúmenes de un elemento: [{ r, base, h, tone }] y la altura de su dibujo (top). post: si va
// montado en un poste (un detector junto a la cinta).
export function isoBoxes(scene, state, e) {
  const base = BASE[e.type] ?? 0
  const boxes = reliefBoxes(scene, state, e).map((b) => ({ r: b.r, tone: b.tone, base, h: e.type === 'cylinder' ? 24 : b.depth }))
  const top = boxes.length ? Math.max(...boxes.map((b) => b.base + b.h)) : (MOUNTED[e.type] ?? 0)
  return { boxes, top, post: !boxes.length && Boolean(MOUNTED[e.type]) }
}

// Caras de un volumen, en coordenadas de la escena: arriba, sur (delante a la izquierda) y este.
export function isoPrism({ r, base, h }) {
  const at = (x, y, z) => {
    const o = lift(z)
    return [x + o.x, y + o.y]
  }
  const x0 = r.x
  const y0 = r.y
  const x1 = r.x + r.w
  const y1 = r.y + r.h
  const z0 = base
  const z1 = base + h
  return {
    top: [at(x0, y0, z1), at(x1, y0, z1), at(x1, y1, z1), at(x0, y1, z1)],
    south: [at(x0, y1, z0), at(x1, y1, z0), at(x1, y1, z1), at(x0, y1, z1)],
    east: [at(x1, y0, z0), at(x1, y1, z0), at(x1, y1, z1), at(x1, y0, z1)],
  }
}

// Altura a la que va una pieza: la de lo que tiene debajo (cinta, mesa, rampa, báscula) o el suelo.
export function pieceLift(scene, state, p, elements) {
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  let z = 0
  for (const e of elements) {
    if (!UNDER.has(e.type)) continue
    const { boxes, top } = isoBoxes(scene, state, e)
    if (boxes.some(({ r }) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h)) z = Math.max(z, top)
  }
  return z
}

// Orden de dibujo (del fondo hacia delante): primero lo que va debajo de las piezas (cintas,
// recogidas, mesas), después lo demás por la esquina más cercana (x + y mayor, más cerca).
export const isoKey = (r) => r.x + r.w + r.y + r.h

// Contorno en la pantalla de un volumen (para los rótulos y el encuadre).
export function isoScreenBox(r, z0, z1) {
  const pts = [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x + r.w, r.y + r.h],
    [r.x, r.y + r.h],
  ].flatMap(([x, y]) => [isoProject({ x, y }, z0), isoProject({ x, y }, z1)])
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}
