// Simulación de la parte hidráulica del esquema (lib/elec/catalog.js, grupo «Hidráulica»). Como la
// neumática (lib/elec/pneumatic.js), sin caudales: cada red de tubos está a presión, a depósito o
// cerrada. Lo que la distingue, y lo que se ve al simular:
//  - El aceite no se comprime: un cilindro con sus dos conexiones cerradas se queda quieto donde
//    esté, aunque tenga carga (con el aire, el émbolo «se va»). Por eso la posición central de un
//    distribuidor 4/3 sirve para parar a media carrera.
//  - La bomba da caudal, no presión: si el aceite no tiene por dónde ir (cilindro al final de su
//    carrera, centro cerrado), la presión sube hasta que abre la limitadora y el aceite vuelve al
//    depósito por ella. Sin limitadora, aviso. El manómetro marca la presión de trabajo al mover y
//    la de la limitadora al llegar al tope; con el centro en tándem (P→T), la bomba descarga a 0.
//  - Una conexión sin tubo derrama aceite (aviso).
// La bomba gira si no tiene motor asignado (grupo en marcha) o si su motor del esquema (-M1) gira.
// Puro: se prueba sin navegador.
import { cylinderSignals, terminalsOf } from './catalog'
import { t as tr } from '../i18n'

const key = (c, t) => `${c}:${t}`
const END = 0.02
// Presión de trabajo al mover (fracción de la de la limitadora) y presión sin limitadora.
const WORKING = 0.3
const UNLIMITED = 250
export const HYDRO_TYPES = ['hpump', 'hrelief', 'hgauge', 'htank', 'hvalve', 'hcylinder', 'hthrottle']

// Pasos de un distribuidor en cada posición ('14' pilotada, '12' la otra, '0' centro de un 4/3).
export function hvalvePaths(c, position) {
  if (position === '14') return [['P', 'A'], ['B', 'T']]
  if (position === '12') return [['P', 'B'], ['A', 'T']]
  return { tandem: [['P', 'T']], open: [['P', 'A'], ['A', 'B'], ['B', 'T']], float: [['A', 'T'], ['B', 'T']] }[c.center] ?? []
}
export function hvalveBlocked(c, position) {
  const used = new Set(hvalvePaths(c, position).flat())
  return ['A', 'B', 'P', 'T'].filter((p) => !used.has(p))
}
// 4/3: centrado por muelles sin orden (o con las dos). 4/2: como una 5/2 (muelle o biestable).
export function hvalvePosition(c, on14, on12, previous) {
  if (c.ways !== '4/2') return on14 && !on12 ? '14' : on12 && !on14 ? '12' : '0'
  if (!c.sol12) return on14 ? '14' : '12'
  if (on14 && !on12) return '14'
  if (on12 && !on14) return '12'
  return previous ?? '12'
}

export const hydroInit = () => ({ pos: {}, valves: {} })

// Avanza la hidráulica `dt` segundos.
//  solenoids: Set de electroválvulas con tensión (Y1…); motors: (tag) => el motor gira;
//  manual: (componente) => accionado a mano; setting: (componente) => apertura de un regulador;
//  faults: tubos cortados, válvulas pegadas, cilindros agarrotados.
// Devuelve { state, view: { ports, valves, cylinders, gauges, relief, spill, overpressure, pumps }, signals }.
export function hydroStep(schematic, state, { solenoids = new Set(), motors = () => false, manual = () => false, setting = (c) => Number(c.setting ?? 0.5), faults = {} } = {}, dt = 0) {
  const s = { ...hydroInit(), ...(state ?? {}) }
  const list = (schematic?.components ?? []).filter((c) => HYDRO_TYPES.includes(c.type))
  if (!list.length) return { state: s, view: null, signals: {} }
  const ids = new Set(list.map((c) => c.id))
  const parent = new Map()
  const find = (a) => {
    if (!parent.has(a)) parent.set(a, a)
    while (parent.get(a) !== a) a = parent.get(a)
    return a
  }
  const union = (a, b) => parent.set(find(a), find(b))
  const tubed = new Set()
  const tubes = (schematic?.wires ?? []).filter((w) => ids.has(w.from.c) && ids.has(w.to.c) && faults[w.id] !== 'cut')
  for (const w of tubes) {
    union(key(w.from.c, w.from.t), key(w.to.c, w.to.t))
    tubed.add(key(w.from.c, w.from.t))
    tubed.add(key(w.to.c, w.to.t))
  }
  const valves = {}
  const sources = []
  const tank = []
  const open = []
  const pumps = {}
  for (const c of list) {
    switch (c.type) {
      case 'hpump': {
        const running = !c.motor || motors(c.motor)
        pumps[c.id] = running
        if (running) sources.push(key(c.id, 'P'))
        tank.push(key(c.id, 'T'))
        break
      }
      case 'htank':
        tank.push(key(c.id, 'T'))
        break
      case 'hrelief':
        tank.push(key(c.id, 'T'))
        break
      case 'hthrottle':
        if (faults[c.id] !== 'open') union(key(c.id, '1'), key(c.id, '2'))
        break
      case 'hvalve': {
        const on14 = Boolean((c.sol14 && solenoids.has(c.sol14)) || manual(c))
        const on12 = Boolean(c.sol12 && solenoids.has(c.sol12))
        const position = faults[c.id] === 'welded' ? (s.valves[c.id] ?? (c.ways === '4/2' ? '12' : '0')) : hvalvePosition(c, on14, on12, s.valves[c.id])
        valves[c.id] = position
        for (const [a, b] of hvalvePaths(c, position)) union(key(c.id, a), key(c.id, b))
        for (const t of ['A', 'B', 'T']) if (!tubed.has(key(c.id, t))) open.push(key(c.id, t))
        break
      }
      case 'hcylinder':
        for (const t of terminalsOf(c)) if (!tubed.has(key(c.id, t.id))) open.push(key(c.id, t.id))
        break
      default:
        break
    }
  }
  const pressed = new Set(sources.map(find))
  const toTank = new Set(tank.map(find))
  const spilled = new Set(open.map(find))
  // Una red con la bomba y el depósito (o una conexión abierta) no tiene presión: el aceite vuelve
  // (o se derrama) sin esfuerzo.
  const stateOf = (k) => {
    const r = find(k)
    if (toTank.has(r) || spilled.has(r)) return 'T'
    return pressed.has(r) ? 'P' : null
  }
  const ports = {}
  for (const c of list) for (const t of terminalsOf(c)) ports[key(c.id, t.id)] = stateOf(key(c.id, t.id))
  const spill = [...pressed].some((r) => spilled.has(r))
  // Reguladores de caudal (como en la neumática): libre de 1 a 2, estrangulado de 2 a 1.
  const local = new Map()
  const lfind = (a) => {
    if (!local.has(a)) local.set(a, a)
    while (local.get(a) !== a) a = local.get(a)
    return a
  }
  for (const w of tubes) local.set(lfind(key(w.from.c, w.from.t)), lfind(key(w.to.c, w.to.t)))
  const throttles = list.filter((c) => c.type === 'hthrottle' && faults[c.id] !== 'open')
  const brake = (port, outgoing) => {
    let f = 1
    for (const c of throttles) if (lfind(key(c.id, outgoing ? '2' : '1')) === lfind(port)) f = Math.min(f, Math.max(0.05, Math.min(1, setting(c))))
    return f
  }
  const pos = { ...s.pos }
  const cylinders = {}
  const signals = {}
  // Redes a presión que mueven algún cilindro (el aceite tiene por dónde ir).
  const flowing = new Set()
  for (const c of list) {
    if (c.type !== 'hcylinder') continue
    const now = pos[c.id] ?? (Number(c.initial) ? 1 : 0)
    const a = ports[key(c.id, 'A')]
    const b = ports[key(c.id, 'B')]
    let dir = 0
    let note = null
    if (a === 'P' && b === 'T') dir = 1
    else if (b === 'P' && a === 'T') dir = -1
    else if (a === 'P' && b === 'P') note = tr('Presión en los dos lados')
    else if (a === 'P' || b === 'P') note = tr('Aceite encerrado en el otro lado: no se mueve')
    else if (!a && !b && now > END && now < 1 - END) note = tr('Retenido: el aceite encerrado lo sujeta')
    const factor = dir ? Math.min(brake(key(c.id, dir > 0 ? 'A' : 'B'), false), brake(key(c.id, dir > 0 ? 'B' : 'A'), true)) : 1
    const stuck = faults[c.id] === 'open'
    const next = stuck || !dir ? now : Math.min(1, Math.max(0, now + (dir * factor * dt) / Math.max(0.1, Number(c.time) || 2)))
    pos[c.id] = next
    // Sigue entrando aceite mientras no llega al tope (aunque dt sea 0, al dibujar).
    const moving = !stuck && dir !== 0 && (dir > 0 ? now < 1 : now > 0) ? dir : 0
    if (moving) flowing.add(find(key(c.id, dir > 0 ? 'A' : 'B')))
    cylinders[c.id] = { pos: next, moving, note: stuck ? tr('Avería: cilindro agarrotado') : moving ? null : note, speed: factor }
    const [s0, s1] = cylinderSignals(c.tag)
    if (s0) {
      signals[s0] = next <= END ? 1 : 0
      signals[s1] = next >= 1 - END ? 1 : 0
    }
  }
  // Presión de cada red: 0 a depósito; de trabajo si mueve un cilindro; la de la limitadora (que
  // entonces abre) si el aceite no tiene salida.
  const reliefs = list.filter((c) => c.type === 'hrelief')
  const reliefOf = (r) => reliefs.find((c) => find(key(c.id, 'P')) === r)
  const relief = {}
  let overpressure = false
  const bar = (k) => {
    const r = find(k)
    if (ports[k] !== 'P') return 0
    const valve = reliefOf(r) ?? reliefs[0]
    const max = valve ? Number(valve.setting) || 100 : UNLIMITED
    if (flowing.has(r)) return Math.round(max * WORKING)
    if (valve) relief[valve.id] = true
    else overpressure = true
    return max
  }
  const gauges = {}
  for (const c of list) if (c.type === 'hgauge') gauges[c.id] = bar(key(c.id, '1'))
  for (const c of list) if (c.type === 'hpump' && pumps[c.id]) bar(key(c.id, 'P'))
  return { state: { pos, valves }, view: { ports, valves, cylinders, gauges, relief, spill, overpressure, pumps }, signals }
}
