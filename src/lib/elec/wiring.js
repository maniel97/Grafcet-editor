// Cableado del esquema como en un plano: números de cable (uno por red equipotencial, como en
// los planos de máquina) y puntos de unión (donde salen dos o más cables de un mismo borne, o se
// toma un embarrado).
import { isPneumatic, terminalsOf } from './catalog'

const key = (c, t) => `${c}:${t}`

// Redes por los cables (y lo que une un borne con otro sin maniobra: embarrados y bornas).
function nets(schematic) {
  const parent = new Map()
  const find = (a) => {
    if (!parent.has(a)) parent.set(a, a)
    while (parent.get(a) !== a) a = parent.get(a)
    return a
  }
  const union = (a, b) => parent.set(find(a), find(b))
  for (const w of schematic?.wires ?? []) union(key(w.from.c, w.from.t), key(w.to.c, w.to.t))
  for (const c of schematic?.components ?? []) {
    const ts = terminalsOf(c)
    if (c.type === 'rail') for (const t of ts) union(key(c.id, t.id), key(c.id, ts[0].id))
    if (c.type === 'terminal') union(key(c.id, '1'), key(c.id, '2'))
  }
  return find
}

// { [idDelCable]: número } — los cables de un embarrado llevan su potencial (L1, N, L+…); el
// resto, 1, 2, 3… en orden de lectura (de arriba abajo y de izquierda a derecha).
export function wireNumbers(schematic) {
  const find = nets(schematic)
  const comps = new Map((schematic?.components ?? []).map((c) => [c.id, c]))
  const railOf = new Map()
  for (const c of schematic?.components ?? []) if (c.type === 'rail') railOf.set(find(key(c.id, 't0')), c.potential)
  const where = (end) => {
    const c = comps.get(end.c)
    const t = c && terminalsOf(c).find((x) => x.id === end.t)
    return c && t ? { x: c.x + t.x, y: c.y + t.y } : { x: 0, y: 0 }
  }
  const groups = new Map()
  for (const w of schematic?.wires ?? []) {
    // Los tubos de aire no llevan número de cable.
    if (isPneumatic(comps.get(w.from.c)?.type)) continue
    const r = find(key(w.from.c, w.from.t))
    const a = where(w.from)
    const b = where(w.to)
    const g = groups.get(r) ?? { wires: [], x: Infinity, y: Infinity }
    g.wires.push(w.id)
    g.y = Math.min(g.y, a.y, b.y)
    g.x = Math.min(g.x, a.x, b.x)
    groups.set(r, g)
  }
  const out = {}
  let n = 0
  const ordered = [...groups.entries()].sort(([, a], [, b]) => a.y - b.y || a.x - b.x)
  for (const [r, g] of ordered) {
    const label = railOf.get(r) ?? String(++n)
    for (const id of g.wires) out[id] = label
  }
  return out
}

// Bornes con punto de unión: { 'componente:borne': true }.
export function junctions(schematic) {
  const degree = new Map()
  for (const w of schematic?.wires ?? []) for (const e of [w.from, w.to]) degree.set(key(e.c, e.t), (degree.get(key(e.c, e.t)) ?? 0) + 1)
  const rails = new Set((schematic?.components ?? []).filter((c) => c.type === 'rail').map((c) => c.id))
  const out = {}
  for (const [k, d] of degree) if (d >= 2 || (d >= 1 && rails.has(k.split(':')[0]))) out[k] = true
  return out
}

// Siguiente borna de una regleta: el número libre siguiente de esa regleta.
export function nextTerminalNumber(components, strip) {
  const used = components.filter((c) => c.type === 'terminal' && c.tag === strip).map((c) => Number(c.n) || 0)
  return used.length ? Math.max(...used) + 1 : 1
}

// Colores y secciones de los cables (IEC 60445 / 60204-1).
export const WIRE_COLORS = {
  auto: { label: 'Automático (por su potencial al simular)', stroke: null },
  brown: { label: 'Marrón (fase)', stroke: '#92400e' },
  black: { label: 'Negro (fase / potencia)', stroke: '#111827' },
  grey: { label: 'Gris (fase)', stroke: '#6b7280' },
  blue: { label: 'Azul claro (neutro)', stroke: '#38bdf8' },
  darkblue: { label: 'Azul oscuro (mando en continua)', stroke: '#1d4ed8' },
  red: { label: 'Rojo (mando en alterna)', stroke: '#dc2626' },
  orange: { label: 'Naranja (tensiones externas)', stroke: '#ea580c' },
  greenyellow: { label: 'Verde-amarillo (tierra PE)', stroke: '#65a30d' },
  white: { label: 'Blanco', stroke: '#94a3b8' },
}
export const WIRE_SECTIONS = ['0.5', '0.75', '1', '1.5', '2.5', '4', '6']
export const sectionWidth = (section) => ({ 0.5: 1.1, 0.75: 1.3, 1: 1.5, 1.5: 1.8, 2.5: 2.3, 4: 2.8, 6: 3.2 })[Number(section)] ?? 1.6
