// Escena de la planta virtual (al estilo de PC_SIMU): elementos colocados libremente que
// interactúan entre sí. Puro: se prueba sin navegador.
//
// plc.scene = { elements: [{ id, type, x, y, rot, ...propiedades }] }
//   x, y: punto de anclaje (px de la escena); rot: 0 | 90 | 180 | 270 (sentido horario).
// Física sencilla, sin motor físico: rectángulos que se mueven y se empujan; los detectores
// miran si algo entra en su zona.
//
// Estado: { pos: { [cilindro]: 0..1 }, pressed: { [mando]: bool }, level: { [depósito]: 0..1 },
//           angle: { [motor]: grados }, faults: { [elemento]: avería }, pieces: [{ id, x, y, w, h,
//           color }], counts: { [recogida]: n }, nextPiece, fed: { [alimentador]: valor anterior } }

export const SCENE_TYPES = {
  button: { label: 'Pulsador', group: 'Mandos', defaults: { variable: '', contact: 'NO', color: 'green', text: '' } },
  switch: { label: 'Interruptor', group: 'Mandos', defaults: { variable: '', contact: 'NO', text: '' } },
  emergency: { label: 'Seta de emergencia', group: 'Mandos', defaults: { variable: '', text: 'Emergencia' } },
  lamp: { label: 'Piloto', group: 'Señalización', defaults: { variable: '', color: 'green', text: '' } },
  cylinder: {
    label: 'Cilindro',
    group: 'Actuadores',
    defaults: { extend: '', retract: '', retracted: '', extended: '', stroke: 100, time: 1, text: '' },
  },
  conveyor: { label: 'Cinta', group: 'Actuadores', defaults: { motor: '', length: 240, time: 4, text: '' } },
  limit: { label: 'Final de carrera', group: 'Detectores', defaults: { variable: '', contact: 'NO' } },
  sensor: { label: 'Detector de presencia', group: 'Detectores', defaults: { variable: '', contact: 'NO', range: 60 } },
  feeder: { label: 'Alimentador de piezas', group: 'Proceso', defaults: { trigger: '', auto: true, sizes: 'small', color: 'amber' } },
  sink: { label: 'Recogida', group: 'Proceso', defaults: { text: '' } },
  tank: {
    label: 'Depósito',
    group: 'Proceso',
    defaults: { fill: '', drain: '', low: '', high: '', level: '', fillTime: 10, drainTime: 10, initial: 0, text: '' },
  },
  motor: { label: 'Motor', group: 'Actuadores', defaults: { variable: '', reverse: '', text: '' } },
  display: { label: 'Visualizador', group: 'Señalización', defaults: { variable: '', text: '' } },
}

// Variables de cada tipo: [clave, etiqueta, 'in' (la escena la escribe) | 'out' (la lee)].
export const SCENE_VARS = {
  button: [['variable', 'Entrada', 'in']],
  switch: [['variable', 'Entrada', 'in']],
  emergency: [['variable', 'Entrada', 'in']],
  lamp: [['variable', 'Salida', 'out']],
  cylinder: [
    ['extend', 'Sale (A+)', 'out'],
    ['retract', 'Entra (A−; vacío = muelle)', 'out'],
    ['retracted', 'Detector dentro (a0)', 'in'],
    ['extended', 'Detector fuera (a1)', 'in'],
  ],
  conveyor: [['motor', 'Motor', 'out']],
  limit: [['variable', 'Entrada', 'in']],
  sensor: [['variable', 'Entrada', 'in']],
  feeder: [['trigger', 'Orden de soltar pieza (opcional)', 'out']],
  sink: [],
  tank: [
    ['fill', 'Válvula de llenado', 'out'],
    ['drain', 'Válvula de vaciado', 'out'],
    ['low', 'Sensor nivel bajo', 'in'],
    ['high', 'Sensor nivel alto', 'in'],
    ['level', 'Nivel (analógica)', 'analog'],
  ],
  motor: [
    ['variable', 'Marcha', 'out'],
    ['reverse', 'Giro inverso (opcional)', 'out'],
  ],
  display: [['variable', 'Valor', 'any']],
}

// Tamaño del depósito (anclaje: esquina superior izquierda) y de sus sensores de nivel.
export const TANK = { w: 90, h: 130, low: 0.1, high: 0.9 }

const BODY = 80 // largo del cuerpo de un cilindro
export const PIECE_SIZES = { small: [28, 28], large: [44, 44] }

// --- Geometría -----------------------------------------------------------------------------

// Gira un vector local (sentido horario, eje y hacia abajo).
export function rotate(dx, dy, rot = 0) {
  switch (((rot % 360) + 360) % 360) {
    case 90:
      return [-dy, dx]
    case 180:
      return [-dx, -dy]
    case 270:
      return [dy, -dx]
    default:
      return [dx, dy]
  }
}
// Rectángulo local (x, y, w, h) de un elemento -> rectángulo de la escena { x, y, w, h }.
export function worldRect(e, x, y, w, h) {
  const corners = [rotate(x, y, e.rot), rotate(x + w, y + h, e.rot)]
  const xs = corners.map((c) => c[0] + e.x)
  const ys = corners.map((c) => c[1] + e.y)
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.abs(xs[1] - xs[0]), h: Math.abs(ys[1] - ys[0]) }
}
export const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const center = (r) => [r.x + r.w / 2, r.y + r.h / 2]
const inside = ([px, py], r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h

// Placa del vástago (lo que empuja y pisa los finales de carrera), en coordenadas locales.
const plateLocal = (e, pos) => [BODY + pos * (Number(e.stroke) || 100), -14, 8, 28]
export const cylinderPlate = (e, pos) => worldRect(e, ...plateLocal(e, pos))
export const limitZone = (e) => worldRect(e, -8, -22, 16, 14) // el rodillo, encima del anclaje
export const sensorZone = (e) => worldRect(e, 10, -6, Number(e.range) || 60, 12) // el haz
export const conveyorRect = (e) => worldRect(e, 0, -15, Number(e.length) || 240, 30)
export const sinkRect = (e) => worldRect(e, -30, -30, 60, 60)

// --- Simulación ----------------------------------------------------------------------------

const on = (values, name) => Boolean(name) && Number(values[name] ?? 0) !== 0
const clamp = (x) => Math.min(1, Math.max(0, x))
const elementsOf = (scene) => scene?.elements ?? []

export function sceneInit(scene) {
  const pos = {}
  const pressed = {}
  const level = {}
  for (const e of elementsOf(scene)) {
    if (e.type === 'cylinder') pos[e.id] = 0
    // La seta de emergencia está sin pulsar (contacto cerrado) al empezar.
    if (e.type === 'button' || e.type === 'switch' || e.type === 'emergency') pressed[e.id] = false
    if (e.type === 'tank') level[e.id] = clamp(Number(e.initial) || 0)
  }
  return { pos, pressed, level, angle: {}, faults: {}, pieces: [], counts: {}, nextPiece: 1, fed: {} }
}

// Pieza nueva en un alimentador (si su sitio está libre).
function feed(state, e) {
  const sizes = e.sizes === 'mixed' ? ['small', 'large'] : [e.sizes in PIECE_SIZES ? e.sizes : 'small']
  const [w, h] = PIECE_SIZES[sizes[(state.nextPiece - 1) % sizes.length]]
  const piece = { id: state.nextPiece, x: e.x - w / 2, y: e.y - h / 2, w, h, color: e.color ?? 'amber' }
  if (state.pieces.some((p) => overlaps(p, piece))) return state
  return { ...state, pieces: [...state.pieces, piece], nextPiece: state.nextPiece + 1 }
}

// Avanza la escena `dt` segundos con las salidas actuales del grafcet.
export function sceneStep(scene, state, values, dt) {
  if (!(dt > 0)) return state
  const elements = elementsOf(scene)
  const faults = state.faults ?? {}
  const stuck = (e) => faults[e.id] === 'stuck'
  let next = {
    ...state,
    pos: { ...state.pos },
    level: { ...state.level },
    angle: { ...state.angle },
    pieces: state.pieces.map((p) => ({ ...p })),
    counts: { ...state.counts },
    fed: { ...state.fed },
  }

  // Alimentadores: automáticos (siempre una pieza esperando) o con su orden (flanco de subida).
  for (const e of elements) {
    if (e.type !== 'feeder') continue
    const order = on(values, e.trigger)
    if (e.trigger ? order && !next.fed[e.id] : e.auto) next = feed(next, e)
    next.fed[e.id] = order
  }

  // Cintas: las piezas cuyo centro está encima avanzan (sin montarse sobre la de delante).
  for (const e of elements) {
    if (e.type !== 'conveyor' || !on(values, e.motor) || stuck(e)) continue
    const rect = conveyorRect(e)
    const speed = (Number(e.length) || 240) / Math.max(0.1, Number(e.time) || 4)
    const [dx, dy] = rotate(speed * dt, 0, e.rot)
    for (const p of next.pieces) {
      if (!inside(center(p), rect)) continue
      const moved = { ...p, x: p.x + dx, y: p.y + dy }
      const blocked = next.pieces.some((o) => o !== p && overlaps(moved, o) && !overlaps(p, o))
      if (!blocked) Object.assign(p, { x: moved.x, y: moved.y })
    }
  }

  // Cilindros: el vástago sale o entra; la placa empuja las piezas que encuentra al salir.
  for (const e of elements) {
    if (e.type !== 'cylinder' || stuck(e)) continue
    const out = on(values, e.extend)
    const back = e.retract ? on(values, e.retract) : !out
    const dir = out && !back ? 1 : back && !out ? -1 : 0
    if (!dir) continue
    const pos = clamp(next.pos[e.id] + (dir * dt) / Math.max(0.05, Number(e.time) || 1))
    next.pos[e.id] = pos
    if (dir < 0) continue
    const plate = cylinderPlate(e, pos)
    const [ux, uy] = rotate(1, 0, e.rot)
    for (const p of next.pieces) {
      if (!overlaps(plate, p)) continue
      // Delante de la placa, en el sentido del vástago.
      if (ux > 0) p.x = plate.x + plate.w
      if (ux < 0) p.x = plate.x - p.w
      if (uy > 0) p.y = plate.y + plate.h
      if (uy < 0) p.y = plate.y - p.h
    }
  }

  // Depósitos: se llenan y vacían con sus válvulas.
  for (const e of elements) {
    if (e.type !== 'tank' || stuck(e)) continue
    const filling = on(values, e.fill) ? dt / Math.max(0.1, Number(e.fillTime) || 10) : 0
    const draining = on(values, e.drain) ? dt / Math.max(0.1, Number(e.drainTime) || 10) : 0
    next.level[e.id] = clamp((next.level[e.id] ?? 0) + filling - draining)
  }

  // Motores: solo giran (para verlo); una vuelta por segundo.
  for (const e of elements) {
    if (e.type !== 'motor' || stuck(e)) continue
    const dir = on(values, e.variable) ? (on(values, e.reverse) ? -1 : 1) : 0
    if (dir) next.angle[e.id] = ((next.angle[e.id] ?? 0) + dir * 360 * dt) % 360
  }

  // Recogidas: retiran (y cuentan) las piezas que caen dentro.
  for (const e of elements) {
    if (e.type !== 'sink') continue
    const rect = sinkRect(e)
    const kept = next.pieces.filter((p) => !inside(center(p), rect))
    next.counts[e.id] = (next.counts[e.id] ?? 0) + next.pieces.length - kept.length
    next.pieces = kept
  }
  return next
}

// ¿Qué tiene delante un detector? (placas de los vástagos y piezas)
function touching(scene, state, zone) {
  if (state.pieces.some((p) => overlaps(zone, p))) return true
  return elementsOf(scene).some((c) => c.type === 'cylinder' && overlaps(zone, cylinderPlate(c, state.pos[c.id] ?? 0)))
}

// Estado de cada elemento para dibujarlo y para las entradas: { [id]: true | false }.
// Un detector averiado («roto») no detecta nada.
export function sceneSignals(scene, state) {
  const signals = {}
  const broken = (e) => state.faults?.[e.id] === 'broken'
  for (const e of elementsOf(scene)) {
    if (e.type === 'limit') signals[e.id] = !broken(e) && touching(scene, state, limitZone(e))
    if (e.type === 'sensor') signals[e.id] = !broken(e) && touching(scene, state, sensorZone(e))
    if (e.type === 'button' || e.type === 'switch' || e.type === 'emergency') signals[e.id] = Boolean(state.pressed[e.id])
  }
  return signals
}

// Entradas que produce la escena (contactos NA / NC; la seta es siempre NC).
// `analogRange(name)` -> { min, max } de una entrada analógica (nivel del depósito).
export function sceneInputs(scene, state, analogRange = () => null) {
  const inputs = {}
  const signals = sceneSignals(scene, state)
  const fault = (e) => state.faults?.[e.id]
  for (const e of elementsOf(scene)) {
    if (e.type === 'cylinder') {
      const pos = state.pos[e.id] ?? 0
      if (e.retracted) inputs[e.retracted] = pos <= 0.001 && fault(e) !== 'sensor:retracted' ? 1 : 0
      if (e.extended) inputs[e.extended] = pos >= 0.999 && fault(e) !== 'sensor:extended' ? 1 : 0
    }
    if (e.type === 'tank') {
      const level = state.level?.[e.id] ?? 0
      if (e.low) inputs[e.low] = level >= TANK.low && fault(e) !== 'sensor:low' ? 1 : 0
      if (e.high) inputs[e.high] = level >= TANK.high && fault(e) !== 'sensor:high' ? 1 : 0
      if (e.level) {
        const range = analogRange(e.level) ?? { min: 0, max: 100 }
        inputs[e.level] = Math.round((range.min + level * (range.max - range.min)) * 100) / 100
      }
    }
    if (!(e.id in signals) || !e.variable) continue
    const nc = e.type === 'emergency' || e.contact === 'NC'
    inputs[e.variable] = signals[e.id] !== nc ? 1 : 0
  }
  return inputs
}

// Entradas que gobierna la escena (no se cambian desde el panel de simulación).
export function sceneInputNames(scene) {
  const names = new Set()
  for (const e of elementsOf(scene)) {
    for (const [key, , dir] of SCENE_VARS[e.type] ?? []) if ((dir === 'in' || dir === 'analog') && e[key]) names.add(e[key])
  }
  return names
}

// Averías que se pueden provocar en un elemento (solo durante la simulación): [{ id, label }].
export function sceneFaults(e) {
  switch (e.type) {
    case 'cylinder':
      return [
        { id: 'stuck', label: 'Atascado' },
        ...(e.retracted ? [{ id: 'sensor:retracted', label: `Detector ${e.retracted} roto` }] : []),
        ...(e.extended ? [{ id: 'sensor:extended', label: `Detector ${e.extended} roto` }] : []),
      ]
    case 'conveyor':
    case 'motor':
      return [{ id: 'stuck', label: 'Atascado' }]
    case 'limit':
    case 'sensor':
      return [{ id: 'broken', label: 'Roto (no detecta)' }]
    case 'tank':
      return [
        { id: 'stuck', label: 'Válvulas atascadas' },
        ...(e.low ? [{ id: 'sensor:low', label: `Sensor ${e.low} roto` }] : []),
        ...(e.high ? [{ id: 'sensor:high', label: `Sensor ${e.high} roto` }] : []),
      ]
    default:
      return []
  }
}

// Acciones del usuario durante la simulación: pulsar / soltar un mando, soltar una pieza,
// vaciar las piezas, provocar o quitar una avería ('fault:<id>' o 'fault:').
export function sceneAction(scene, state, id, action) {
  if (action === 'clear') return { ...state, pieces: [] }
  const e = elementsOf(scene).find((x) => x.id === id)
  if (!e) return state
  if (action === 'press' || action === 'release') return { ...state, pressed: { ...state.pressed, [id]: action === 'press' } }
  if (action === 'toggle') return { ...state, pressed: { ...state.pressed, [id]: !state.pressed[id] } }
  if (action === 'feed' && e.type === 'feeder') return feed(state, e)
  if (action.startsWith('fault:')) return { ...state, faults: { ...state.faults, [id]: action.slice('fault:'.length) || null } }
  return state
}

// --- Montaje automático ----------------------------------------------------------------------

// Propone cilindros a partir de los nombres de las variables (convenio de la neumática): cada
// salida «A+» con, si existen, «A−», «a0» y «a1» (sin «A−», de simple efecto). No repite los que
// ya hay; los coloca en columna, a la derecha de lo que ya existe.
export function detectScene(variables, scene) {
  const elements = elementsOf(scene)
  const names = new Set(variables.map((v) => v.name))
  const used = new Set(elements.flatMap((e) => Object.values(e)))
  const pick = (...options) => options.find((o) => names.has(o)) ?? ''
  const right = elements.length ? Math.max(...elements.map((e) => e.x)) + 260 : 120
  const found = []
  for (const v of variables) {
    if (!v.name.endsWith('+') || used.has(v.name)) continue
    const n = v.name.slice(0, -1)
    if (!/^[A-Za-z]\w*$/.test(n)) continue
    found.push({
      id: `c${n}${found.length}`,
      type: 'cylinder',
      x: right,
      y: 120 + found.length * 110,
      rot: 0,
      ...SCENE_TYPES.cylinder.defaults,
      text: n,
      extend: v.name,
      retract: pick(`${n}-`, `${n}−`),
      retracted: pick(`${n.toLowerCase()}0`, `${n}0`),
      extended: pick(`${n.toLowerCase()}1`, `${n}1`),
    })
  }
  return found
}

// Planta por elementos de versiones anteriores (plc.plant) -> escena equivalente.
export function sceneFromPlant(plant = []) {
  const elements = []
  let y = 100
  for (const p of plant) {
    const id = `m${p.id}`
    if (p.type === 'cylinder') {
      elements.push({ id, type: 'cylinder', x: 120, y, rot: 0, ...SCENE_TYPES.cylinder.defaults, text: p.name ?? '', extend: p.extend ?? '', retract: p.retract ?? '', retracted: p.retracted ?? '', extended: p.extended ?? '', time: Number(p.time) || 1 })
      y += 110
    } else if (p.type === 'conveyor') {
      elements.push({ id, type: 'conveyor', x: 80, y, rot: 0, ...SCENE_TYPES.conveyor.defaults, text: p.name ?? '', motor: p.motor ?? '', length: 300, time: Number(p.time) || 3 })
      elements.push({ id: `${id}f`, type: 'feeder', x: 110, y, rot: 0, ...SCENE_TYPES.feeder.defaults, auto: false })
      if (p.sensor) elements.push({ id: `${id}s`, type: 'sensor', x: 340, y: y + 50, rot: 270, ...SCENE_TYPES.sensor.defaults, variable: p.sensor })
      if (p.entry) elements.push({ id: `${id}e`, type: 'sensor', x: 110, y: y + 50, rot: 270, ...SCENE_TYPES.sensor.defaults, variable: p.entry })
      y += 150
    } else if (p.type === 'tank') {
      elements.push({ id, type: 'tank', x: 120, y, rot: 0, ...SCENE_TYPES.tank.defaults, text: p.name ?? '', fill: p.fill ?? '', drain: p.drain ?? '', low: p.low ?? '', high: p.high ?? '', level: p.level ?? '', fillTime: Number(p.fillTime) || 10, drainTime: Number(p.drainTime) || 10, initial: Number(p.initial) || 0 })
      y += 180
    } else if (p.type === 'lamp') {
      elements.push({ id, type: 'lamp', x: 140, y, rot: 0, ...SCENE_TYPES.lamp.defaults, text: p.name ?? '', variable: p.output ?? '' })
      y += 70
    }
  }
  return { elements }
}
