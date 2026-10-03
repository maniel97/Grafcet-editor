// Escena de la planta virtual (al estilo de PC_SIMU): elementos colocados libremente que
// interactúan entre sí. Puro: se prueba sin navegador.
//
// plc.scene = { elements: [{ id, type, x, y, rot, ...propiedades }] }
//   x, y: punto de anclaje (px de la escena); rot: 0 | 90 | 180 | 270 (sentido horario).
// Física sencilla, sin motor físico: rectángulos que se mueven y se empujan; los detectores
// miran si algo entra en su zona. Las plataformas (también giradas, como pared o tope) y las
// barreras sin abrir son obstáculos: paran las piezas, y un cilindro que empuja contra ellos se
// queda a medio recorrido (su final de carrera no llega).
// scene.gravity: vista de frente (como PC_SIMU) en vez de desde arriba: las piezas caen hasta
// apoyarse en algo (cinta, rampa, plataforma, báscula, placa de un cilindro, fondo de una
// recogida, otra pieza o el suelo de la escena) y las cintas arrastran lo que llevan encima.
//
// Estado: { pos: { [cilindro]: 0..1 }, pressed: { [mando]: bool }, level: { [depósito]: 0..1 },
//           angle: { [motor]: grados }, faults: { [elemento]: avería }, pieces: [{ id, x, y, w, h,
//           color, vy }], counts: { [recogida]: n }, nextPiece, fed: { [alimentador]: valor anterior } }

export const SCENE_TYPES = {
  button: { label: 'Pulsador', group: 'Mandos', defaults: { variable: '', contact: 'NO', color: 'green', text: '' } },
  switch: { label: 'Interruptor', group: 'Mandos', defaults: { variable: '', contact: 'NO', text: '' } },
  emergency: { label: 'Seta de emergencia', group: 'Mandos', defaults: { variable: '', text: 'Emergencia' } },
  lamp: { label: 'Piloto', group: 'Señalización', defaults: { variable: '', color: 'green', text: '' } },
  cylinder: {
    label: 'Cilindro',
    group: 'Actuadores',
    defaults: { extend: '', retract: '', retracted: '', extended: '', position: '', vacuum: '', holding: '', mountedOn: '', stroke: 100, time: 1, text: '' },
  },
  conveyor: { label: 'Cinta', group: 'Actuadores', defaults: { motor: '', length: 240, time: 4, text: '' } },
  limit: { label: 'Final de carrera', group: 'Detectores', defaults: { variable: '', contact: 'NO' } },
  sensor: { label: 'Detector de presencia', group: 'Detectores', defaults: { variable: '', contact: 'NO', range: 60, kind: 'optical', color: 'amber' } },
  distance: { label: 'Sensor de distancia', group: 'Detectores', defaults: { variable: '', range: 200, text: '' } },
  scale: { label: 'Báscula', group: 'Detectores', defaults: { variable: '', text: '' } },
  potentiometer: { label: 'Potenciómetro', group: 'Mandos', defaults: { variable: '', initial: 0.5, text: '' } },
  heater: {
    label: 'Calentador',
    group: 'Proceso',
    defaults: { heat: '', temperature: '', thermostat: '', setpoint: 60, ambient: 20, maxTemp: 150, tau: 20, text: '' },
  },
  feeder: {
    label: 'Alimentador de piezas',
    group: 'Proceso',
    defaults: { trigger: '', auto: true, spacing: 0, sizes: 'small', material: 'plastic', color: 'amber' },
  },
  sink: { label: 'Recogida', group: 'Proceso', defaults: { text: '' } },
  tank: {
    label: 'Depósito',
    group: 'Proceso',
    defaults: { fill: '', drain: '', low: '', high: '', empty: '', level: '', fillTime: 10, drainTime: 10, initial: 0, text: '' },
  },
  motor: { label: 'Motor', group: 'Actuadores', defaults: { variable: '', reverse: '', pulses: '', text: '' } },
  display: { label: 'Visualizador', group: 'Señalización', defaults: { variable: '', text: '' } },
  diverter: { label: 'Desviador', group: 'Actuadores', defaults: { gate: '', length: 80, time: 0.5, text: '' } },
  ramp: { label: 'Rampa', group: 'Proceso', defaults: { length: 120, time: 1, text: '' } },
  platform: { label: 'Plataforma', group: 'Proceso', defaults: { length: 160, text: '' } },
  siren: { label: 'Sirena', group: 'Señalización', defaults: { variable: '', sound: false, text: '' } },
  trafficlight: { label: 'Semáforo', group: 'Señalización', defaults: { red: '', amber: '', green: '', text: '' } },
  valve: { label: 'Electroválvula', group: 'Actuadores', defaults: { variable: '', text: '' } },
  barrier: { label: 'Barrera', group: 'Actuadores', defaults: { open: '', close: '', opened: '', closed: '', length: 140, time: 2, text: '' } },
  pipe: { label: 'Tubería', group: 'Decoración', defaults: { variable: '', length: 160, text: '' } },
  label: { label: 'Rótulo', group: 'Decoración', defaults: { text: 'Rótulo', size: 16 } },
  image: { label: 'Imagen', group: 'Decoración', defaults: { src: '', width: 300, height: 200, text: '' } },
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
    ['position', 'Posición (analógica, opcional)', 'analog'],
    ['vacuum', 'Ventosa: vacío (opcional)', 'out'],
    ['holding', 'Ventosa: pieza cogida (opcional)', 'in'],
  ],
  conveyor: [['motor', 'Motor', 'out']],
  limit: [['variable', 'Entrada', 'in']],
  sensor: [['variable', 'Entrada', 'in']],
  distance: [['variable', 'Distancia (analógica)', 'analog']],
  scale: [['variable', 'Peso en kg (analógica)', 'analog']],
  potentiometer: [['variable', 'Entrada analógica', 'analog']],
  heater: [
    ['heat', 'Resistencia', 'out'],
    ['temperature', 'Temperatura en °C (analógica)', 'analog'],
    ['thermostat', 'Termostato (opcional)', 'in'],
  ],
  // La orden de soltar pieza: una salida del grafcet o un pulsador de la planta (flanco de subida).
  feeder: [['trigger', 'Soltar pieza: salida o pulsador (opcional)', 'trigger']],
  sink: [],
  tank: [
    ['fill', 'Válvula de llenado', 'out'],
    ['drain', 'Válvula de vaciado', 'out'],
    ['low', 'Sensor nivel bajo', 'in'],
    ['high', 'Sensor nivel alto', 'in'],
    ['empty', 'Sensor de vacío (opcional)', 'in'],
    ['level', 'Nivel (analógica)', 'analog'],
  ],
  motor: [
    ['variable', 'Marcha', 'out'],
    ['reverse', 'Giro inverso (opcional)', 'out'],
    ['pulses', 'Encoder: 1 impulso por vuelta (opcional)', 'in'],
  ],
  display: [['variable', 'Valor', 'any']],
  diverter: [['gate', 'Desviar (salida)', 'out']],
  ramp: [],
  platform: [],
  siren: [['variable', 'Salida', 'out']],
  trafficlight: [
    ['red', 'Rojo (salida)', 'out'],
    ['amber', 'Ámbar (salida)', 'out'],
    ['green', 'Verde (salida)', 'out'],
  ],
  valve: [['variable', 'Abrir (salida)', 'out']],
  barrier: [
    ['open', 'Abrir (salida)', 'out'],
    ['close', 'Cerrar (salida; vacío = por su peso)', 'out'],
    ['opened', 'Final abierta (entrada)', 'in'],
    ['closed', 'Final cerrada (entrada)', 'in'],
  ],
  pipe: [['variable', 'Circula si… (opcional)', 'any']],
  label: [],
  image: [],
}

// Tamaño del depósito (anclaje: esquina superior izquierda) y de sus sensores de nivel.
export const TANK = { w: 90, h: 130, low: 0.1, high: 0.9 }

const BODY = 80 // largo del cuerpo de un cilindro
export const PIECE_SIZES = { small: [28, 28], large: [44, 44] }

// Tipos de detector de presencia: qué ven (piezas y vástagos de los cilindros).
//   óptico y capacitivo: cualquier pieza; inductivo: solo metal; de color: piezas de su color.
export const SENSOR_KINDS = {
  optical: { label: 'Óptico (réflex)', range: 60 },
  inductive: { label: 'Inductivo (metal)', range: 20 },
  capacitive: { label: 'Capacitivo', range: 20 },
  color: { label: 'De color', range: 30 },
}
export const PIECE_COLORS = { amber: 'Ámbar', red: 'Rojo', blue: 'Azul', green: 'Verde', black: 'Negro' }
// Masa de una pieza (kg), para la báscula: el metal pesa el triple.
export const pieceMass = (p) => (p.w >= PIECE_SIZES.large[0] ? 2 : 1) * (p.material === 'metal' ? 3 : 1)

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
export const distanceBeam = (e) => worldRect(e, 12, -6, Number(e.range) || 200, 12)
export const scaleRect = (e) => worldRect(e, -40, -8, 80, 16) // el plato
// Desviador: zona que, activa, empuja las piezas en el sentido de su flecha (desde el anclaje).
export const diverterRect = (e) => worldRect(e, 0, -25, Number(e.length) || 80, 50)
// Rampa: las piezas resbalan solas hacia su extremo.
export const rampRect = (e) => worldRect(e, 0, -20, Number(e.length) || 120, 40)
export const conveyorRect = (e) => worldRect(e, 0, -15, Number(e.length) || 240, 30)
export const sinkRect = (e) => worldRect(e, -30, -30, 60, 60)
// Plataforma: superficie fija (anclaje: extremo izquierdo de su cara de arriba).
export const platformRect = (e) => worldRect(e, 0, 0, Number(e.length) || 160, 14)
// Brazo de una barrera cerrada (al abrirse gira hacia arriba y deja de estorbar).
export const barrierArm = (e) => worldRect(e, 0, -22, Number(e.length) || 140, 8)

// Vista de frente (scene.gravity): aceleración (px/s²), suelo de la escena (10 px por encima del
// borde de abajo, para que se vea) y
// cuánto puede «subir» una pieza a una superficie que la alcanza (la placa de un cilindro que la
// eleva, el extremo de una cinta un poco más alta).
export const GRAVITY = 900
export const SCENE_FLOOR = 790
const STEP_UP = 24

// Cilindro montado en el vástago de otro (e.mountedOn): viaja con él. Su x, y son los de con el
// otro recogido; se le suma lo que haya salido el vástago del otro (y, en cadena, lo del suyo).
export function placed(scene, state, e, depth = 0) {
  if (e.type !== 'cylinder' || !e.mountedOn || depth > 4) return e
  const carrier = (scene?.elements ?? []).find((c) => c.id === e.mountedOn && c.type === 'cylinder' && c.id !== e.id)
  if (!carrier) return e
  const base = placed(scene, state, carrier, depth + 1)
  const [dx, dy] = rotate((state.pos?.[carrier.id] ?? 0) * (Number(carrier.stroke) || 100), 0, carrier.rot)
  return { ...e, x: e.x + dx + (base.x - carrier.x), y: e.y + dy + (base.y - carrier.y) }
}
// Placa del vástago de un cilindro donde está ahora (con su montaje).
export const platePlaced = (scene, state, c) => cylinderPlate(placed(scene, state, c), state.pos?.[c.id] ?? 0)

// --- Simulación ----------------------------------------------------------------------------

// Superficies fijas en las que se apoyan las piezas con gravedad.
function supports(scene, state) {
  const out = []
  for (const e of elementsOf(scene)) {
    if (e.type === 'conveyor') out.push(conveyorRect(e))
    if (e.type === 'ramp') out.push(rampRect(e))
    if (e.type === 'platform') out.push(platformRect(e))
    if (e.type === 'scale') out.push(scaleRect(e))
    if (e.type === 'cylinder' && !e.vacuum) out.push(platePlaced(scene, state, e))
    if (e.type === 'sink') {
      const r = sinkRect(e)
      out.push({ x: r.x, y: r.y + r.h, w: r.w, h: 1 }) // el fondo: lo que cae dentro se recoge
    }
  }
  return out
}
// Obstáculos fijos para las piezas: plataformas y barreras que no están abiertas.
function obstacles(scene, state) {
  const out = []
  for (const e of elementsOf(scene)) {
    if (e.type === 'platform') out.push(platformRect(e))
    if (e.type === 'barrier' && (state.pos?.[e.id] ?? 0) < 0.9) out.push(barrierArm(e))
  }
  return out
}

// Empuje en cadena: la pieza p pasa a quedar delante de `front` en el sentido (ux, uy) y empuja a
// su vez a las que encuentre. Propone las posiciones nuevas en `moves` (id -> rect); false si
// algo lo impide (un obstáculo, una pieza cogida por una ventosa o una cadena demasiado larga).
function shove(p, front, ux, uy, ctx, depth = 0) {
  if (depth > 30 || ctx.held.has(p.id)) return false
  const now = ctx.moves.get(p.id) ?? p
  const target = { ...now }
  if (ux > 0) target.x = Math.max(now.x, front.x + front.w)
  if (ux < 0) target.x = Math.min(now.x, front.x - now.w)
  if (uy > 0) target.y = Math.max(now.y, front.y + front.h)
  if (uy < 0) target.y = Math.min(now.y, front.y - now.h)
  if (ctx.walls.some((w) => overlaps(target, w))) return false
  ctx.moves.set(p.id, target)
  for (const o of ctx.pieces) {
    if (o === p) continue
    if (overlaps(target, ctx.moves.get(o.id) ?? o) && !shove(o, target, ux, uy, ctx, depth + 1)) return false
  }
  return true
}

// ¿Descansa la pieza sobre la cara de arriba de r? (con gravedad, lo que mueve una cinta)
const restsOn = (p, r) => Math.abs(p.y + p.h - r.y) < 1 && p.x + p.w / 2 >= r.x && p.x + p.w / 2 <= r.x + r.w

// Caída de las piezas (de la más baja a la más alta: las de abajo sirven de apoyo a las de
// encima). Una pieza se apoya si su centro está sobre la superficie (si no, vuelca y cae). En el
// aire conserva la velocidad horizontal con la que salió (de una cinta, una rampa…).
function fall(scene, state, held, dt) {
  const fixed = supports(scene, state)
  const walls = obstacles(scene, state)
  const below = []
  for (const p of [...state.pieces].sort((a, b) => b.y + b.h - (a.y + a.h))) {
    if (held.has(p.id)) {
      below.push(p)
      continue
    }
    const cx = p.x + p.w / 2
    const bottom = p.y + p.h
    let top = SCENE_FLOOR
    for (const r of [...fixed, ...below]) if (cx >= r.x && cx <= r.x + r.w && r.y >= bottom - STEP_UP && r.y < top) top = r.y
    const land = () => {
      p.y = top - p.h
      p.vy = 0
      p.vx = 0
    }
    if (top <= bottom + 0.5) land()
    else {
      const vy = (p.vy ?? 0) + GRAVITY * dt
      if (bottom + vy * dt >= top) land()
      else {
        p.y = Math.round((p.y + vy * dt) * 1000) / 1000
        // En el aire sigue avanzando, salvo que choque con una pared: entonces cae a plomo.
        const x = Math.round((p.x + (p.vx ?? 0) * dt) * 1000) / 1000
        if (walls.some((w) => overlaps({ ...p, x }, w) && !overlaps(p, w))) p.vx = 0
        else p.x = x
        p.vy = vy
      }
    }
    below.push(p)
  }
}

const on = (values, name) => Boolean(name) && Number(values[name] ?? 0) !== 0
// Fracción de velocidad de un motor (1 si va a tope; menos con un variador o en la rampa de un
// arrancador suave).
const fraction = (values, name) => {
  const v = Number(values[name] ?? 0)
  return v > 0 && v < 1 ? v : 1
}
const clamp = (x) => Math.min(1, Math.max(0, x))
const elementsOf = (scene) => scene?.elements ?? []

export function sceneInit(scene) {
  const pos = {}
  const pressed = {}
  const level = {}
  const knob = {}
  const temp = {}
  for (const e of elementsOf(scene)) {
    // initial: 1 si el cilindro empieza con el vástago fuera.
    if (e.type === 'cylinder') pos[e.id] = Number(e.initial) ? 1 : 0
    if (e.type === 'barrier') pos[e.id] = 0 // cerrada
    // La seta de emergencia está sin pulsar (contacto cerrado) al empezar.
    if (e.type === 'button' || e.type === 'switch' || e.type === 'emergency') pressed[e.id] = false
    if (e.type === 'tank') level[e.id] = clamp(Number(e.initial) || 0)
    if (e.type === 'potentiometer') knob[e.id] = clamp(Number(e.initial ?? 0.5))
    if (e.type === 'heater') temp[e.id] = Number(e.ambient ?? 20)
  }
  return { pos, pressed, level, knob, temp, angle: {}, faults: {}, held: {}, pieces: [], counts: {}, nextPiece: 1, fed: {} }
}

// Pieza nueva en un alimentador (si su sitio está libre; con `gap`, también ese margen alrededor:
// el automático deja así hueco entre una pieza y la siguiente).
function feed(state, e, gap = 0) {
  const n = state.nextPiece - 1
  const sizes = e.sizes === 'mixed' ? ['small', 'large'] : [e.sizes in PIECE_SIZES ? e.sizes : 'small']
  const [w, h] = PIECE_SIZES[sizes[n % sizes.length]]
  // Material alterno: cambia cada dos piezas si los tamaños también alternan (salen todas las
  // combinaciones: pequeña y grande, de plástico y de metal).
  const step = e.sizes === 'mixed' ? Math.floor(n / 2) : n
  const material = e.material === 'mixed' ? (step % 2 ? 'metal' : 'plastic') : e.material === 'metal' ? 'metal' : 'plastic'
  const color = material === 'metal' ? 'metal' : (e.color ?? 'amber')
  const piece = { id: state.nextPiece, x: e.x - w / 2, y: e.y - h / 2, w, h, color, material }
  const area = { x: piece.x - gap, y: piece.y - gap, w: piece.w + 2 * gap, h: piece.h + 2 * gap }
  if (state.pieces.some((p) => overlaps(p, area))) return state
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
    temp: { ...state.temp },
    pieces: state.pieces.map((p) => ({ ...p })),
    counts: { ...state.counts },
    fed: { ...state.fed },
  }

  // Alimentadores: automáticos (siempre una pieza esperando) o con su orden (flanco de subida).
  for (const e of elements) {
    if (e.type !== 'feeder') continue
    const order = on(values, e.trigger)
    if (e.trigger ? order && !next.fed[e.id] : e.auto) next = feed(next, e, e.trigger ? 0 : Number(e.spacing) || 0)
    next.fed[e.id] = order
  }

  // Lo que mueve piezas: cintas en marcha, desviadores activos (empujan de lado; sobre una cinta,
  // la pieza sale en diagonal) y rampas (siempre). Las piezas cuyo centro está en la zona avanzan,
  // sin montarse sobre la de delante.
  const heldIds = new Set(Object.values(state.held ?? {}).map((h) => h.id))
  const extending = new Set() // cilindros cuyo vástago sigue saliendo en este paso
  const movers = []
  for (const e of elements) {
    if (stuck(e)) continue
    // Con un variador, la cinta va más despacio (la señal del motor es la fracción de velocidad).
    if (e.type === 'conveyor' && on(values, e.motor)) movers.push([e, conveyorRect(e), (Number(e.length) || 240) * fraction(values, e.motor), Number(e.time) || 4])
    if (e.type === 'diverter' && on(values, e.gate)) movers.push([e, diverterRect(e), Number(e.length) || 80, Number(e.time) || 0.5])
    if (e.type === 'ramp') movers.push([e, rampRect(e), Number(e.length) || 120, Number(e.time) || 1])
  }
  const walls = obstacles(scene, next)
  for (const [e, rect, length, time] of movers) {
    const speed = length / Math.max(0.1, time)
    const [dx, dy] = rotate(speed * dt, 0, e.rot)
    for (const p of next.pieces) {
      if (heldIds.has(p.id) || !(scene?.gravity ? restsOn(p, rect) : inside(center(p), rect))) continue
      const moved = { ...p, x: p.x + dx, y: p.y + dy }
      const blocked =
        next.pieces.some((o) => o !== p && overlaps(moved, o) && !overlaps(p, o)) || walls.some((w) => overlaps(moved, w) && !overlaps(p, w))
      if (!blocked) Object.assign(p, { x: moved.x, y: moved.y }, scene?.gravity ? { vx: dx / dt } : {})
    }
  }

  // Cilindros: el vástago sale o entra; la placa empuja las piezas que encuentra al salir.
  for (const e of elements) {
    if (e.type !== 'cylinder' || stuck(e)) continue
    const out = on(values, e.extend)
    const back = e.retract ? on(values, e.retract) : !out
    const dir = out && !back ? 1 : back && !out ? -1 : 0
    if (!dir) continue
    // Redondeada: sin restos de coma flotante (0,000…003 en vez de 0) al sumar muchos pasos.
    const before = next.pos[e.id]
    const pos = Math.round(clamp(before + (dir * dt) / Math.max(0.05, Number(e.time) || 1)) * 1e6) / 1e6
    next.pos[e.id] = pos
    if (dir > 0 && pos < 1) extending.add(e.id)
    // Con ventosa no empuja: coge (abajo).
    if (dir < 0 || e.vacuum) continue
    // La placa deja delante, en el sentido del vástago, las piezas que toca (y estas a las que
    // tengan delante). Si algo fijo lo impide, el vástago no avanza: se queda empujando.
    const plate = platePlaced(scene, next, e)
    const [ux, uy] = rotate(1, 0, e.rot)
    const ctx = { pieces: next.pieces, walls, held: heldIds, moves: new Map() }
    const pushed = next.pieces.filter((p) => !heldIds.has(p.id) && overlaps(plate, p))
    if (pushed.every((p) => shove(p, plate, ux, uy, ctx))) {
      for (const p of next.pieces) if (ctx.moves.has(p.id)) Object.assign(p, ctx.moves.get(p.id))
    } else next.pos[e.id] = before
  }

  // Ventosas: con vacío cogen la pieza que tocan y la llevan con el vástago; sin vacío, la sueltan
  // donde esté (y vuelve a moverla lo que tenga debajo: una cinta, una rampa…).
  const held = { ...(state.held ?? {}) }
  for (const e of elements) {
    if (e.type !== 'cylinder' || !e.vacuum) continue
    if (!on(values, e.vacuum) || faults[e.id] === 'vacuum') {
      delete held[e.id]
      continue
    }
    // Coge al llegar (vástago parado o al final), no al rozar mientras sale: así no la hunde.
    if (held[e.id] || extending.has(e.id)) continue
    const plate = platePlaced(scene, next, e)
    const grip = { x: plate.x - 4, y: plate.y - 4, w: plate.w + 8, h: plate.h + 8 }
    const taken = new Set(Object.values(held).map((h) => h.id))
    const p = next.pieces.find((q) => !taken.has(q.id) && overlaps(grip, q))
    if (p) held[e.id] = { id: p.id, dx: p.x - plate.x, dy: p.y - plate.y }
  }
  for (const [id, h] of Object.entries(held)) {
    const c = elements.find((x) => x.id === id)
    const p = next.pieces.find((x) => x.id === h.id)
    if (!c || !p) {
      delete held[id]
      continue
    }
    const plate = platePlaced(scene, next, c)
    p.x = plate.x + h.dx
    p.y = plate.y + h.dy
  }
  next.held = held

  // Barreras: se abren (0 -> 1) con su orden y se cierran con la suya o, sin ella, por su peso.
  for (const e of elements) {
    if (e.type !== 'barrier' || stuck(e)) continue
    const opening = on(values, e.open)
    const closing = e.close ? on(values, e.close) : !opening
    const dir = opening && !closing ? 1 : closing && !opening ? -1 : 0
    if (dir) next.pos[e.id] = Math.round(clamp((next.pos[e.id] ?? 0) + (dir * dt) / Math.max(0.1, Number(e.time) || 2)) * 1e6) / 1e6
  }

  // Depósitos: se llenan y vacían con sus válvulas.
  for (const e of elements) {
    if (e.type !== 'tank' || stuck(e)) continue
    const filling = on(values, e.fill) ? dt / Math.max(0.1, Number(e.fillTime) || 10) : 0
    const draining = on(values, e.drain) ? dt / Math.max(0.1, Number(e.drainTime) || 10) : 0
    next.level[e.id] = clamp((next.level[e.id] ?? 0) + filling - draining)
  }

  // Calentadores: la temperatura tiende a la máxima con la resistencia encendida y a la ambiente
  // apagada (primer orden, constante de tiempo tau).
  for (const e of elements) {
    if (e.type !== 'heater') continue
    const ambient = Number(e.ambient ?? 20)
    const target = on(values, e.heat) && !stuck(e) ? Number(e.maxTemp ?? 150) : ambient
    const t = next.temp[e.id] ?? ambient
    next.temp[e.id] = t + (target - t) * (1 - Math.exp(-dt / Math.max(0.5, Number(e.tau) || 20)))
  }

  // Motores: solo giran (para verlo); una vuelta por segundo.
  for (const e of elements) {
    if (e.type !== 'motor' || stuck(e)) continue
    const dir = on(values, e.variable) ? (on(values, e.reverse) ? -1 : 1) : 0
    if (dir) next.angle[e.id] = ((next.angle[e.id] ?? 0) + dir * 360 * dt * fraction(values, e.variable)) % 360
  }

  if (scene?.gravity) fall(scene, next, new Set(Object.values(next.held).map((h) => h.id)), dt)

  // Recogidas: retiran (y cuentan) las piezas que caen dentro.
  for (const e of elements) {
    if (e.type !== 'sink') continue
    const rect = sinkRect(e)
    const carried = new Set(Object.values(next.held).map((h) => h.id))
    const kept = next.pieces.filter((p) => carried.has(p.id) || !inside(center(p), rect))
    next.counts[e.id] = (next.counts[e.id] ?? 0) + next.pieces.length - kept.length
    next.pieces = kept
  }
  return next
}

// ¿Qué tiene delante un detector? (placas de los vástagos y piezas). `kind`: tipo de detector
// de presencia (los finales de carrera los pisa cualquier cosa).
function touching(scene, state, zone, sensor = null) {
  const kind = sensor?.kind ?? 'optical'
  const sees = (p) => (kind === 'inductive' ? p.material === 'metal' : kind === 'color' ? p.color === (sensor.color ?? 'amber') : true)
  if (state.pieces.some((p) => sees(p) && overlaps(zone, p))) return true
  // Los vástagos (metálicos) los ven todos menos el de color.
  if (kind === 'color') return false
  return elementsOf(scene).some((c) => c.type === 'cylinder' && overlaps(zone, platePlaced(scene, state, c)))
}

// Distancia (px) del sensor de distancia al primer objeto de su haz; null si no hay ninguno.
export function measuredDistance(scene, state, e) {
  const beam = distanceBeam(e)
  const range = Number(e.range) || 200
  const rot = ((e.rot ?? 0) % 360 + 360) % 360
  const along = (r) =>
    rot === 90 ? r.y - (e.y + 12) : rot === 180 ? e.x - 12 - (r.x + r.w) : rot === 270 ? e.y - 12 - (r.y + r.h) : r.x - (e.x + 12)
  const rects = [
    ...state.pieces,
    ...elementsOf(scene)
      .filter((c) => c.type === 'cylinder')
      .map((c) => platePlaced(scene, state, c)),
  ].filter((r) => overlaps(beam, r))
  if (!rects.length) return null
  return Math.min(range, Math.max(0, Math.min(...rects.map(along))))
}
// Peso (kg) de las piezas sobre una báscula.
export const weighed = (state, e) => {
  const plate = scaleRect(e)
  const zone = { ...plate, y: plate.y - 50, h: plate.h + 50 } // la pieza descansa encima del plato
  return state.pieces.filter((p) => inside(center(p), zone)).reduce((sum, p) => sum + pieceMass(p), 0)
}

// Estado de cada elemento para dibujarlo y para las entradas: { [id]: true | false }.
// Un detector averiado («roto») no detecta nada.
export function sceneSignals(scene, state) {
  const signals = {}
  const broken = (e) => state.faults?.[e.id] === 'broken'
  for (const e of elementsOf(scene)) {
    if (e.type === 'limit') signals[e.id] = !broken(e) && touching(scene, state, limitZone(e))
    if (e.type === 'sensor') signals[e.id] = !broken(e) && touching(scene, state, sensorZone(e), e)
    if (e.type === 'button' || e.type === 'switch' || e.type === 'emergency') signals[e.id] = Boolean(state.pressed[e.id])
  }
  return signals
}

// Señales «accionadas» de la planta, por nombre (para el esquema eléctrico, que pone sus propios
// contactos NA / NC): pulsadores, interruptores y setas pulsados, detectores que detectan, y los
// sensores de cilindros y depósitos activos.
export function scenePhysical(scene, state) {
  const out = {}
  const signals = sceneSignals(scene, state)
  for (const [name, value] of Object.entries(sceneInputs(scene, state))) out[name] = Boolean(Number(value))
  for (const e of elementsOf(scene)) if (e.variable && e.id in signals) out[e.variable] = signals[e.id]
  return out
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
      if (e.empty) inputs[e.empty] = level <= 0.02 && fault(e) !== 'sensor:empty' ? 1 : 0
      if (e.level) {
        const range = analogRange(e.level) ?? { min: 0, max: 100 }
        inputs[e.level] = Math.round((range.min + level * (range.max - range.min)) * 100) / 100
      }
    }
    // Analógicas: valor físico dentro del rango de la variable (o en sus unidades: °C, kg).
    const scaled = (name, fraction) => {
      const range = analogRange(name) ?? { min: 0, max: 100 }
      inputs[name] = Math.round((range.min + clamp(fraction) * (range.max - range.min)) * 100) / 100
    }
    if (e.type === 'cylinder' && e.position) scaled(e.position, state.pos[e.id] ?? 0)
    if (e.type === 'cylinder' && e.holding) inputs[e.holding] = state.held?.[e.id] ? 1 : 0
    if (e.type === 'barrier') {
      const pos = state.pos[e.id] ?? 0
      if (e.opened) inputs[e.opened] = pos >= 0.999 && fault(e) !== 'sensor:opened' ? 1 : 0
      if (e.closed) inputs[e.closed] = pos <= 0.001 && fault(e) !== 'sensor:closed' ? 1 : 0
    }
    if (e.type === 'potentiometer' && e.variable) scaled(e.variable, state.knob?.[e.id] ?? 0.5)
    if (e.type === 'distance' && e.variable) {
      const d = fault(e) === 'broken' ? null : measuredDistance(scene, state, e)
      scaled(e.variable, d === null ? 1 : d / (Number(e.range) || 200))
    }
    if (e.type === 'scale' && e.variable) inputs[e.variable] = fault(e) === 'broken' ? 0 : weighed(state, e)
    if (e.type === 'heater') {
      const t = Math.round((state.temp?.[e.id] ?? Number(e.ambient ?? 20)) * 10) / 10
      if (e.temperature) inputs[e.temperature] = fault(e) === 'sensor:temperature' ? 0 : t
      if (e.thermostat) inputs[e.thermostat] = t >= Number(e.setpoint ?? 60) ? 1 : 0
    }
    if (e.type === 'motor' && e.pulses) {
      // Medio giro a 1 y medio a 0 (en los dos sentidos).
      const angle = (((state.angle?.[e.id] ?? 0) % 360) + 360) % 360
      inputs[e.pulses] = angle > 0 && angle < 180 ? 1 : 0
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
        ...(e.vacuum ? [{ id: 'vacuum', label: 'Ventosa sin vacío (no coge)' }] : []),
      ]
    case 'conveyor':
    case 'motor':
    case 'diverter':
      return [{ id: 'stuck', label: 'Atascado' }]
    case 'barrier':
      return [
        { id: 'stuck', label: 'Atascada' },
        ...(e.opened ? [{ id: 'sensor:opened', label: `Final ${e.opened} roto` }] : []),
        ...(e.closed ? [{ id: 'sensor:closed', label: `Final ${e.closed} roto` }] : []),
      ]
    case 'limit':
    case 'sensor':
    case 'distance':
    case 'scale':
      return [{ id: 'broken', label: 'Roto (no detecta)' }]
    case 'heater':
      return [{ id: 'stuck', label: 'Resistencia fundida' }, ...(e.temperature ? [{ id: 'sensor:temperature', label: 'Sonda de temperatura rota' }] : [])]
    case 'tank':
      return [
        { id: 'stuck', label: 'Válvulas atascadas' },
        ...(e.low ? [{ id: 'sensor:low', label: `Sensor ${e.low} roto` }] : []),
        ...(e.high ? [{ id: 'sensor:high', label: `Sensor ${e.high} roto` }] : []),
        ...(e.empty ? [{ id: 'sensor:empty', label: `Sensor ${e.empty} roto` }] : []),
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
  if (action.startsWith('set:') && e.type === 'potentiometer') return { ...state, knob: { ...state.knob, [id]: clamp(Number(action.slice(4))) } }
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

// --- Entradas y salidas de la planta ----------------------------------------------------------

// Campos imprescindibles de cada tipo (sin ellos, el elemento no hace nada); [] = ninguno.
// Con varios, basta con uno (p. ej. el depósito, con llenado o vaciado).
const REQUIRED = {
  button: ['variable'],
  switch: ['variable'],
  emergency: ['variable'],
  lamp: ['variable'],
  cylinder: ['extend'],
  conveyor: ['motor'],
  limit: ['variable'],
  sensor: ['variable'],
  distance: ['variable'],
  scale: ['variable'],
  potentiometer: ['variable'],
  heater: ['heat'],
  tank: ['fill', 'drain'],
  motor: ['variable'],
  display: ['variable'],
  diverter: ['gate'],
  siren: ['variable'],
  valve: ['variable'],
  barrier: ['open'],
  trafficlight: ['red', 'amber', 'green'],
}

// Resumen de las conexiones entre la escena y el grafcet (variables del modelo, con uses y
// address):
//   signals: cada variable que usa la escena: { name, type, address, dir, elements: [id] }
//   unassigned: elementos a los que les falta su variable imprescindible: [id]
//   manual: entradas del grafcet que la escena no da (se cambian a mano en el panel)
//   unusedOutputs: salidas del grafcet que ningún elemento usa
//   notInGrafcet: variables de la escena que el grafcet no usa
export function sceneIO(scene, variables) {
  const elements = elementsOf(scene)
  const byName = new Map(variables.map((v) => [v.name, v]))
  const signals = new Map()
  for (const e of elements) {
    for (const [key, , kind] of SCENE_VARS[e.type] ?? []) {
      const name = e[key]
      if (!name) continue
      const v = byName.get(name)
      // La orden del alimentador: salida si la da el grafcet; si no, entrada (un pulsador).
      const dir = kind === 'trigger' ? (v?.type === 'output' || v?.type === 'memory' ? 'out' : 'in') : kind
      const entry = signals.get(name) ?? { name, type: v?.type ?? null, address: v?.address ?? '', dir, elements: [] }
      if (!entry.elements.includes(e.id)) entry.elements.push(e.id)
      signals.set(name, entry)
    }
  }
  const unassigned = elements.filter((e) => REQUIRED[e.type]?.length && REQUIRED[e.type].every((k) => !e[k])).map((e) => e.id)
  const driven = sceneInputNames(scene)
  const manual = variables.filter((v) => (v.type === 'input' || v.type === 'analogIn') && v.uses.length && !driven.has(v.name)).map((v) => v.name)
  const unusedOutputs = variables.filter((v) => v.type === 'output' && v.uses.length && !signals.has(v.name)).map((v) => v.name)
  // Un pulsador que solo suelta piezas del alimentador es de la planta: no es un aviso.
  const plantOnly = new Set(elements.filter((e) => e.type === 'feeder' && e.trigger && driven.has(e.trigger)).map((e) => e.trigger))
  const notInGrafcet = [...signals.values()].filter((s) => !byName.get(s.name)?.uses.length && !plantOnly.has(s.name)).map((s) => s.name)
  return { signals: [...signals.values()].sort((a, b) => a.name.localeCompare(b.name)), unassigned, manual, unusedOutputs, notInGrafcet }
}
