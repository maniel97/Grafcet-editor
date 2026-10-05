// Simulación del esquema eléctrico (plc.electrical, lib/elec/catalog.js). Sin tensiones ni
// intensidades: conducción sí/no, como en los esquemas de mando (y, aparte, el valor de las
// señales analógicas: mA o V, que van por su red).
//  1. Los cables y los contactos cerrados unen bornes en redes; los embarrados, la fuente del
//     autómata, las fuentes de 24 V y el secundario de los transformadores (con su entrada
//     alimentada) dan a su red un potencial (L+, M, L, N, L1…).
//  2. Una carga (bobina, electroválvula, piloto, timbre…) está alimentada si sus dos bornes tienen
//     potenciales que forman circuito (L+/M, fase/neutro, dos fases distintas o los dos bornes del
//     secundario de un mismo transformador).
//  3. Lo que depende de sí mismo (bobinas, transformadores, fuentes, alimentación de detectores,
//     relés de seguridad, variadores…) se repite hasta que nada cambia.
//  4. Una red con dos potenciales distintos es un cortocircuito: dispara la protección que lo corta
//     (magnetotérmico, guardamotor o fusible; si es una derivación a tierra, el diferencial); sin
//     protección, se avisa y todo queda sin tensión.
// Puro: se prueba sin navegador.
import { POTENTIALS, isMotor, isSecondary, terminalsOf } from './catalog'
import { pneuStep } from './pneumatic'
import { hydroStep } from './hydraulic'
import { t as tr } from '../i18n'

const key = (c, t) => `${c}:${t}`
const PAIRS = [
  ['1', '2'],
  ['3', '4'],
  ['5', '6'],
]
const PROTECTIONS = new Set(['breaker', 'motorprotector', 'fuse', 'rcd'])
const MANUAL = new Set([...PROTECTIONS, 'mainswitch'])
const TIMED = new Set(['ton', 'tof', 'flash'])
const ORDER = { L1: 0, L2: 1, L3: 2 }
// Contactos que pueden quedar soldados (cerrados siempre), por tipo.
const WELDABLE = {
  pushbutton: (ts) => [[ts[0].id, ts[1].id]],
  switch: (ts) => [[ts[0].id, ts[1].id]],
  limit: (ts) => [[ts[0].id, ts[1].id]],
  litbutton: () => [['13', '14']],
  contact: () => [['a', 'b']],
  emergency: (ts) => (ts.length > 2 ? [['11', '12'], ['21', '22']] : [['11', '12']]),
  doorswitch: () => [['11', '12'], ['21', '22']],
  maincontacts: () => [['1', '2'], ['3', '4'], ['5', '6']],
}
// Lo que puede averiarse, para una avería al azar: contactos (quemados o soldados), cargas
// (cortadas o fundidas) y cables (cortados).
const CONTACTS = new Set(Object.keys(WELDABLE))
const LOADS = new Set(['coil', 'valve', 'lamp', 'buzzer', 'brake', 'motor3', 'motor6', 'motor1', 'dahlander', 'motor2w'])

// Una avería al azar (rand: () => 0..1): { id, fault }.
export function randomFault(schematic, rand = Math.random) {
  const options = []
  for (const c of components(schematic)) {
    if (CONTACTS.has(c.type)) options.push({ id: c.id, fault: 'open' }, { id: c.id, fault: 'welded' })
    if (LOADS.has(c.type)) options.push({ id: c.id, fault: 'open' })
  }
  for (const w of schematic?.wires ?? []) options.push({ id: w.id, fault: 'cut' })
  return options.length ? options[Math.floor(rand() * options.length) % options.length] : null
}

// Lo que marca un polímetro entre dos puntos (potenciales del esquema; null = sin tensión).
// { value, unit: 'V~' | 'V DC' | null, text }.
export function voltageBetween(a, b) {
  const phase = (p) => POTENTIALS[p]?.kind === 'phase'
  if (!a || !b) return { value: 0, unit: null, text: tr('0 V (sin tensión o circuito abierto)') }
  if (a === b) return { value: 0, unit: null, text: '0 V (mismo potencial)' }
  const pair = new Set([a, b])
  if (pair.has('L+') && pair.has('M')) return { value: 24, unit: 'V DC', text: '24 V DC' }
  if (isSecondary(a) && isSecondary(b) && a.split(':')[1] === b.split(':')[1]) return { value: 24, unit: 'V~', text: '24 V~' }
  if ((phase(a) && b === 'N') || (phase(b) && a === 'N') || (phase(a) && b === 'PE') || (phase(b) && a === 'PE')) return { value: 230, unit: 'V~', text: '230 V~' }
  if (phase(a) && phase(b) && ['L1', 'L2', 'L3'].includes(a) && ['L1', 'L2', 'L3'].includes(b)) return { value: 400, unit: 'V~', text: '400 V~' }
  if ((a === 'N' && b === 'PE') || (a === 'PE' && b === 'N') || (a === 'M' && b === 'PE') || (a === 'PE' && b === 'M')) return { value: 0, unit: null, text: '0 V' }
  return { value: null, unit: null, text: tr('Sin referencia común (circuitos distintos)') }
}

export function elecInit() {
  // faults: averías provocadas { [componente o cable]: 'open' | 'welded' | 'cut' }; hidden: si se
  // han puesto al azar sin decir dónde (para practicar el diagnóstico con el polímetro).
  return { pressed: {}, latched: {}, opened: {}, tripped: {}, pos: {}, coils: {}, timers: {}, counts: {}, impulse: {}, safety: {}, safetyReset: {}, knob: {}, faults: {}, hidden: false, pneu: {}, hydro: {}, pneuSignals: {}, spinning: {}, view: null }
}

const components = (schematic) => schematic?.components ?? []

// Acciones del usuario en la simulación: pulsar / soltar; conmutar (interruptores, setas,
// conmutadores, puertas, cortinas, protecciones, fusibles, interruptor general…); el conmutador
// 0-1-2 pasa a la posición siguiente; el potenciómetro, +25 %; disparar o rearmar (relé
// térmico, guardamotor por sobrecarga); probar el diferencial.
export function elecAction(schematic, state, id, action) {
  const s = { ...elecInit(), ...(state ?? {}) }
  // Averías (de un aparato o de un cable): 'fault:open' (quemado, cortado, fundido), 'fault:welded'
  // (contacto soldado), 'fault:cut' (cable cortado) o 'fault:' (reparar).
  if (action.startsWith?.('fault:')) {
    const faults = { ...s.faults }
    const value = action.slice('fault:'.length)
    if (value) faults[id] = value
    else delete faults[id]
    return { ...s, faults, hidden: Object.keys(faults).length ? s.hidden : false }
  }
  // Avería al azar, sin decir dónde; mostrarla; repararlo todo.
  if (action === 'random-fault') {
    const pick = randomFault(schematic)
    return pick ? { ...s, faults: { [pick.id]: pick.fault }, hidden: true } : s
  }
  if (action === 'reveal') return { ...s, hidden: false }
  if (action === 'repair-all') return { ...s, faults: {}, hidden: false }
  const c = components(schematic).find((x) => x.id === id)
  if (!c) return state
  if (action === 'press' || action === 'release') return { ...s, pressed: { ...s.pressed, [id]: action === 'press' } }
  if (action === 'toggle') {
    if (['switch', 'emergency', 'changeover', 'crossover', 'doorswitch', 'lightcurtain'].includes(c.type)) return { ...s, latched: { ...s.latched, [id]: !s.latched[id] } }
    if (c.type === 'selector3') return { ...s, pos: { ...s.pos, [id]: ((s.pos[id] ?? 0) + 1) % 3 } }
    if (c.type === 'potentiometer') {
      const now = s.knob[id] ?? Number(c.initial ?? 0.5)
      return { ...s, knob: { ...s.knob, [id]: now >= 0.999 ? 0 : Math.min(1, Math.round((now + 0.25) * 4) / 4) } }
    }
    if (MANUAL.has(c.type)) {
      // Disparada (o fundido): se rearma (o se repone) y queda cerrada; si no, se abre o se cierra.
      if (s.tripped[id]) return { ...s, tripped: { ...s.tripped, [id]: false }, opened: { ...s.opened, [id]: false } }
      return { ...s, opened: { ...s.opened, [id]: !s.opened[id] } }
    }
    if (c.type === 'thermal') return { ...s, tripped: { ...s.tripped, [id]: !s.tripped[id] } }
    // Neumática: válvula de palanca (se queda), unidad de mantenimiento (abrir o cortar el aire) y
    // regulador de caudal (+25 %; de 100 % vuelve a 25 %).
    if ((c.type === 'pvalve' || c.type === 'hvalve') && c.manual === 'lever') return { ...s, latched: { ...s.latched, [id]: !s.latched[id] } }
    if (c.type === 'frl') return { ...s, opened: { ...s.opened, [id]: !s.opened[id] } }
    if (c.type === 'throttle' || c.type === 'hthrottle') {
      const now = s.knob[id] ?? Number(c.setting ?? 0.5)
      return { ...s, knob: { ...s.knob, [id]: now >= 0.999 ? 0.25 : Math.min(1, Math.round((now + 0.25) * 4) / 4) } }
    }
  }
  if (action.startsWith?.('set:') && c.type === 'potentiometer') return { ...s, knob: { ...s.knob, [id]: Math.min(1, Math.max(0, Number(action.slice(4)) || 0)) } }
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

// Fases de tres bornes en orden (para motores, variadores y relés de control de fases):
// { distinct, dir: 1 (L1-L2-L3) | -1 (invertidas) | 0 }.
export function phaseOrder(a, b, c) {
  const distinct = [a, b, c].every((p) => p in ORDER) && new Set([a, b, c]).size === 3
  return { distinct, dir: distinct ? ((ORDER[b] - ORDER[a] + 3) % 3 === 1 ? 1 : -1) : 0 }
}

// Red eléctrica con el estado actual: { find, potentials: Map(raíz -> Set), potentialOf, shorted }.
function network(schematic, ctx) {
  const { find, union } = unionFind()
  const sources = []
  const faults = ctx.faults ?? {}
  for (const w of schematic?.wires ?? []) if (faults[w.id] !== 'cut') union(key(w.from.c, w.from.t), key(w.to.c, w.to.t))
  for (const c of components(schematic)) {
    const ts = terminalsOf(c)
    // Un contacto quemado (o una borna floja) no cierra; uno soldado no abre (abajo).
    const closePair = (a, b) => faults[c.id] !== 'open' && union(key(c.id, a), key(c.id, b))
    if (faults[c.id] === 'welded') for (const [a, b] of WELDABLE[c.type]?.(ts) ?? []) union(key(c.id, a), key(c.id, b))
    const source = (t, p) => sources.push([key(c.id, t), p])
    switch (c.type) {
      case 'rail':
        for (const t of ts) {
          union(key(c.id, t.id), key(c.id, ts[0].id))
          source(t.id, c.potential)
        }
        break
      case 'pushbutton':
      case 'switch':
      case 'limit':
      case 'litbutton': {
        const nc = c.contact === 'NC'
        if (ctx.activated(c) !== nc) closePair(ts[0].id, ts[1].id)
        break
      }
      case 'emergency':
      case 'doorswitch':
        if (!ctx.activated(c)) {
          closePair('11', '12')
          if (c.type === 'doorswitch' || Number(c.channels) === 2) closePair('21', '22')
        }
        break
      case 'lightcurtain':
        // Libre y alimentada: sus salidas OSSD dan +24 V.
        if (!ctx.activated(c) && ctx.devices[`LC:${c.id}`]) {
          closePair('+24', 'OSSD1')
          closePair('+24', 'OSSD2')
        }
        break
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
      case 'mainswitch':
        if (ctx.closed(c)) for (const [a, b] of Number(c.poles) === 1 && (c.type === 'breaker' || c.type === 'fuse') ? [['1', '2']] : PAIRS) closePair(a, b)
        break
      case 'rcd':
        if (ctx.closed(c)) for (const [a, b] of PAIRS.slice(0, 2)) closePair(a, b)
        break
      case 'thermal':
        for (const [a, b] of PAIRS) closePair(a, b) // los polos principales siempre conducen
        break
      case 'terminal':
        closePair('1', '2')
        break
      case 'maincontacts':
        if (ctx.deviceOn(c.ref)) for (const [a, b] of PAIRS) closePair(a, b)
        break
      case 'transformer':
        if (ctx.devices[`T:${c.id}`]) {
          source('S1', `sec:${c.id}:1`)
          source('S2', `sec:${c.id}:2`)
        }
        break
      case 'psu':
        if (ctx.devices[`G:${c.id}`]) {
          source('L+', 'L+')
          source('M', 'M')
        }
        break
      case 'safetyrelay':
        if (ctx.devices[`KS:${c.tag}`]) {
          closePair('13', '14')
          closePair('23', '24')
        } else closePair('41', '42')
        break
      case 'vfd': {
        if (ctx.devices[`VS:${c.id}`]) {
          source('+24', 'L+')
          source('GND', 'M')
        }
        const dir = ctx.devices[`V:${c.id}`]
        if (dir) {
          // Salida al motor: L1-L2-L3 (o con dos fases cambiadas, marcha atrás).
          source('U', 'L1')
          source('V', dir > 0 ? 'L2' : 'L3')
          source('W', dir > 0 ? 'L3' : 'L2')
          closePair('R1', 'R2')
        }
        break
      }
      case 'softstarter':
        if (ctx.devices[`SS:${c.id}`]) for (const [a, b] of [['L1', 'T1'], ['L2', 'T2'], ['L3', 'T3']]) closePair(a, b)
        break
      case 'plc':
        source('L+', 'L+')
        source('M', 'M')
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

// Avanza el esquema `dt` segundos.
//  physical: { señal: activado } (pulsadores y detectores de la planta);
//  analog: { señal: 0..1 } (valor de las analógicas de la planta, en tanto por uno de su rango);
//  plcOut: { Q0.0: bool }; plcOutAnalog: { AQW0: { value, unit } } (salidas analógicas).
// Devuelve { state, plcIn: { I0.0: bool }, plcInAnalog: { AIW0: { value, unit } | null },
//            actuators: { señal: 0..1 } }.
export function elecStep(schematic, state, { physical = {}, analog = {}, plcOut = {}, plcOutAnalog = {} } = {}, dt = 0) {
  const s = { ...elecInit(), ...(state ?? {}) }
  const list = components(schematic)
  const byTag = new Map(list.filter((c) => c.tag).map((c) => [c.tag, c]))
  const tripped = { ...s.tripped }
  const coilsList = list.filter((c) => c.type === 'coil' && c.tag)
  const counters = list.filter((c) => c.type === 'counter' && c.tag)
  const closed = (c) => !s.opened[c.id] && !tripped[c.id]
  // Los detectores de los cilindros neumáticos (a0, a1…) también accionan contactos.
  const sensed = { ...physical, ...s.pneuSignals }
  const activated = (c) => Boolean(s.pressed[c.id] || s.latched[c.id] || (c.signal && sensed[c.signal]))
  const timer = (tag) => s.timers[tag] ?? { on: 0, off: Infinity }
  // Salida de una bobina temporizada o especial, con su alimentación actual.
  const coilQ = (c, energized, timers = s.timers, impulse = s.impulse) => {
    const t = timers[c.tag] ?? { on: 0, off: Infinity }
    const preset = Number(c.preset) || 0
    if (c.kind === 'ton') return energized && t.on >= preset
    if (c.kind === 'tof') return energized || t.off < preset
    if (c.kind === 'flash') return energized && Math.floor(t.on / Math.max(0.1, preset || 1)) % 2 === 0
    if (c.kind === 'impulse') return Boolean(impulse[c.tag])
    return energized
  }
  // ¿Está «encendido» el aparato con este identificador? (lo que miran sus contactos auxiliares)
  const deviceOnWith = (devices, timers = s.timers, impulse = s.impulse, counts = s.counts) => (tag) => {
    const d = byTag.get(tag)
    if (!d) return false
    if (d.type === 'coil') return coilQ(d, Boolean(devices[tag]), timers, impulse)
    if (d.type === 'counter') return (counts[tag] ?? 0) >= (Number(d.preset) || 1)
    if (d.type === 'thermal') return Boolean(tripped[d.id])
    if (MANUAL.has(d.type)) return closed(d)
    if (d.type === 'safetyrelay') return Boolean(devices[`KS:${tag}`])
    if (d.type === 'phasemonitor') return Boolean(devices[`PM:${tag}`])
    if (d.type === 'vfd') return Boolean(devices[`V:${d.id}`])
    if (d.type === 'softstarter') return Boolean(devices[`SS:${d.id}`]) && (timers[tag]?.on ?? 0) >= (Number(d.ramp) || 0)
    return false
  }
  const settle = (devices) => {
    const ctx = { activated, position: (c) => s.pos[c.id] ?? 0, deviceOn: deviceOnWith(devices), closed, plcOut, devices, faults: s.faults }
    return network(schematic, ctx)
  }
  // Lo que depende de sí mismo, hasta que nada cambia (con un límite: si oscila, se avisa).
  const solve = () => {
    let devices = { ...s.coils }
    let net
    let oscillating = false
    for (let i = 0; ; i++) {
      net = settle(devices)
      const pot = (c, t) => net.potentialOf(key(c.id, t))
      const same = (c, a, b) => net.find(key(c.id, a)) === net.find(key(c.id, b))
      const next = {}
      // Una bobina cortada no se excita aunque tenga tensión.
      for (const c of coilsList) next[c.tag] = powered(pot(c, 'A1'), pot(c, 'A2')) && s.faults[c.id] !== 'open'
      // Enclavamiento mecánico: de dos contactores enclavados, solo entra uno (el que ya estaba).
      for (const c of coilsList) {
        const other = c.interlock && byTag.get(c.interlock)
        if (other && next[c.tag] && next[other.tag]) next[devices[c.tag] ? other.tag : c.tag] = false
      }
      for (const c of list) {
        if (c.type === 'transformer') next[`T:${c.id}`] = powered(pot(c, 'P1'), pot(c, 'P2'))
        if (c.type === 'psu') next[`G:${c.id}`] = powered(pot(c, 'L'), pot(c, 'N'))
        if (c.type === 'sensor3') next[`S:${c.id}`] = powered(pot(c, 'BN'), pot(c, 'BU'))
        if (c.type === 'lightcurtain') next[`LC:${c.id}`] = powered(pot(c, '+24'), pot(c, '0V'))
        if (c.type === 'softstarter') next[`SS:${c.id}`] = powered(pot(c, 'A1'), pot(c, 'A2')) && phaseOrder(pot(c, 'L1'), pot(c, 'L2'), pot(c, 'L3')).distinct
        if (c.type === 'phasemonitor') next[`PM:${c.tag}`] = phaseOrder(pot(c, 'L1'), pot(c, 'L2'), pot(c, 'L3')).dir === 1
        if (c.type === 'vfd') {
          const supplied = phaseOrder(pot(c, 'L1'), pot(c, 'L2'), pot(c, 'L3')).distinct
          next[`VS:${c.id}`] = supplied
          const fwd = pot(c, 'DI1') === 'L+'
          const rev = pot(c, 'DI2') === 'L+'
          next[`V:${c.id}`] = supplied && fwd !== rev ? (fwd ? 1 : -1) : 0
        }
        if (c.type === 'safetyrelay') {
          const supplied = powered(pot(c, 'A1'), pot(c, 'A2'))
          const ch1 = same(c, 'S11', 'S12') || pot(c, 'S12') === 'L+'
          const ch2 = same(c, 'S21', 'S22') || pot(c, 'S22') === 'L+'
          const reset = same(c, 'S33', 'S34') || pot(c, 'S34') === 'L+'
          // Se activa con los dos canales cerrados y el flanco del rearme; se mantiene mientras
          // sigan cerrados (y con alimentación).
          next[`KS:${c.tag}`] = supplied && ch1 && ch2 && Boolean(s.safety[c.tag] || (reset && !s.safetyReset[c.tag]))
        }
      }
      const done = Object.keys({ ...next, ...devices }).every((k) => k.startsWith('C:') || Boolean(next[k]) === Boolean(devices[k]))
      devices = { ...next, ...Object.fromEntries(Object.entries(devices).filter(([k]) => k.startsWith('C:'))) }
      if (done) break
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
    const name = best.c.tag ? `-${best.c.tag}` : tr('la protección')
    short =
      best.c.type === 'rcd'
        ? tr('Derivación a tierra: ha saltado {aparato} (diferencial)', { aparato: name })
        : best.c.type === 'fuse'
          ? tr('Cortocircuito: se ha fundido {aparato}', { aparato: name })
          : tr('Cortocircuito: ha saltado {aparato}', { aparato: name })
    r = solve()
  }
  const dead = r.net.shorted.length > 0
  if (dead) short = tr('Cortocircuito sin protección: pon un magnetotérmico o un fusible (o corrige el cableado)')

  const pot = (c, t) => (dead ? null : r.net.potentialOf(key(c, t)))
  const root = (c, t) => r.net.find(key(c, t))
  const devices = dead ? {} : r.devices
  // Temporizadores (y rampas), telerruptores (cambian con cada impulso) y contadores (cuentan
  // cada impulso; R1-R2 los pone a cero).
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
  for (const c of list) {
    if (c.type !== 'softstarter' || !c.tag) continue
    const t = timer(c.tag)
    timers[c.tag] = devices[`SS:${c.id}`] ? { on: t.on + dt, off: 0 } : { on: 0, off: t.off + dt }
  }
  const counts = { ...s.counts }
  for (const c of counters) {
    const pulse = powered(pot(c.id, 'A1'), pot(c.id, 'A2'))
    if (powered(pot(c.id, 'R1'), pot(c.id, 'R2'))) counts[c.tag] = 0
    else if (pulse && !s.coils[`C:${c.tag}`]) counts[c.tag] = (counts[c.tag] ?? 0) + 1
    devices[`C:${c.tag}`] = pulse
  }
  // Relés de seguridad: se recuerda si están activados y el rearme (para su flanco).
  const safety = {}
  const safetyReset = {}
  const safetyView = {}
  for (const c of list) {
    if (c.type !== 'safetyrelay' || !c.tag) continue
    const same = (a, b) => !dead && root(c.id, a) === root(c.id, b)
    const ch1 = same('S11', 'S12') || pot(c.id, 'S12') === 'L+'
    const ch2 = same('S21', 'S22') || pot(c.id, 'S22') === 'L+'
    safety[c.tag] = Boolean(devices[`KS:${c.tag}`])
    safetyReset[c.tag] = same('S33', 'S34') || pot(c.id, 'S34') === 'L+'
    safetyView[c.id] = { ch1, ch2, supplied: powered(pot(c.id, 'A1'), pot(c.id, 'A2')), discrepancy: ch1 !== ch2 }
  }

  // Señales analógicas: cada fuente (transmisor alimentado, potenciómetro, salida analógica del
  // autómata) pone su valor en su red; las entradas lo leen.
  const analogNets = new Map()
  const putAnalog = (c, t, value, unit) => !dead && analogNets.set(root(c, t), { value: Math.round(value * 1000) / 1000, unit })
  for (const c of list) {
    if (c.type === 'transmitter') {
      const pct = Math.min(1, Math.max(0, Number(analog[c.signal] ?? 0)))
      if (c.output === '0-10V') {
        if (powered(pot(c.id, '+'), pot(c.id, '0V'))) putAnalog(c.id, 'OUT', 10 * pct, 'V')
      } else if (pot(c.id, '+') === 'L+') putAnalog(c.id, '−', 4 + 16 * pct, 'mA')
    }
    if (c.type === 'potentiometer') putAnalog(c.id, 'W', 10 * (s.knob[c.id] ?? Number(c.initial ?? 0.5)), 'V')
    if (c.type === 'plc') for (const t of terminalsOf(c)) if (t.id.startsWith('AQW') && plcOutAnalog[t.id]) putAnalog(c.id, t.id, plcOutAnalog[t.id].value, plcOutAnalog[t.id].unit)
  }
  const analogAt = (c, t) => (dead ? null : (analogNets.get(root(c, t)) ?? null))

  // Velocidad de los motores: la del variador (o la rampa del arrancador suave) que los alimenta.
  const speedByRoot = new Map()
  const vfdView = {}
  const softView = {}
  for (const c of list) {
    if (c.type === 'vfd') {
      const dir = devices[`V:${c.id}`] ?? 0
      const ai = analogAt(c.id, 'AI1')
      const hz = !dir ? 0 : ai?.unit === 'V' ? Math.round(Math.min(10, Math.max(0, ai.value)) * 5 * 10) / 10 : pot(c.id, 'DI3') === 'L+' ? Number(c.speed2) || 25 : 50
      vfdView[c.id] = { hz, dir }
      if (dir && !dead) speedByRoot.set(root(c.id, 'U'), hz / 50)
    }
    if (c.type === 'softstarter') {
      const on = Boolean(devices[`SS:${c.id}`])
      const ramp = Math.max(0.1, Number(c.ramp) || 3)
      const pct = on ? Math.min(1, (timers[c.tag]?.on ?? 0) / ramp) : 0
      softView[c.id] = { pct, on }
      if (on && !dead) speedByRoot.set(root(c.id, 'T1'), Math.max(0.05, pct))
    }
  }

  // Resultado para dibujar y para la planta y el autómata.
  const loads = {}
  const actuators = {}
  const plcIn = {}
  const plcInAnalog = {}
  const motors = {}
  const beacons = {}
  const view = {
    pot: {},
    loads,
    motors,
    closed: {},
    short,
    oscillating: r.oscillating,
    plcIn,
    plcInAnalog,
    plcOut,
    tripped,
    pos: s.pos,
    counts,
    opened: s.opened,
    safety: safetyView,
    vfd: vfdView,
    soft: softView,
    beacons,
    knob: s.knob,
    analog: {},
    // Las averías se ven (salvo si se pusieron ocultas para practicar).
    faults: s.hidden ? {} : s.faults,
    hiddenFaults: s.hidden && Object.keys(s.faults).length > 0,
  }
  const spinning = {} // sentido de giro de cada motor (el monofásico de arranque lo necesita)
  const after = { ...s, tripped, coils: devices, timers, impulse, counts, safety, safetyReset, spinning }
  const deviceOn = deviceOnWith(devices, timers, impulse, counts)
  for (const c of list) {
    for (const t of terminalsOf(c)) {
      view.pot[key(c.id, t.id)] = pot(c.id, t.id)
      const a = analogAt(c.id, t.id)
      if (a) view.analog[key(c.id, t.id)] = a
    }
    if (['coil', 'valve', 'lamp', 'buzzer', 'brake'].includes(c.type)) {
      const [a, b] = terminalsOf(c)
      loads[c.id] = c.type === 'coil' ? Boolean(devices[c.tag]) : powered(pot(c.id, a.id), pot(c.id, b.id)) && s.faults[c.id] !== 'open'
      if (c.signal) actuators[c.signal] = loads[c.id] ? 1 : 0
    }
    if (c.type === 'litbutton') {
      loads[c.id] = powered(pot(c.id, 'X1'), pot(c.id, 'X2'))
      if (c.light) actuators[c.light] = loads[c.id] ? 1 : 0
    }
    if (c.type === 'beacon') {
      const lit = (t) => powered(pot(c.id, t), pot(c.id, 'X0'))
      beacons[c.id] = { red: lit('X1'), amber: lit('X2'), green: lit('X3'), buzzer: lit('X4') }
      loads[c.id] = Object.values(beacons[c.id]).some(Boolean)
      for (const k of ['red', 'amber', 'green', 'buzzer']) if (c[k]) actuators[c[k]] = beacons[c.id][k] ? 1 : 0
    }
    if (['transformer', 'psu'].includes(c.type)) loads[c.id] = Boolean(devices[`${c.type === 'psu' ? 'G' : 'T'}:${c.id}`])
    if (c.type === 'lightcurtain') loads[c.id] = Boolean(devices[`LC:${c.id}`]) && !activated(c)
    if (c.type === 'safetyrelay') loads[c.id] = Boolean(devices[`KS:${c.tag}`])
    if (c.type === 'phasemonitor') loads[c.id] = Boolean(devices[`PM:${c.tag}`])
    if (c.type === 'vfd') loads[c.id] = Boolean(devices[`V:${c.id}`])
    if (c.type === 'softstarter') loads[c.id] = Boolean(devices[`SS:${c.id}`])
    if (c.type === 'counter') loads[c.id] = Boolean(devices[`C:${c.tag}`])
    if (isMotor(c.type)) {
      const m = s.faults[c.id] === 'open' ? { running: false, dir: 0, mode: null, warning: null } : motorState(c, (t) => pot(c.id, t), (t) => root(c.id, t), s.spinning[c.id] ?? 0)
      const first = terminalsOf(c)[0].id
      const speed = (speedByRoot.get(root(c.id, first)) ?? 1) * (m.speed ?? 1)
      motors[c.id] = { ...m, speed: m.running ? speed : 0 }
      spinning[c.id] = m.running ? m.dir : 0
      if (c.signal) actuators[c.signal] = m.running ? speed : 0
      if (c.reverse) actuators[c.reverse] = m.running && m.dir < 0 ? 1 : 0
    }
    if (c.type === 'plc') {
      for (const t of terminalsOf(c)) {
        if (t.id.startsWith('I')) plcIn[t.id] = powered(pot(c.id, t.id), pot(c.id, '1M'))
        if (t.id.startsWith('AIW')) plcInAnalog[t.id] = analogAt(c.id, t.id)
      }
    }
    if (['pushbutton', 'switch', 'limit', 'emergency', 'changeover', 'crossover', 'litbutton', 'doorswitch', 'lightcurtain'].includes(c.type)) {
      const nc = ['emergency', 'doorswitch', 'lightcurtain'].includes(c.type) || c.contact === 'NC'
      view.closed[c.id] = activated(c) !== nc
    }
    if (c.type === 'sensor3') view.closed[c.id] = activated(c) && Boolean(devices[`S:${c.id}`])
    if (c.type === 'contact') view.closed[c.id] = deviceOn(c.ref) !== (c.contact === 'NC')
    if (c.type === 'maincontacts') view.closed[c.id] = Boolean(devices[c.ref])
    if (MANUAL.has(c.type)) view.closed[c.id] = closed(c)
  }
  // Neumática: las electroválvulas con tensión mueven sus válvulas.
  const solenoids = new Set(list.filter((c) => c.type === 'valve' && c.tag && loads[c.id]).map((c) => c.tag))
  const air = pneuStep(schematic, s.pneu, { solenoids, manual: (c) => s.pressed[c.id] || s.latched[c.id], opened: s.opened, setting: (c) => s.knob[c.id] ?? Number(c.setting ?? 0.5), faults: s.faults }, dt)
  view.pneu = air.view
  // Hidráulica: las mismas electroválvulas, y la bomba con su motor del esquema.
  const running = new Set(list.filter((c) => isMotor(c.type) && c.tag && motors[c.id]?.running).map((c) => c.tag))
  const oil = hydroStep(schematic, s.hydro, { solenoids, motors: (tag) => running.has(tag), manual: (c) => s.pressed[c.id] || s.latched[c.id], setting: (c) => s.knob[c.id] ?? Number(c.setting ?? 0.5), faults: s.faults }, dt)
  view.hydro = oil.view
  view.pneuSignals = { ...air.signals, ...oil.signals }
  // Un cilindro neumático puede mover un cilindro de la planta: su orden de salir (presión en A y
  // escape en B) y la de entrar.
  for (const c of list) {
    const fluid = c.type === 'pcylinder' ? air.view : c.type === 'hcylinder' ? oil.view : null
    if (!fluid) continue
    const a = fluid.ports[key(c.id, 'A')]
    const b = c.acting === 'single' ? 'R' : fluid.ports[key(c.id, 'B')]
    if (c.signal) actuators[c.signal] = a === 'P' && b !== 'P' ? 1 : 0
    if (c.reverse && c.acting !== 'single') actuators[c.reverse] = b === 'P' && a !== 'P' ? 1 : 0
  }
  return { state: { ...after, pneu: air.state, hydro: oil.state, pneuSignals: view.pneuSignals, view }, plcIn, plcInAnalog, actuators }
}

// Motor trifásico: gira con las tres fases distintas; el sentido, por el orden de las fases.
// Estrella-triángulo: en estrella si U2, V2 y W2 están unidos; en triángulo si cada devanado
// queda entre dos fases.
function motorState(c, potOf, rootOf, spinning = 0) {
  if (c.type === 'motor1') return singlePhase(c, potOf, spinning)
  if (c.type === 'dahlander' || c.type === 'motor2w') return twoSpeed(c, potOf, rootOf)
  const sixWire = c.type === 'motor6'
  const [u, v, w] = (sixWire ? ['U1', 'V1', 'W1'] : ['U', 'V', 'W']).map(potOf)
  const { distinct, dir } = phaseOrder(u, v, w)
  const count = [u, v, w].filter((p) => p in ORDER).length
  if (!sixWire) {
    return { running: distinct, dir, mode: null, warning: count && !distinct ? tr('Le falta una fase') : null }
  }
  const star = rootOf('U2') === rootOf('V2') && rootOf('V2') === rootOf('W2') && !potOf('U2')
  const delta = [
    [u, potOf('U2')],
    [v, potOf('V2')],
    [w, potOf('W2')],
  ].every(([a, b]) => a in ORDER && b in ORDER && a !== b)
  const mode = distinct && star ? 'estrella' : distinct && delta ? tr('triángulo') : null
  return { running: Boolean(mode), dir: mode ? dir : 0, mode, warning: count && !mode ? tr('Sin conexión válida (ni estrella ni triángulo)') : null }
}

// Monofásico: gira con tensión en el principal (U1-U2) y en el auxiliar (Z1-Z2, con su
// condensador); el sentido, por cómo se une el auxiliar con el principal (Z1 con U1: a derechas).
// Con condensador de arranque, una vez en marcha sigue girando sin el auxiliar.
function singlePhase(c, potOf, spinning) {
  const [u1, u2, z1, z2] = ['U1', 'U2', 'Z1', 'Z2'].map(potOf)
  const main = powered(u1, u2)
  const aux = powered(z1, z2)
  if (main && aux) {
    const dir = z1 === u1 || z2 === u2 ? 1 : z1 === u2 || z2 === u1 ? -1 : 1
    return { running: true, dir, mode: null, warning: null }
  }
  if (main && c.capacitor === 'start' && spinning) return { running: true, dir: spinning, mode: tr('sin el auxiliar (ya arrancado)'), warning: null }
  return { running: false, dir: 0, mode: null, warning: main ? tr('Zumba sin arrancar: falta el devanado auxiliar') : aux ? tr('Sin tensión en el devanado principal') : null }
}

// Dos velocidades: Dahlander (lenta en triángulo por 1U-1V-1W; rápida en doble estrella por
// 2U-2V-2W con 1U-1V-1W puenteados) o dos devanados separados (lenta por 1, rápida por 2).
function twoSpeed(c, potOf, rootOf) {
  const low = ['1U', '1V', '1W']
  const high = ['2U', '2V', '2W']
  const order = (ids) => phaseOrder(...ids.map(potOf))
  const fed = (ids) => ids.some((t) => potOf(t))
  const slow = order(low)
  const fast = order(high)
  const off = { running: false, dir: 0, speed: 0 }
  if (fed(low) && fed(high)) {
    // En el Dahlander, la rápida necesita los 1 puenteados (sin tensión propia): con tensión en los
    // dos lados es un error; en el de dos devanados, también.
    return { ...off, mode: null, warning: tr('Las dos velocidades a la vez: conexión no válida') }
  }
  if (slow.distinct) return { running: true, dir: slow.dir, speed: 0.5, mode: c.type === 'dahlander' ? tr('velocidad lenta (triángulo)') : 'velocidad lenta', warning: null }
  if (fast.distinct) {
    if (c.type === 'dahlander' && !(rootOf('1U') === rootOf('1V') && rootOf('1V') === rootOf('1W')))
      return { ...off, mode: null, warning: tr('Rápida sin puentear 1U-1V-1W (doble estrella)') }
    return { running: true, dir: fast.dir, speed: 1, mode: c.type === 'dahlander' ? tr('velocidad rápida (doble estrella)') : tr('velocidad rápida'), warning: null }
  }
  return { ...off, mode: null, warning: fed(low) || fed(high) ? tr('Le falta una fase') : null }
}
