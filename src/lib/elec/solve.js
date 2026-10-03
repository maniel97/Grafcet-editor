// Simulación del esquema eléctrico (plc.electrical, lib/elec/catalog.js). Sin tensiones ni
// intensidades: conducción sí/no, como en los esquemas de mando.
//  1. Los cables y los contactos cerrados unen bornes en redes; los embarrados (y la fuente del
//     autómata, y el secundario de los transformadores con el primario alimentado) dan a su red un
//     potencial (L+, M, L, N, L1…).
//  2. Una carga (bobina, electroválvula, piloto, timbre) está alimentada si sus dos bornes tienen
//     potenciales que forman circuito (L+/M, fase/neutro, dos fases distintas o los dos bornes del
//     secundario de un mismo transformador).
//  3. Las bobinas (y transformadores y detectores, que necesitan su alimentación) cambian lo que
//     dependa de ellas y se repite hasta que nada cambia.
//  4. Una red con dos potenciales distintos es un cortocircuito: dispara la protección que lo corta
//     (magnetotérmico, guardamotor o fusible; si es una derivación a tierra, el diferencial); sin
//     protección, se avisa y todo queda sin tensión.
// Puro: se prueba sin navegador.
import { POTENTIALS, isSecondary, terminalsOf } from './catalog'

const key = (c, t) => `${c}:${t}`
const PAIRS = [
  ['1', '2'],
  ['3', '4'],
  ['5', '6'],
]
const PROTECTIONS = new Set(['breaker', 'motorprotector', 'fuse', 'rcd'])
const TIMED = new Set(['ton', 'tof', 'flash'])

export function elecInit() {
  return { pressed: {}, latched: {}, opened: {}, tripped: {}, pos: {}, coils: {}, timers: {}, counts: {}, impulse: {}, view: null }
}

const components = (schematic) => schematic?.components ?? []

// Acciones del usuario en la simulación: pulsar / soltar; conmutar (interruptores, setas,
// conmutadores, cruzamientos, protecciones, fusibles…); el conmutador 0-1-2 pasa a la posición
// siguiente; disparar o rearmar (relé térmico, guardamotor por sobrecarga); probar el diferencial.
export function elecAction(schematic, state, id, action) {
  const c = components(schematic).find((x) => x.id === id)
  if (!c) return state
  const s = { ...elecInit(), ...(state ?? {}) }
  if (action === 'press' || action === 'release') return { ...s, pressed: { ...s.pressed, [id]: action === 'press' } }
  if (action === 'toggle') {
    if (['switch', 'emergency', 'changeover', 'crossover'].includes(c.type)) return { ...s, latched: { ...s.latched, [id]: !s.latched[id] } }
    if (c.type === 'selector3') return { ...s, pos: { ...s.pos, [id]: ((s.pos[id] ?? 0) + 1) % 3 } }
    if (PROTECTIONS.has(c.type)) {
      // Disparada (o fundido): se rearma (o se repone) y queda cerrada; si no, se abre o se cierra.
      if (s.tripped[id]) return { ...s, tripped: { ...s.tripped, [id]: false }, opened: { ...s.opened, [id]: false } }
      return { ...s, opened: { ...s.opened, [id]: !s.opened[id] } }
    }
    if (c.type === 'thermal') return { ...s, tripped: { ...s.tripped, [id]: !s.tripped[id] } }
  }
  if (action === 'overload' && (c.type === 'thermal' || c.type === 'motorprotector')) return { ...s, tripped: { ...s.tripped, [id]: true } }
  if (action === 'test' && c.type === 'rcd' && !s.opened[id]) return { ...s, tripped: { ...s.tripped, [id]: true } }
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
  if (isSecondary(a) || isSecondary(b)) return isSecondary(a) && isSecondary(b) && a.split(':')[1] === b.split(':')[1]
  if ((a === 'L+' && b === 'M') || (a === 'M' && b === 'L+')) return true
  if (isPhase(a) && (isPhase(b) || b === 'N')) return true
  return isPhase(b) && a === 'N'
}

// ¿Es un cortocircuito una red con estos potenciales? (Neutro o 0 V unidos con tierra, no.)
function isShort(set) {
  const live = [...set].filter((p) => p !== 'PE')
  if (live.length > 1) return true
  return set.has('PE') && live.some((p) => p !== 'N' && p !== 'M')
}

// Red eléctrica con el estado actual: { find, potentials: Map(raíz -> Set), potentialOf, shorted }.
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
      case 'selector3':
        if (ctx.position(c) === 1) closePair('13', '14')
        if (ctx.position(c) === 2) closePair('23', '24')
        break
      case 'changeover':
        closePair('C', ctx.activated(c) ? '2' : '1')
        break
      case 'crossover':
        if (ctx.activated(c)) {
          closePair('A1', 'B2')
          closePair('A2', 'B1')
        } else {
          closePair('A1', 'B1')
          closePair('A2', 'B2')
        }
        break
      case 'sensor3':
        // Con su alimentación y detectando, la salida conmuta a + (PNP) o a − (NPN).
        if (ctx.activated(c) && ctx.devices[`S:${c.id}`]) closePair('BK', c.output === 'NPN' ? 'BU' : 'BN')
        break
      case 'contact':
        if (ctx.deviceOn(c.ref) !== (c.contact === 'NC')) closePair('a', 'b')
        break
      case 'breaker':
      case 'motorprotector':
      case 'fuse':
        if (ctx.closed(c)) for (const [a, b] of Number(c.poles) === 1 && c.type !== 'motorprotector' ? [['1', '2']] : PAIRS) closePair(a, b)
        break
      case 'rcd':
        if (ctx.closed(c)) for (const [a, b] of PAIRS.slice(0, 2)) closePair(a, b)
        break
      case 'thermal':
        for (const [a, b] of PAIRS) closePair(a, b) // los polos principales siempre conducen
        break
      case 'maincontacts':
        if (ctx.deviceOn(c.ref)) for (const [a, b] of PAIRS) closePair(a, b)
        break
      case 'transformer':
        if (ctx.devices[`T:${c.id}`]) sources.push([key(c.id, 'S1'), `sec:${c.id}:1`], [key(c.id, 'S2'), `sec:${c.id}:2`])
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
    if (!set?.size) return null
    if (set.size === 1) return [...set][0]
    // Neutro (o 0 V) puesto a tierra: la red es el neutro.
    const live = [...set].filter((p) => p !== 'PE')
    return live.length === 1 && !isShort(set) ? live[0] : null
  }
  const shorted = [...potentials.values()].filter(isShort)
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
  const counters = list.filter((c) => c.type === 'counter' && c.tag)
  const closed = (c) => !s.opened[c.id] && !tripped[c.id]
  const activated = (c) => Boolean(s.pressed[c.id] || s.latched[c.id] || (c.signal && physical[c.signal]))
  const timer = (tag) => s.timers[tag] ?? { on: 0, off: Infinity }
  // Salida de una bobina temporizada o especial, con su alimentación actual.
  const coilQ = (c, energized) => {
    const t = timer(c.tag)
    const preset = Number(c.preset) || 0
    if (c.kind === 'ton') return energized && t.on >= preset
    if (c.kind === 'tof') return energized || t.off < preset
    if (c.kind === 'flash') return energized && Math.floor(t.on / Math.max(0.1, preset || 1)) % 2 === 0
    if (c.kind === 'impulse') return Boolean(s.impulse[c.tag])
    return energized
  }
  const settle = (devices) => {
    const deviceOn = (tag) => {
      const d = byTag.get(tag)
      if (!d) return false
      if (d.type === 'coil') return coilQ(d, Boolean(devices[tag]))
      if (d.type === 'counter') return (s.counts[tag] ?? 0) >= (Number(d.preset) || 1)
      if (d.type === 'thermal') return Boolean(tripped[d.id])
      if (PROTECTIONS.has(d.type)) return closed(d)
      if (d.type === 'selector3') return false
      return false
    }
    const ctx = { activated, position: (c) => s.pos[c.id] ?? 0, deviceOn, closed, plcOut, devices }
    return network(schematic, ctx)
  }
  // Lo que depende de sí mismo (bobinas, transformadores, alimentación de los detectores), hasta
  // que nada cambia (con un límite: un circuito que oscila se avisa).
  const solve = () => {
    let devices = { ...s.coils }
    let net
    let oscillating = false
    for (let i = 0; ; i++) {
      net = settle(devices)
      const pot = (c, t) => net.potentialOf(key(c.id, t))
      const next = {}
      for (const c of coilsList) next[c.tag] = powered(pot(c, 'A1'), pot(c, 'A2'))
      for (const c of list) {
        if (c.type === 'transformer') next[`T:${c.id}`] = powered(pot(c, 'P1'), pot(c, 'P2'))
        if (c.type === 'sensor3') next[`S:${c.id}`] = powered(pot(c, 'BN'), pot(c, 'BU'))
      }
      const same = Object.keys({ ...next, ...devices }).every((k) => Boolean(next[k]) === Boolean(devices[k]))
      devices = next
      if (same) break
      if (i > 12) {
        oscillating = true
        break
      }
    }
    return { net, devices, oscillating }
  }

  let r = solve()
  let short = null
  // Cortocircuito: salta la protección cuya apertura lo corta (la que deja menos sin tensión). Si
  // es una derivación a tierra, primero el diferencial; si no, nunca el diferencial.
  for (let attempt = 0; r.net.shorted.length && attempt < 4; attempt++) {
    const toEarth = r.net.shorted.some((set) => set.has('PE'))
    const candidates = list.filter((c) => PROTECTIONS.has(c.type) && closed(c) && (c.type !== 'rcd' || toEarth))
    let best = null
    for (const c of candidates) {
      tripped[c.id] = true
      const test = solve()
      tripped[c.id] = false
      if (test.net.shorted.length) continue
      const score = (c.type === 'rcd' && toEarth ? 1000 : 0) + test.net.potentials.size
      if (!best || score > best.score) best = { c, score }
    }
    if (!best) break
    tripped[best.c.id] = true
    const name = best.c.tag ? `-${best.c.tag}` : 'la protección'
    short =
      best.c.type === 'rcd'
        ? `Derivación a tierra: ha saltado ${name} (diferencial)`
        : best.c.type === 'fuse'
          ? `Cortocircuito: se ha fundido ${name}`
          : `Cortocircuito: ha saltado ${name}`
    r = solve()
  }
  const dead = r.net.shorted.length > 0
  if (dead) short = 'Cortocircuito sin protección: pon un magnetotérmico o un fusible (o corrige el cableado)'

  const pot = (c, t) => (dead ? null : r.net.potentialOf(key(c, t)))
  const devices = dead ? {} : r.devices
  // Temporizadores (tiempo alimentado o desde que se quitó), telerruptores (cambian con cada
  // impulso) y contadores (cuentan cada impulso; R1-R2 los pone a cero).
  const timers = { ...s.timers }
  const impulse = { ...s.impulse }
  for (const c of coilsList) {
    const on = Boolean(devices[c.tag])
    if (TIMED.has(c.kind)) {
      const t = timer(c.tag)
      timers[c.tag] = on ? { on: t.on + dt, off: 0 } : { on: 0, off: t.off + dt }
    }
    if (c.kind === 'impulse' && on && !s.coils[c.tag]) impulse[c.tag] = !impulse[c.tag]
  }
  const counts = { ...s.counts }
  for (const c of counters) {
    const pulse = powered(pot(c.id, 'A1'), pot(c.id, 'A2'))
    if (powered(pot(c.id, 'R1'), pot(c.id, 'R2'))) counts[c.tag] = 0
    else if (pulse && !s.coils[`C:${c.tag}`]) counts[c.tag] = (counts[c.tag] ?? 0) + 1
    devices[`C:${c.tag}`] = pulse
  }

  // Resultado para dibujar y para la planta y el autómata.
  const loads = {}
  const actuators = {}
  const plcIn = {}
  const motors = {}
  const view = { pot: {}, loads, motors, closed: {}, short, oscillating: r.oscillating, plcIn, plcOut, tripped, pos: s.pos, counts, opened: s.opened }
  const after = { ...s, tripped, coils: devices, timers, impulse, counts }
  const qOf = (d) => {
    // Salida de un aparato con su estado ya actualizado (para dibujar sus contactos).
    if (d.type === 'coil') {
      const t = timers[d.tag] ?? { on: 0, off: Infinity }
      const preset = Number(d.preset) || 0
      const on = Boolean(devices[d.tag])
      if (d.kind === 'ton') return on && t.on >= preset
      if (d.kind === 'tof') return on || t.off < preset
      if (d.kind === 'flash') return on && Math.floor(t.on / Math.max(0.1, preset || 1)) % 2 === 0
      if (d.kind === 'impulse') return Boolean(impulse[d.tag])
      return on
    }
    if (d.type === 'counter') return (counts[d.tag] ?? 0) >= (Number(d.preset) || 1)
    if (d.type === 'thermal') return Boolean(tripped[d.id])
    if (PROTECTIONS.has(d.type)) return closed(d)
    return false
  }
  for (const c of list) {
    for (const t of terminalsOf(c)) view.pot[key(c.id, t.id)] = pot(c.id, t.id)
    if (['coil', 'valve', 'lamp', 'buzzer'].includes(c.type)) {
      const [a, b] = terminalsOf(c)
      loads[c.id] = c.type === 'coil' ? Boolean(devices[c.tag]) : powered(pot(c.id, a.id), pot(c.id, b.id))
      if (c.signal) actuators[c.signal] = loads[c.id] ? 1 : 0
    }
    if (c.type === 'transformer') loads[c.id] = Boolean(devices[`T:${c.id}`])
    if (c.type === 'counter') loads[c.id] = Boolean(devices[`C:${c.tag}`])
    if (c.type === 'motor3' || c.type === 'motor6') {
      const m = motorState(c, (t) => pot(c.id, t), (t) => r.net.find(key(c.id, t)))
      motors[c.id] = m
      if (c.signal) actuators[c.signal] = m.running ? 1 : 0
      if (c.reverse) actuators[c.reverse] = m.running && m.dir < 0 ? 1 : 0
    }
    if (c.type === 'plc') {
      for (const t of terminalsOf(c)) if (t.id.startsWith('I')) plcIn[t.id] = powered(pot(c.id, t.id), pot(c.id, '1M'))
    }
    if (['pushbutton', 'switch', 'limit', 'emergency', 'changeover', 'crossover'].includes(c.type)) {
      const nc = c.type === 'emergency' || c.contact === 'NC'
      view.closed[c.id] = activated(c) !== nc
    }
    if (c.type === 'sensor3') view.closed[c.id] = activated(c) && Boolean(devices[`S:${c.id}`])
    if (c.type === 'contact') {
      const d = byTag.get(c.ref)
      view.closed[c.id] = Boolean(d && qOf(d)) !== (c.contact === 'NC')
    }
    if (c.type === 'maincontacts') view.closed[c.id] = Boolean(devices[c.ref])
    if (PROTECTIONS.has(c.type)) view.closed[c.id] = closed(c)
  }
  return { state: { ...after, view }, plcIn, actuators }
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
  const star = rootOf('U2') === rootOf('V2') && rootOf('V2') === rootOf('W2') && !potOf('U2')
  const delta = [
    [u, potOf('U2')],
    [v, potOf('V2')],
    [w, potOf('W2')],
  ].every(([a, b]) => a in ORDER && b in ORDER && a !== b)
  const mode = distinct && star ? 'estrella' : distinct && delta ? 'triángulo' : null
  return { running: Boolean(mode), dir: mode ? dir : 0, mode, warning: count && !mode ? 'Sin conexión válida (ni estrella ni triángulo)' : null }
}
