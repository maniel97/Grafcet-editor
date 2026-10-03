// Escena de la planta virtual (al estilo de PC_SIMU): elementos colocados libremente que
// interactúan entre sí. Puro: se prueba sin navegador.
//
// plc.scene = { elements: [{ id, type, x, y, rot, ...propiedades }] }
//   x, y: punto de anclaje (px de la escena); rot: 0 | 90 | 180 | 270 (sentido horario).
// Física sencilla, sin motor físico: rectángulos que se mueven y se empujan; los detectores
// miran si algo entra en su zona.
//
// Estado: { pos: { [cilindro]: 0..1 }, pressed: { [mando]: bool }, pieces: [{ id, x, y, w, h,
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
}

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
  for (const e of elementsOf(scene)) {
    if (e.type === 'cylinder') pos[e.id] = 0
    // La seta de emergencia está sin pulsar (contacto cerrado) al empezar.
    if (e.type === 'button' || e.type === 'switch' || e.type === 'emergency') pressed[e.id] = false
  }
  return { pos, pressed, pieces: [], counts: {}, nextPiece: 1, fed: {} }
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
  let next = { ...state, pos: { ...state.pos }, pieces: state.pieces.map((p) => ({ ...p })), counts: { ...state.counts }, fed: { ...state.fed } }

  // Alimentadores: automáticos (siempre una pieza esperando) o con su orden (flanco de subida).
  for (const e of elements) {
    if (e.type !== 'feeder') continue
    const order = on(values, e.trigger)
    if (e.trigger ? order && !next.fed[e.id] : e.auto) next = feed(next, e)
    next.fed[e.id] = order
  }

  // Cintas: las piezas cuyo centro está encima avanzan (sin montarse sobre la de delante).
  for (const e of elements) {
    if (e.type !== 'conveyor' || !on(values, e.motor)) continue
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
    if (e.type !== 'cylinder') continue
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
export function sceneSignals(scene, state) {
  const signals = {}
  for (const e of elementsOf(scene)) {
    if (e.type === 'limit') signals[e.id] = touching(scene, state, limitZone(e))
    if (e.type === 'sensor') signals[e.id] = touching(scene, state, sensorZone(e))
    if (e.type === 'button' || e.type === 'switch' || e.type === 'emergency') signals[e.id] = Boolean(state.pressed[e.id])
  }
  return signals
}

// Entradas que produce la escena (contactos NA / NC; la seta es siempre NC).
export function sceneInputs(scene, state) {
  const inputs = {}
  const signals = sceneSignals(scene, state)
  for (const e of elementsOf(scene)) {
    if (e.type === 'cylinder') {
      const pos = state.pos[e.id] ?? 0
      if (e.retracted) inputs[e.retracted] = pos <= 0.001 ? 1 : 0
      if (e.extended) inputs[e.extended] = pos >= 0.999 ? 1 : 0
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
  for (const e of elementsOf(scene)) for (const [key, , dir] of SCENE_VARS[e.type] ?? []) if (dir === 'in' && e[key]) names.add(e[key])
  return names
}

// Acciones del usuario durante la simulación: pulsar / soltar un mando, soltar una pieza.
export function sceneAction(scene, state, id, action) {
  if (action === 'clear') return { ...state, pieces: [] }
  const e = elementsOf(scene).find((x) => x.id === id)
  if (!e) return state
  if (action === 'press' || action === 'release') return { ...state, pressed: { ...state.pressed, [id]: action === 'press' } }
  if (action === 'toggle') return { ...state, pressed: { ...state.pressed, [id]: !state.pressed[id] } }
  if (action === 'feed' && e.type === 'feeder') return feed(state, e)
  return state
}
