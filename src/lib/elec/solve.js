// Simulación del esquema eléctrico (plc.electrical, lib/elec/catalog.js). Sin tensiones ni
// intensidades: conducción sí/no, como en los esquemas de mando.
//  1. Los cables y los contactos cerrados unen bornes en redes; los embarrados (y la fuente del
//     autómata) dan a su red un potencial (L+, M, L, N, L1…).
//  2. Una carga (bobina, electroválvula, piloto) está alimentada si sus dos bornes tienen
//     potenciales que forman circuito (L+/M, fase/neutro o dos fases distintas).
//  3. Las bobinas cambian sus contactos y se repite hasta que nada cambia (relés en cascada).
//  4. Una red con dos potenciales distintos es un cortocircuito: dispara el magnetotérmico (o
//     guardamotor) que lo corta; sin protección, se avisa y todo queda sin tensión.
// Puro: se prueba sin navegador.
import { POTENTIALS, terminalsOf } from './catalog'

const key = (c, t) => `${c}:${t}`
const PAIRS = [
  ['1', '2'],
  ['3', '4'],
  ['5', '6'],
]

export function elecInit() {
  return { pressed: {}, latched: {}, opened: {}, tripped: {}, coils: {}, timers: {}, view: null }
}

const components = (schematic) => schematic?.components ?? []

// Acciones del usuario en la simulación: pulsar / soltar, conmutar (interruptor, seta,
// magnetotérmico), disparar o rearmar (relé térmico, guardamotor por sobrecarga).
export function elecAction(schematic, state, id, action) {
  const c = components(schematic).find((x) => x.id === id)
  if (!c) return state
  const s = state ?? elecInit()
  if (action === 'press' || action === 'release') return { ...s, pressed: { ...s.pressed, [id]: action === 'press' } }
  if (action === 'toggle') {
    if (c.type === 'switch' || c.type === 'emergency') return { ...s, latched: { ...s.latched, [id]: !s.latched[id] } }
    if (c.type === 'breaker' || c.type === 'motorprotector') {
      // Un aparato disparado se rearma (queda cerrado); si no, se abre o se cierra a mano.
      if (s.tripped[id]) return { ...s, tripped: { ...s.tripped, [id]: false }, opened: { ...s.opened, [id]: false } }
      return { ...s, opened: { ...s.opened, [id]: !s.opened[id] } }
    }
    if (c.type === 'thermal') return { ...s, tripped: { ...s.tripped, [id]: !s.tripped[id] } }
  }
  if (action === 'overload' && (c.type === 'thermal' || c.type === 'motorprotector')) return { ...s, tripped: { ...s.tripped, [id]: true } }
  return s
}

function unionFind() {
  const parent = new Map()
  const find = (a) => {
    if (!parent.has(a)) parent.set(a, a)
    let r = a
    while (parent.get(r) !== r) r = parent.get(r)
    while (parent.get(a) !== r) {
      const n = parent.get(a)
      parent.set(a, r)
      a = n
    }
    return r
  }
  const union = (a, b) => parent.set(find(a), find(b))
  return { find, union }
}

const isPhase = (p) => POTENTIALS[p]?.kind === 'phase'
// ¿Forman circuito los potenciales de los dos bornes de una carga?
export function powered(a, b) {
  if (!a || !b || a === b) return false
  if ((a === 'L+' && b === 'M') || (a === 'M' && b === 'L+')) return true
  if (isPhase(a) && (isPhase(b) || b === 'N')) return true
  return isPhase(b) && a === 'N'
}

// Red eléctrica con el estado actual: { find, potentials: Map(raíz -> Set) }.
function network(schematic, ctx) {
  const { find, union } = unionFind()
  const sources = []
  for (const w of schematic?.wires ?? []) union(key(w.from.c, w.from.t), key(w.to.c, w.to.t))
  for (const c of components(schematic)) {
    const ts = terminalsOf(c)
    const closePair = (a, b) => union(key(c.id, a), key(c.id, b))
    switch (c.type) {
      case 'rail':
        for (const t of ts) {
          union(key(c.id, t.id), key(c.id, ts[0].id))
          sources.push([key(c.id, t.id), c.potential])
        }
        break
      case 'pushbutton':
      case 'switch':
      case 'limit':
      case 'emergency': {
        const nc = c.type === 'emergency' || c.contact === 'NC'
        if (ctx.activated(c) !== nc) closePair(ts[0].id, ts[1].id)
        break
      }
      case 'contact':
        if (ctx.deviceOn(c.ref) !== (c.contact === 'NC')) closePair('a', 'b')
        break
      case 'breaker':
      case 'motorprotector':
        if (ctx.closed(c)) for (const [a, b] of Number(c.poles) === 1 && c.type === 'breaker' ? [['1', '2']] : PAIRS) closePair(a, b)
        break
      case 'thermal':
        for (const [a, b] of PAIRS) closePair(a, b) // los polos principales siempre conducen
        break
      case 'maincontacts':
        if (ctx.deviceOn(c.ref)) for (const [a, b] of PAIRS) closePair(a, b)
        break
      case 'plc':
        sources.push([key(c.id, 'L+'), 'L+'], [key(c.id, 'M'), 'M'])
        for (const t of ts) if (t.id.startsWith('Q') && ctx.plcOut[t.id]) closePair('1L', t.id)
        break
      default:
        break
    }
  }
  const potentials = new Map()
  for (const [k, p] of sources) {
    const r = find(k)
    if (!potentials.has(r)) potentials.set(r, new Set())
    potentials.get(r).add(p)
  }
  const potentialOf = (k) => {
    const set = potentials.get(find(k))
    return set?.size === 1 ? [...set][0] : null
  }
  const shorted = [...potentials.values()].filter((s) => s.size > 1)
  return { find, potentials, potentialOf, shorted }
}

// Avanza el esquema `dt` segundos. physical: { señal: activado } (pulsadores y detectores de la
// planta); plcOut: { Q0.0: bool }. Devuelve { state, plcIn: { I0.0: bool }, actuators: { señal: 0/1 } }.
export function elecStep(schematic, state, { physical = {}, plcOut = {} } = {}, dt = 0) {
  const s = { ...elecInit(), ...(state ?? {}) }
  const list = components(schematic)
  const byTag = new Map(list.filter((c) => c.tag).map((c) => [c.tag, c]))
  const tripped = { ...s.tripped }
  const coilsList = list.filter((c) => c.type === 'coil' && c.tag)
  const closed = (c) => !s.opened[c.id] && !tripped[c.id]
  const timerQ = (c, energized) => {
    const t = s.timers[c.tag] ?? { on: 0, off: Infinity }
    if (c.kind === 'ton') return energized && t.on >= (Number(c.preset) || 0)
    if (c.kind === 'tof') return energized || t.off < (Number(c.preset) || 0)
    return energized
  }
  const settle = (coils) => {
    const deviceOn = (tag) => {
      const d = byTag.get(tag)
      if (!d) return false
      if (d.type === 'coil') return timerQ(d, Boolean(coils[tag]))
      if (d.type === 'thermal') return Boolean(tripped[d.id])
      if (d.type === 'motorprotector' || d.type === 'breaker') return closed(d)
      return false
    }
    const ctx = {
      activated: (c) => Boolean(s.pressed[c.id] || s.latched[c.id] || (c.signal && physical[c.signal])),
      deviceOn,
      closed,
      plcOut,
    }
    return { net: network(schematic, ctx), ctx }
  }
  // Bobinas hasta que nada cambia (con un límite: un circuito que oscila se avisa).
  const solve = () => {
    let coils = { ...s.coils }
    let result
    let oscillating = false
    for (let i = 0; ; i++) {
      result = settle(coils)
      const next = {}
      for (const c of coilsList) next[c.tag] = powered(result.net.potentialOf(key(c.id, 'A1')), result.net.potentialOf(key(c.id, 'A2')))
      const same = coilsList.every((c) => next[c.tag] === Boolean(coils[c.tag]))
      coils = next
      if (same) break
      if (i > 12) {
        oscillating = true
        break
      }
    }
    return { ...result, coils, oscillating }
  }

  let r = solve()
  let short = null
  // Cortocircuito: se dispara la protección cuya apertura lo corta (la que deja menos sin tensión).
  for (let attempt = 0; r.net.shorted.length && attempt < 4; attempt++) {
    const candidates = list.filter((c) => (c.type === 'breaker' || c.type === 'motorprotector') && closed(c))
    let best = null
    for (const c of candidates) {
      tripped[c.id] = true
      const test = solve()
      tripped[c.id] = false
      if (test.net.shorted.length) continue
      const live = [...test.net.potentials.values()].length
      if (!best || live > best.live) best = { c, live }
    }
    if (!best) break
    tripped[best.c.id] = true
    short = `Cortocircuito: ha saltado ${best.c.tag ? `-${best.c.tag}` : 'la protección'}`
    r = solve()
  }
  const dead = r.net.shorted.length > 0
  if (dead) short = 'Cortocircuito sin protección: pon un magnetotérmico (o corrige el cableado)'

  const pot = (c, t) => (dead ? null : r.net.potentialOf(key(c, t)))
  const coils = dead ? {} : r.coils
  // Temporizadores: tiempo con la bobina alimentada (TON) o desde que se quitó (TOF).
  const timers = { ...s.timers }
  for (const c of coilsList) {
    if (c.kind !== 'ton' && c.kind !== 'tof') continue
    const t = timers[c.tag] ?? { on: 0, off: Infinity }
    timers[c.tag] = coils[c.tag] ? { on: t.on + dt, off: 0 } : { on: 0, off: t.off + dt }
  }

  // Resultado para dibujar y para la planta y el autómata.
  const loads = {}
  const actuators = {}
  const plcIn = {}
  const motors = {}
  const view = { pot: {}, loads, motors, closed: {}, short, oscillating: r.oscillating, plcIn, plcOut, tripped }
  for (const c of list) {
    for (const t of terminalsOf(c)) view.pot[key(c.id, t.id)] = pot(c.id, t.id)
    if (c.type === 'coil' || c.type === 'valve' || c.type === 'lamp') {
      const [a, b] = terminalsOf(c)
      loads[c.id] = powered(pot(c.id, a.id), pot(c.id, b.id))
      if (c.type === 'coil' && c.kind !== 'ton' && c.kind !== 'tof') loads[c.id] = Boolean(coils[c.tag]) && !dead
      if (c.signal) actuators[c.signal] = loads[c.id] ? 1 : 0
    }
    if (c.type === 'motor3' || c.type === 'motor6') {
      const m = motorState(c, (t) => pot(c.id, t), r.net.find && ((t) => r.net.find(key(c.id, t))))
      motors[c.id] = m
      if (c.signal) actuators[c.signal] = m.running ? 1 : 0
      if (c.reverse) actuators[c.reverse] = m.running && m.dir < 0 ? 1 : 0
    }
    if (c.type === 'plc') {
      for (const t of terminalsOf(c)) if (t.id.startsWith('I')) plcIn[t.id] = powered(pot(c.id, t.id), pot(c.id, '1M'))
    }
    if (['pushbutton', 'switch', 'limit', 'emergency'].includes(c.type)) {
      const nc = c.type === 'emergency' || c.contact === 'NC'
      view.closed[c.id] = Boolean(s.pressed[c.id] || s.latched[c.id] || (c.signal && physical[c.signal])) !== nc
    }
    if (c.type === 'contact') {
      const d = byTag.get(c.ref)
      // (Los de un temporizador se corrigen abajo, con su salida.)
      const on = !d ? false : d.type === 'coil' ? coils[c.ref] : d.type === 'thermal' ? tripped[d.id] : closed(d)
      view.closed[c.id] = Boolean(on) !== (c.contact === 'NC')
    }
    if (c.type === 'maincontacts') view.closed[c.id] = Boolean(coils[c.ref])
    if (c.type === 'breaker' || c.type === 'motorprotector') view.closed[c.id] = closed(c)
  }
  // Contactos temporizados: su estado es el de la salida del temporizador.
  for (const c of list) {
    if (c.type !== 'contact') continue
    const d = byTag.get(c.ref)
    if (d?.type === 'coil' && (d.kind === 'ton' || d.kind === 'tof')) {
      const t = timers[c.ref]
      const q = d.kind === 'ton' ? coils[c.ref] && t.on >= (Number(d.preset) || 0) : coils[c.ref] || t.off < (Number(d.preset) || 0)
      view.closed[c.id] = Boolean(q) !== (c.contact === 'NC')
    }
  }
  return { state: { ...s, tripped, coils, timers, view }, plcIn, actuators }
}

// Motor trifásico: gira con las tres fases distintas; el sentido, por el orden de las fases.
// Estrella-triángulo: en estrella si U2, V2 y W2 están unidos; en triángulo si cada devanado
// queda entre dos fases.
const ORDER = { L1: 0, L2: 1, L3: 2 }
function motorState(c, potOf, rootOf) {
  const sixWire = c.type === 'motor6'
  const [u, v, w] = (sixWire ? ['U1', 'V1', 'W1'] : ['U', 'V', 'W']).map(potOf)
  const phases = [u, v, w]
  const distinct = phases.every((p) => p in ORDER) && new Set(phases).size === 3
  const dir = distinct ? ((ORDER[v] - ORDER[u] + 3) % 3 === 1 ? 1 : -1) : 0
  const count = phases.filter((p) => p in ORDER).length
  if (!sixWire) {
    return { running: distinct, dir, mode: null, warning: count && !distinct ? 'Le falta una fase' : null }
  }
  const [u2, v2, w2] = ['U2', 'V2', 'W2']
  const star = rootOf('U2') === rootOf('V2') && rootOf('V2') === rootOf('W2') && !potOf('U2')
  const delta = [
    [u, potOf(u2)],
    [v, potOf(v2)],
    [w, potOf(w2)],
  ].every(([a, b]) => a in ORDER && b in ORDER && a !== b)
  const mode = distinct && star ? 'estrella' : distinct && delta ? 'triángulo' : null
  return { running: Boolean(mode), dir: mode ? dir : 0, mode, warning: count && !mode ? 'Sin conexión válida (ni estrella ni triángulo)' : null }
}
