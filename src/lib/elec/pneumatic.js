// Simulación de la parte neumática del esquema (lib/elec/catalog.js, grupo «Neumática»). Como en el
// eléctrico, sin presiones ni caudales: cada red de tubos está a presión, a escape o cerrada.
//  1. Los tubos, los reguladores de caudal, la unidad de mantenimiento (abierta) y los pasos de cada
//     válvula en su posición actual unen conexiones en redes.
//  2. La fuente da presión a su red; los escapes 3 y 5 de las válvulas y las conexiones de los
//     cilindros sin tubo la dan a la atmósfera. Presión y escape en la misma red: fuga (escape).
//  3. Un cilindro de doble efecto sale con presión en A y escape en B (y entra al revés); con aire
//     atrapado en el otro lado no se mueve. El de simple efecto vuelve con su muelle.
//  4. La velocidad: la carrera en `time` segundos, frenada por los reguladores de caudal que haya
//     en las redes del cilindro (el más cerrado manda).
// Las válvulas se mueven con sus bobinas (sol14 / sol12: el identificador de la electroválvula del
// esquema, -Y1), a mano (pulsador o palanca) y vuelven con su muelle si no tienen bobina 12.
// Puro: se prueba sin navegador.
import { cylinderSignals, terminalsOf } from './catalog'

const key = (c, t) => `${c}:${t}`
const END = 0.02

// Pasos de una válvula en cada posición ('12' reposo, '14' pilotada, '0' centro).
export function valvePaths(c, position) {
  if (c.ways === '3/2') {
    const open = c.normally === 'NO' ? position !== '14' : position === '14'
    return open ? [['1', '2']] : [['2', '3']]
  }
  if (position === '14') return [['1', '4'], ['2', '3']]
  if (position === '0') return c.center === 'exhaust' ? [['2', '3'], ['4', '5']] : c.center === 'pressure' ? [['1', '2'], ['1', '4']] : []
  return [['1', '2'], ['4', '5']]
}
// Conexiones que una válvula deja cerradas en esa posición (para dibujarlas con su tapón).
export function valveBlocked(c, position) {
  const ports = c.ways === '3/2' ? ['1', '2', '3'] : ['1', '2', '3', '4', '5']
  const used = new Set(valvePaths(c, position).flat())
  return ports.filter((p) => !used.has(p))
}

// Posición de una válvula: con las órdenes de sus dos lados (14 y 12) y la que tenía.
export function valvePosition(c, on14, on12, previous) {
  const spring = !c.sol12
  if (c.ways === '5/3') return on14 && !on12 ? '14' : on12 && !on14 ? '12' : '0'
  if (spring) return on14 ? '14' : '12'
  // Biestable: se queda donde está si no hay orden (o si hay dos a la vez).
  if (on14 && !on12) return '14'
  if (on12 && !on14) return '12'
  return previous ?? '12'
}

export const pneuInit = () => ({ pos: {}, valves: {} })

// Avanza la neumática `dt` segundos.
//  solenoids: Set de identificadores de electroválvulas con tensión (Y1…);
//  manual: (componente) => accionado a mano; opened: { id: true } (unidad de mantenimiento cerrada);
//  setting: (componente) => apertura de un regulador (0..1); faults: cables / tubos cortados.
// Devuelve { state, view: { ports, valves, cylinders, leaks }, signals: { a0: 1, a1: 0… } }.
export function pneuStep(schematic, state, { solenoids = new Set(), manual = () => false, opened = {}, setting = (c) => Number(c.setting ?? 0.5), faults = {} } = {}, dt = 0) {
  const s = { ...pneuInit(), ...(state ?? {}) }
  const list = (schematic?.components ?? []).filter((c) => ['airsource', 'frl', 'pvalve', 'pcylinder', 'throttle'].includes(c.type))
  if (!list.length) return { state: s, view: null, signals: {} }
  const ids = new Set(list.map((c) => c.id))
  const parent = new Map()
  const find = (a) => {
    if (!parent.has(a)) parent.set(a, a)
    while (parent.get(a) !== a) a = parent.get(a)
    return a
  }
  const union = (a, b) => parent.set(find(a), find(b))
  // Tubos (los cortados, no; un tubo cortado deja los dos extremos al aire).
  const tubed = new Set()
  for (const w of schematic?.wires ?? []) {
    if (!ids.has(w.from.c) || !ids.has(w.to.c) || faults[w.id] === 'cut') continue
    union(key(w.from.c, w.from.t), key(w.to.c, w.to.t))
    tubed.add(key(w.from.c, w.from.t))
    tubed.add(key(w.to.c, w.to.t))
  }
  const valves = {}
  const pressure = []
  const vents = []
  for (const c of list) {
    switch (c.type) {
      case 'airsource':
        pressure.push(key(c.id, '1'))
        break
      case 'frl':
        if (!opened[c.id]) union(key(c.id, '1'), key(c.id, '2'))
        break
      case 'throttle':
        if (faults[c.id] !== 'open') union(key(c.id, '1'), key(c.id, '2'))
        break
      case 'pvalve': {
        const on14 = Boolean((c.sol14 && solenoids.has(c.sol14)) || manual(c))
        const on12 = Boolean(c.sol12 && solenoids.has(c.sol12))
        const position = faults[c.id] === 'welded' ? (s.valves[c.id] ?? '12') : valvePosition(c, on14, on12, s.valves[c.id])
        valves[c.id] = position
        for (const [a, b] of valvePaths(c, position)) union(key(c.id, a), key(c.id, b))
        // Los escapes de la válvula salen a la atmósfera (con su silenciador).
        for (const p of c.ways === '3/2' ? ['3'] : ['3', '5']) vents.push(key(c.id, p))
        break
      }
      case 'pcylinder':
        for (const t of terminalsOf(c)) if (!tubed.has(key(c.id, t.id))) vents.push(key(c.id, t.id))
        break
      default:
        break
    }
  }
  const pressed = new Set(pressure.map(find))
  const vented = new Set(vents.map(find))
  const leaks = [...pressed].filter((r) => vented.has(r))
  // Estado de una conexión: 'P' (presión), 'R' (escape, también si fuga) o null (cerrada).
  const stateOf = (k) => {
    const r = find(k)
    if (vented.has(r)) return 'R'
    return pressed.has(r) ? 'P' : null
  }
  const ports = {}
  for (const c of list) for (const t of terminalsOf(c)) ports[key(c.id, t.id)] = stateOf(key(c.id, t.id))
  // Reguladores de caudal: el aire pasa libre de 1 a 2 (por su antirretorno) y estrangulado de 2 a
  // 1. Lo que frena a un cilindro: los reguladores pegados a su conexión (por tubos, sin pasar por
  // otro aparato) que el aire cruza estrangulado: el escape que sale por 2 o la presión que entra
  // por 1 (regulación a la salida o a la entrada).
  const local = new Map()
  const lfind = (a) => {
    if (!local.has(a)) local.set(a, a)
    while (local.get(a) !== a) a = local.get(a)
    return a
  }
  for (const w of schematic?.wires ?? []) if (ids.has(w.from.c) && ids.has(w.to.c) && faults[w.id] !== 'cut') local.set(lfind(key(w.from.c, w.from.t)), lfind(key(w.to.c, w.to.t)))
  const throttles = list.filter((c) => c.type === 'throttle' && faults[c.id] !== 'open')
  const brake = (port, outgoing) => {
    let f = 1
    for (const c of throttles) if (lfind(key(c.id, outgoing ? '2' : '1')) === lfind(port)) f = Math.min(f, Math.max(0.05, Math.min(1, setting(c))))
    return f
  }
  const pos = { ...s.pos }
  const cylinders = {}
  const signals = {}
  for (const c of list) {
    if (c.type !== 'pcylinder') continue
    const now = pos[c.id] ?? (Number(c.initial) ? 1 : 0)
    const a = ports[key(c.id, 'A')]
    const b = c.acting === 'single' ? 'R' : ports[key(c.id, 'B')]
    let dir = 0
    let note = null
    if (a === 'P' && b === 'R') dir = 1
    else if (c.acting === 'single' ? a === 'R' : b === 'P' && a === 'R') dir = -1
    else if (a === 'P' && b === 'P') note = 'Presión en los dos lados'
    else if (a === 'P' || b === 'P') note = 'Aire atrapado: el otro lado no tiene escape'
    // Al salir entra aire por A y sale por B; al entrar, al revés (el de simple efecto solo tiene A).
    const [inPort, outPort] = dir > 0 ? ['A', 'B'] : ['B', 'A']
    const factor = !dir ? 1 : Math.min(c.acting === 'single' && inPort === 'B' ? 1 : brake(key(c.id, inPort), false), c.acting === 'single' && outPort === 'B' ? 1 : brake(key(c.id, outPort), true))
    const stuck = faults[c.id] === 'open'
    const next = stuck || !dir ? now : Math.min(1, Math.max(0, now + (dir * factor * dt) / Math.max(0.1, Number(c.time) || 1)))
    pos[c.id] = next
    const moving = next !== now ? dir : 0
    cylinders[c.id] = { pos: next, moving, note: stuck ? 'Avería: cilindro agarrotado' : moving ? null : note, speed: factor }
    const [s0, s1] = cylinderSignals(c.tag)
    if (s0) {
      signals[s0] = next <= END ? 1 : 0
      signals[s1] = next >= 1 - END ? 1 : 0
    }
  }
  return { state: { pos, valves }, view: { ports, valves, cylinders, leaks: leaks.length > 0 }, signals }
}
