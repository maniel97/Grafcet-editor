// Planta virtual -> PC_SIMU (.sim). PC_SIMU es un simulador de S7-200 muy usado en FP: carga el
// programa y lo prueba con un panel de pulsadores, pilotos y máquinas dibujadas.
//
// Formato (sacado de PC_SIMU.exe y comprobado con sus .sim de ejemplo; detalle en docs/formato-pcsimu.md):
//   PC_SIMU*  1* 50*<objeto>**<objeto>** … **<objeto>*$$$   (texto en Windows-1252)
//   objeto = n*tipo#nombre*x1*y1*x2*y2*f4*…*f17#texto#texto2#grupo*a*b
// n: orden desde 0; (x1, y1)-(x2, y2): rectángulo en la pantalla; f4…f17: 14 enteros cuyo sentido
// depende del tipo (en los de un bit, f5 y f7 son el byte y el bit de la dirección: I f5.f7 o Q f5.f7).
// 1008 es un texto suelto: rectángulo de 8 px por letra y 17 de alto; el texto va en «texto».
// Lo que no se exporta todavía (cilindros, cintas, depósitos…) sale en los avisos, con su tipo (en
// español, como los de la exportación a S7-200).
import { parseAddress } from './addressing'
import { encodeAnsi } from './ladder/exportS7200'
import { SCENE_TYPES, PIECE_SIZES, worldRect } from './sim/scene'
import { t as tr } from './i18n'

export const PCSIMU_HEADER = 'PC_SIMU*  1* 50*'
export const PCSIMU_COLORS = { green: 0, black: 1, blue: 2, cyan: 3, red: 4, magenta: 5, yellow: 6, white: 7 }
export const PCSIMU_TYPES = { switch: 1, button: 2, limit: 6, detector: 7, led: 11, sound: 15, motor: 18, cylinder: 19, beacon: 29, text: 1008 }

// Lo que no puede ir en un campo: los separadores del formato.
const clean = (text) => String(text ?? '').replace(/[#*$]/g, ' ').trim()

export function pcsimuRecord(n, { type, name = '', rect, fields = [], text = '', text2 = '', group = '', a = 0, b = 0 }) {
  const f = Array.from({ length: 14 }, (_, i) => fields[i] ?? 0)
  return `${n}*${type}#${clean(name)}*${[...rect, ...f].map((v) => Math.round(v)).join('*')}#${clean(text)}#${clean(text2)}#${clean(group)}*${a}*${b}`
}

// (sin objetos, solo la cabecera y el cierre)
export const pcsimuText = (objects) => `${PCSIMU_HEADER}${objects.map((o, n) => `${pcsimuRecord(n, o)}*`).join('*')}$$$`

// Lectura (la usan las pruebas y, más adelante, la importación). Lo que hay tras «$$$» es basura
// que PC_SIMU deja al guardar: se ignora.
const RECORD = /(\d+)\*(\d+)#([^*#]*)\*((?:-?\d+\*){17}-?\d+)#(.*?)#([^#]*)#([^*#]*)\*(-?\d+)\*(-?\d+)\*?/y
export function parsePcSimu(content) {
  const body = String(content).split('$$$')[0]
  if (!body.startsWith('PC_SIMU*')) throw new Error('No es un archivo de PC_SIMU')
  const objects = []
  RECORD.lastIndex = PCSIMU_HEADER.length
  while (RECORD.lastIndex < body.length) {
    const m = RECORD.exec(body)
    if (!m) throw new Error(`Objeto ${objects.length + 1} de PC_SIMU ilegible`)
    const numbers = m[4].split('*').map(Number)
    objects.push({ type: Number(m[2]), name: m[3], rect: numbers.slice(0, 4), fields: numbers.slice(4), text: m[5], text2: m[6], group: m[7], a: Number(m[8]), b: Number(m[9]) })
    if (body[RECORD.lastIndex] === '*') RECORD.lastIndex++
  }
  return objects
}

// Lo que PC_SIMU recibe: cada tipo de la planta, con el objeto de PC_SIMU. Los campos de cada objeto
// están en docs/formato-pcsimu.md (sacados de PC_SIMU.exe: lo que hace con ellos su cuadro de
// propiedades). row: fila del panel (arriba las salidas, luego los mandos y abajo los detectores).
const KINDS = {
  button: { pcsimu: 'button', area: 'I', row: 1 },
  emergency: { pcsimu: 'button', area: 'I', row: 1 },
  switch: { pcsimu: 'switch', area: 'I', row: 1 },
  lamp: { pcsimu: 'led', area: 'Q', row: 0 },
  limit: { pcsimu: 'limit', area: 'I', row: 2 },
  sensor: { pcsimu: 'detector', area: 'I', row: 2 },
  motor: { pcsimu: 'motor', area: 'Q', row: 0 },
  siren: { pcsimu: 'sound', area: 'Q', row: 0 },
  cylinder: { pcsimu: 'cylinder', area: 'Q', row: 0, variable: 'extend' },
}
export const PCSIMU_SETA = 12 // Pulsador: f15 = 12 es la seta de emergencia (redonda, f16 = 0)
// Detector: f12 = 0 inductivo, 1 capacitivo, 2 ultrasonido. El óptico y el de color del editor, como
// capacitivo (detecta cualquier pieza).
const DETECTION = { inductive: 0, capacitive: 1 }
// El semáforo, como baliza (rojo f5.f7, ámbar f6.f8, verde f14.f15) si tiene las tres luces; si no,
// un led por luz.
const LIGHTS = [['red', 'red'], ['amber', 'yellow'], ['green', 'green']]
// f4: 1 en las salidas (led, motor, sonido) y 0 en las entradas; en finales de carrera y detectores es
// además si está pulsado mientras se simula, así que en el archivo va a 0. La baliza lo deja a 0.
// area: 'I' en los que leen una entrada (no ocupan salidas).
const OBJECTS = {
  led: { type: 11, name: 'Led', size: [25, 25], fields: ({ byte, bit, color }) => [1, byte, 0, bit, 0, 0, 0, 0, 0, 0, 0, color, 0, 0] },
  button: { type: 2, name: 'Pulsador', area: 'I', size: [25, 25], fields: ({ byte, bit, nc, color }) => [0, byte, 0, bit, 0, nc, 0, 0, 0, 0, 0, color, 0, 0] },
  switch: { type: 1, name: 'Interruptor', area: 'I', size: [25, 25], fields: ({ byte, bit, nc }) => [0, byte, 0, bit, 0, nc, 0, 0, 0, 0, 0, 0, 0, 0] },
  // f14: lado por el que se acciona (2: desde arriba, vertical); f15 = 0: el dibujo «Final de carrera 1».
  limit: { type: 6, name: 'Final de carrera', area: 'I', size: [20, 40], fields: ({ byte, bit, nc, orientation = 2 }) => [0, byte, 0, bit, 0, nc, 0, 0, 0, 0, orientation, 0, 0, 0] },
  // f13: distancia de detección (10 por defecto en PC_SIMU); f14: hacia dónde mira (0 derecha); f15 = 1: «Detector 2».
  detector: { type: 7, name: 'Detector', area: 'I', size: [30, 20], fields: ({ byte, bit, nc, kind, range = 10, orientation = 0 }) => [0, byte, 0, bit, 0, nc, 0, 0, kind, range, orientation, 1, 0, 0] },
  // Giro a la derecha en f5.f7 y a la izquierda en f6.f8; f16: 1 solo derecha, 11 las dos. f13: frecuencia
  // máxima del variador (100, la de PC_SIMU); f17 = 0: 3000 rpm. PC_SIMU escribe la velocidad («3000 r.p.m.»)
  // justo debajo: el nombre va más abajo (labelGap) para no pisarla.
  motor: { type: 18, name: 'Motor', size: [35, 35], labelGap: 18, fields: ({ byte, bit, left }) => [1, byte, left?.byte ?? 0, bit, left?.bit ?? 0, 0, 0, 0, 0, 100, 0, 0, left ? 11 : 1, 0] },
  sound: { type: 15, name: 'Sonido', size: [35, 35], fields: ({ byte, bit }) => [1, byte, 0, bit, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  // Actuador neumático: expandir f5.f7 y contraer f6.f8 (f16: 1 solo expandir, 11 las dos); f4: 0
  // electroválvula monoestable (vuelve por muelle), 1 biestable; captador contraído f11.f13 (si f9 = 1) y
  // expandido f12.a (si f10 = 1); f14 orientación; f15: 11 gráfico 1 contraído, 21 expandido; f17 y el
  // primer número de «texto», velocidad de expandir y de contraer (de 0 a 100).
  cylinder: {
    type: 19,
    name: 'Actuador neumático',
    size: [60, 20],
    sizeVertical: [20, 60],
    fields: ({ byte, bit, retract, a0, a1, orientation, extended, speed }) => [
      retract ? 1 : 0, byte, retract?.byte ?? 0, bit, retract?.bit ?? 0,
      a0 ? 1 : 0, a1 ? 1 : 0, a0?.byte ?? 0, a1?.byte ?? 0, a0?.bit ?? 0,
      orientation, extended ? 21 : 11, retract ? 11 : 1, speed ?? CYLINDER_SPEED,
    ],
    text: ({ speed }) => `.${pad(speed ?? CYLINDER_SPEED)}.${pad(0)}.${pad(0)}.0.${pad(0)}.0.0`,
    a: ({ a1 }) => a1?.bit ?? 0,
  },
  // Cinta: mueve a la derecha con f5.f7 (si f16 = 1) y a la izquierda con f6.f8 (si f15 = 1); f17 velocidad
  // (f17 / 12 px por paso); f14 = 0: dibujo «Cinta (V1.0)», horizontal.
  conveyor: {
    type: 20,
    name: 'Cinta',
    fields: ({ byte, bit, left, speed }) => [0, byte ?? 0, left?.byte ?? 0, bit ?? 0, left?.bit ?? 0, 0, 0, 0, 0, 0, 0, left ? 1 : 0, byte === undefined ? 0 : 1, speed],
  },
  // Objeto (alimentador): suelta una pieza del tamaño de su rectángulo, pegada a él por el lado de f14
  // (3: por debajo), al activarse f5.f7 (f10 = 1; f4: 0 una entrada, 1 una salida) y otra cada f17 pasos
  // mientras siga activo; f9 = 1: suelta sin orden. f16: tipo de pieza (5 metálica, 6 plástica).
  feeder: {
    type: 25,
    name: 'Objeto',
    area: 'I',
    // Con orden, f17 muy alto: una sola pieza por activación (como el flanco del editor).
    fields: ({ trigger, area, auto, material }) => [area === 'Q' ? 1 : 0, trigger?.byte ?? 0, 0, trigger?.bit ?? 0, 0, auto ? 1 : 0, trigger ? 1 : 0, 0, 0, 0, 3, 0, material, trigger ? ONE_PIECE : FEED_PERIOD],
  },
  // Perfil de aluminio: f15 50 horizontal / 51 vertical (gris claro); f13 = 1 «detener objeto» (las piezas se
  // apoyan encima); f14 = 1 «destruir objeto» (las que lo tocan desaparecen: una recogida).
  profile: {
    type: 19,
    name: 'Perfil aluminio',
    area: 'I',
    fields: ({ vertical, support, destroy }) => [0, 0, 0, 0, 0, 0, 0, 0, 0, support ? 1 : 0, destroy ? 1 : 0, vertical ? 51 : 50, 0, 0],
    text: () => `.${pad(0)}.${pad(0)}.${pad(0)}.0.${pad(0)}.0.0`,
  },
  // Display: muestra en BCD 4 salidas seguidas a partir de f5.f7, una cifra por cada f11 (aquí, 1).
  digit: { type: 12, name: 'Display', fields: ({ byte, bit }) => [1, byte, 0, bit, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0] },
  // Visualizador del editor: cuatro displays de una cifra (las unidades, a la derecha), en las dos salidas de
  // byte que el .awl llena con el valor en BCD (withAuxOutputs).
  display: {
    name: 'Display',
    size: [4 * 30 + 3 * 4, 36],
    parts: ({ qb }, [x1, y1]) =>
      [[qb[1], 4], [qb[1], 0], [qb[0], 4], [qb[0], 0]].map(([byte, bit], i) => ({ object: 'digit', byte, bit, rect: [x1 + i * 34, y1, x1 + i * 34 + 30, y1 + 36] })),
  },
  // Potenciómetro: f5 n.º de la entrada analógica (AIW f5); f9 forma (1: lineal horizontal); f16 0 unipolar.
  pot: { type: 17, name: 'Potenciómetro', area: 'I', size: [40, 30], fields: ({ ai }) => [0, ai, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
  // Texto suelto (los rótulos de una planta de frente).
  caption: { type: 1008, name: '', area: 'I', fields: () => [], text: ({ caption }) => caption },
  // Válvula: abre con f5.f7; f10 caudal (lo que sube por paso el nivel, de 0 a 10000, del depósito en cuyo
  // borde de arriba apoya; o lo que baja el del depósito al que va pegada por debajo); f11 = 1: hay líquido
  // en su entrada; f16 = 1: vertical.
  valve: { type: 23, name: 'Válvula', size: [30, 30], fields: ({ byte, bit, rate = 10, liquid = true }) => [0, byte, 0, bit, 0, 0, rate, liquid ? 1 : 0, 0, 0, 0, 0, 1, 0] },
  // Depósito: captadores de nivel máximo f5.f7 (si f15 = 1), medio f6.f8 (si f17 = 1) y mínimo f10.f11 (si f9 =
  // 1); nivel analógico en la AIW f12 (si f4 = 1); f16 = 2: líquidos; f13 capacidad; a = 1: muestra el nivel;
  // b: el nivel (de 0 a 10000).
  tankBody: {
    type: 22,
    name: 'Depósito',
    fields: ({ max, mid, min, ai }) => [ai == null ? 0 : 1, max?.byte ?? 0, mid?.byte ?? 0, max?.bit ?? 0, mid?.bit ?? 0, min ? 1 : 0, min?.byte ?? 0, min?.bit ?? 0, ai ?? 0, 1000, 0, max ? 1 : 0, 2, mid ? 1 : 0],
    a: () => 1,
    b: ({ initial }) => Math.round(10000 * initial),
  },
  // El depósito del editor, con sus válvulas: las de llenado encima (apoyadas en su borde) y la de vaciado
  // pegada por debajo.
  tank: {
    name: 'Depósito',
    size: [90, 180],
    parts: (item, [x1, y1, x2, y2]) => [
      ...(item.fill ? [{ object: 'valve', ...item.fill, rate: item.fillRate, rect: [x1 + 10, y1, x1 + 40, y1 + 30] }] : []),
      ...(item.fine ? [{ object: 'valve', ...item.fine, rate: item.fineRate, rect: [x2 - 40, y1, x2 - 10, y1 + 30] }] : []),
      { ...item, object: 'tankBody', rect: [x1, y1 + 30, x2, y2 - 30] },
      ...(item.drain ? [{ object: 'valve', ...item.drain, rate: item.drainRate, liquid: false, rect: [x1 + 30, y2 - 30, x1 + 60, y2] }] : []),
    ],
  },
  // Puerta (tipo 21) con el dibujo «Barrera» (f12 = 6): abre con f5.f7 y cierra con f6.f8; final de carrera
  // «cerrada» en f14.f15 (si f10 = 1) y «abierta» en f16.f9 (si f11 = 1); f17 velocidad.
  door: {
    type: 21,
    name: 'Barrera',
    size: [100, 30],
    fields: ({ byte, bit, close, retract, opened, closed }) => {
      const shut = close ?? retract
      return [0, byte, shut?.byte ?? 0, bit, shut?.bit ?? 0, opened?.bit ?? 0, closed ? 1 : 0, opened ? 1 : 0, 6, 0, closed?.byte ?? 0, closed?.bit ?? 0, opened?.byte ?? 0, 50]
    },
  },
  // Tope (tipo 26): f14 0 horizontal (las piezas se apoyan), 1 / 2 inclinado 45° / 135°, 3 / 4 rampa por la
  // que bajan solas hacia la derecha / la izquierda; f15 = 1: destruye las piezas.
  ramp: { type: 26, name: 'Tope', area: 'I', fields: ({ slope }) => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, slope, 0, 0, 0] },
  beacon: { type: 29, name: 'Baliza', size: [50, 125], fields: ({ red, amber, green }) => [0, red.byte, amber.byte, red.bit, amber.bit, 0, 0, 0, 0, 0, green.byte, green.bit, 0, 0] },
}
const CYLINDER_SPEED = 50 // la de los ejemplos de PC_SIMU
const FEED_PERIOD = 40 // pasos entre pieza y pieza de un alimentador automático
const ONE_PIECE = 30000 // tantos pasos que, con orden, suelta una sola pieza aunque la orden dure
// Velocidades: se supone un paso de simulación de PC_SIMU cada 50 ms (con ella, la velocidad 50 de sus
// ejemplos saca un cilindro en 1 s, como el del editor por defecto).
// Cinta: f17 / 12 px por paso -> f17 = 0,6 · px/s. Cilindro: f17 / 10 de 110 por paso -> f17 = 55 / s.
const clampSpeed = (v) => Math.max(1, Math.min(100, Math.round(v)))
const conveyorSpeed = (e) => clampSpeed((0.6 * (Number(e.length) || 240)) / (Number(e.time) || 4))
const cylinderSpeed = (e) => clampSpeed(55 / (Number(e.time) || 1))
// Lo que va a escala en una planta vista de frente (scene.gravity, como PC_SIMU); lo del pupitre
// (place: 'desk'), al panel.
const MACHINE = new Set(['conveyor', 'feeder', 'sensor', 'limit', 'cylinder', 'platform', 'sink', 'barrier', 'ramp'])
// Rectángulo de PC_SIMU [x1, y1, x2, y2] de un rectángulo local del elemento del editor.
const placed = (e, x, y, w, h) => {
  const r = worldRect(e, x, y, w, h)
  return [r.x, r.y, r.x + r.w, r.y + r.h]
}
const pad = (n) => String(n).padStart(3, ' ')
// Giro del editor (grados, en sentido horario) -> orientación de PC_SIMU: 0 derecha, 1 izquierda, 2 arriba, 3 abajo.
const ORIENTATION = { 0: 0, 90: 3, 180: 1, 270: 2 }
// Final de carrera: lado por el que se acciona (el de arriba del editor, girado).
const LIMIT_SIDE = { 0: 2, 90: 0, 180: 3, 270: 1 }
const CELL = 80 // ancho mínimo de cada columna; más si el nombre debajo es más largo
const PER_ROW = 8
// Tamaño en el panel (el cilindro vertical, girado).
const sizeOf = (item) => (item.orientation >= 2 && OBJECTS[item.object].sizeVertical) || OBJECTS[item.object].size
const overlapsRect = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
const label = (text, cx, y) => ({ type: PCSIMU_TYPES.text, rect: [cx - 4 * text.length, y, cx + 4 * text.length, y + 17], text })

// project -> { text, bytes (Windows-1252), warnings, count }. Arriba las salidas, en medio los mandos y
// abajo los detectores, cada uno con el nombre de su variable debajo.
export function exportPcSimu(project, { reserved = [], addressOf } = {}) {
  const plc = project.plc ?? {}
  const elements = plc.scene?.elements ?? []
  const warnings = []
  const skipped = new Map()
  const rows = [[], [], []]
  const typeName = (e) => tr(SCENE_TYPES[e.type]?.label ?? e.type)
  // Una pata (variable) del elemento -> { byte, bit } si tiene una dirección de bit del área pedida.
  // Pulsadores solo de la planta (sueltan una pieza sin pasar por el autómata): en PC_SIMU el pulsador y el
  // alimentador se entienden por una entrada, así que se les da una libre (que el programa no lee).
  const plantOnly = {}
  const triggers = new Set(elements.filter((e) => e.type === 'feeder' && e.trigger?.trim()).map((e) => e.trigger.trim()))
  const usedI = new Set()
  for (const v of Object.values(plc.variables ?? {})) {
    const a = parseAddress(v?.address)
    if (a?.area === 'I' && a.index !== undefined) usedI.add(a.index)
  }
  let freeI = 0
  for (const e of elements) {
    const v = e.variable?.trim()
    if ((e.type === 'button' || e.type === 'switch') && triggers.has(v) && !parseAddress(plc.variables?.[v]?.address) && !(v in plantOnly)) {
      while (usedI.has(freeI)) freeI++
      usedI.add(freeI)
      plantOnly[v] = { byte: Math.floor(freeI / 8), bit: freeI % 8 }
      warnings.push(`${v}: no pasa por el autómata; en PC_SIMU el pulsador y el alimentador usan la entrada libre I${plantOnly[v].byte}.${plantOnly[v].bit}.`)
    }
  }
  // La dirección con la que la usa el programa del S7-200 (toS7200 cambia las que no existen en un S7-200,
  // como IW64 o M40.0): si se exporta junto a él, la suya (addressOf); si no, la de la tabla.
  const addr = (name) => {
    const raw = name ? plc.variables?.[name]?.address : ''
    return raw && addressOf ? addressOf({ kind: 'var', name }) : (raw ?? '')
  }
  const bitOf = (name, area) => {
    if (area === 'I' && plantOnly[name]) return plantOnly[name]
    const a = parseAddress(addr(name))
    return a && a.area === area && a.index !== undefined ? { byte: Math.floor(a.index / 8), bit: a.index % 8 } : null
  }
  const missing = (e, name, area) => warnings.push(`${name || typeName(e)}: sin una dirección ${area} de bit; no se exporta.`)
  // En la máquina (extra.rect: su sitio en la planta), o en su fila del panel.
  const machine = []
  const add = (e, object, area, row, name, extra = {}) => {
    const at = bitOf(name, area)
    if (!at) return missing(e, name, area)
    ;(extra.rect ? machine : rows[row]).push({ object, name, ...at, ...extra })
  }
  const front = Boolean(plc.scene?.gravity)
  const once = new Set() // avisos que van una sola vez
  const note = (w) => once.has(w) || (once.add(w), warnings.push(w))
  for (const e of elements) {
    const onMachine = front && e.place !== 'desk' && MACHINE.has(e.type)
    const rot = ((Number(e.rot) || 0) % 360 + 360) % 360
    if (onMachine && e.type === 'conveyor') {
      if (rot !== 0 && rot !== 180) {
        warnings.push(`${e.text?.trim() || typeName(e)}: en PC_SIMU las cintas van en horizontal; no se exporta.`)
        continue
      }
      // Girada 180°, la marcha la lleva a la izquierda.
      const [right, left] = rot === 180 ? [e.reverse, e.motor] : [e.motor, e.reverse]
      const r = right?.trim() ? bitOf(right.trim(), 'Q') : null
      const l = left?.trim() ? bitOf(left.trim(), 'Q') : null
      if (right?.trim() && !r) missing(e, right.trim(), 'Q')
      if (left?.trim() && !l) missing(e, left.trim(), 'Q')
      if (e.motor?.trim() && e.reverse?.trim()) note(`${e.text?.trim() || typeName(e)}: en PC_SIMU, con las dos salidas a la vez la cinta se para (en el editor, manda la marcha atrás).`)
      machine.push({ object: 'conveyor', name: e.text?.trim() || '', rect: placed(e, 0, -15, Number(e.length) || 240, 30), ...(r ?? {}), left: l, speed: conveyorSpeed(e) })
      continue
    }
    if (onMachine && e.type === 'feeder') {
      const [w, h] = PIECE_SIZES[e.sizes in PIECE_SIZES ? e.sizes : 'small']
      if (e.sizes === 'mixed' || e.material === 'mixed') note(`Alimentador: en PC_SIMU cada alimentador da piezas iguales (no alterna tamaños ni materiales).`)
      const t = e.trigger?.trim()
      const q = t ? bitOf(t, 'Q') : null
      const trigger = q ?? (t ? bitOf(t, 'I') : null)
      if (t && !trigger) missing(e, t, 'I o Q')
      // La pieza sale por debajo del alimentador, donde la deja el editor (se ajusta después del bucle).
      machine.push({ object: 'feeder', name: '', piece: { x: e.x, y: e.y - h / 2, w, h }, trigger, area: q ? 'Q' : 'I', auto: !t && e.auto !== false, material: e.material === 'metal' ? 5 : 6 })
      continue
    }
    if (onMachine && e.type === 'platform') {
      const vertical = rot === 90 || rot === 270
      if (vertical) note('PC_SIMU solo detiene las piezas por arriba: las paredes y topes verticales se ven, pero no las paran de lado.')
      machine.push({ object: 'profile', name: '', rect: placed(e, 0, 0, Number(e.length) || 160, 14), vertical, support: !vertical })
      continue
    }
    if (front && e.type === 'label' && e.text?.trim()) {
      const caption = clean(e.text.trim())
      machine.push({ object: 'caption', name: '', caption, rect: [e.x, e.y, e.x + 8 * caption.length, e.y + 17] })
      continue
    }
    if (onMachine && e.type === 'sink') {
      // Un perfil que hace desaparecer las piezas que caen en él.
      machine.push({ object: 'profile', name: '', rect: placed(e, -30, 24, 60, 6), destroy: true })
      continue
    }
    if (e.type === 'trafficlight') {
      const lights = LIGHTS.filter(([key]) => e[key]?.trim())
      const at = Object.fromEntries(lights.map(([key]) => [key, bitOf(e[key].trim(), 'Q')]))
      if (lights.length === 3 && Object.values(at).every(Boolean)) {
        const name = e.text?.trim() || e.red.trim()
        rows[0].push({ object: 'beacon', name, ...at.red, ...at })
        continue
      }
      if (!lights.length) warnings.push(`${typeName(e)}: sin salidas; no se exporta.`)
      for (const [key, color] of lights) add(e, 'led', 'Q', 0, e[key].trim(), { color: PCSIMU_COLORS[color] })
      continue
    }
    if (e.type === 'heater') {
      // PC_SIMU no simula temperaturas: la resistencia, como piloto rojo; la temperatura, con un potenciómetro
      // en su entrada analógica (se pone a mano) y el termostato, con un interruptor.
      const label = e.text?.trim() || typeName(e)
      if (e.heat?.trim()) add(e, 'led', 'Q', 0, e.heat.trim(), { color: PCSIMU_COLORS.red })
      const temp = e.temperature?.trim()
      if (temp) {
        const m = /^AIW(\d+)$/i.exec(String(addr(temp)).trim())
        if (m) rows[1].push({ object: 'pot', name: temp, ai: Number(m[1]), byte: 900 + Number(m[1]), bit: 0 })
        else warnings.push(`${temp}: sin una entrada analógica AIW; no se exporta.`)
      }
      if (e.thermostat?.trim()) add(e, 'switch', 'I', 1, e.thermostat.trim(), { nc: 0 })
      warnings.push(`${label}: PC_SIMU no simula la temperatura; se pone a mano con el potenciómetro${e.thermostat?.trim() ? ' y el termostato con su interruptor' : ''}.`)
      continue
    }
    if (e.type === 'barrier') {
      const leg = (key, area) => {
        const v = e[key]?.trim()
        if (!v) return null
        const at = bitOf(v, area)
        if (!at) missing(e, v, area)
        return at
      }
      const extra = { close: leg('close', 'Q'), opened: leg('opened', 'I'), closed: leg('closed', 'I'), spring: !e.close?.trim() }
      if (onMachine) {
        extra.rect = placed(e, 0, -22, Number(e.length) || 140, 22)
        note(`${e.text?.trim() || typeName(e)}: en PC_SIMU la barrera se abre y se cierra, pero no sostiene ni frena piezas.`)
      }
      add(e, 'door', 'Q', 0, e.open?.trim(), extra)
      continue
    }
    if (onMachine && e.type === 'ramp') {
      if (rot === 90 || rot === 270) {
        warnings.push(`${e.text?.trim() || typeName(e)}: en PC_SIMU las rampas bajan hacia un lado; una vertical no se exporta.`)
        continue
      }
      machine.push({ object: 'ramp', name: '', rect: placed(e, 0, -20, Number(e.length) || 120, 40), slope: rot === 180 ? 4 : 3 })
      continue
    }
    if (e.type === 'tank') {
      const leg = (key, area) => {
        const v = e[key]?.trim()
        if (!v) return null
        const at = bitOf(v, area)
        if (!at) missing(e, v, area)
        return at
      }
      const [fill, fine, drain] = ['fill', 'fillFine', 'drain'].map((k) => leg(k, 'Q'))
      const [high, low, empty] = ['high', 'low', 'empty'].map((k) => leg(k, 'I'))
      const level = e.level?.trim()
      const ai = level ? /^AIW(\d+)$/i.exec(addr(level)) : null
      if (level && !ai) warnings.push(`${level}: sin una entrada analógica AIW; el nivel analógico no pasa a PC_SIMU.`)
      // Caudal: lo que sube el nivel (de 10000) en cada paso de PC_SIMU, que por defecto es de 100 ms.
      const rate = (t) => Math.max(1, Math.round(1000 / (Number(t) || 10)))
      rows[0].push({
        object: 'tank',
        name: e.text?.trim() || typeName(e),
        byte: fill?.byte ?? 990,
        bit: fill?.bit ?? 0,
        fill,
        fine,
        drain,
        // Tres captadores en PC_SIMU (máximo, medio y mínimo): el alto, el bajo y el de vacío del editor.
        max: high,
        mid: empty ? low : null,
        min: empty ?? low,
        ai: ai ? Number(ai[1]) : null,
        initial: Math.max(0, Math.min(1, Number(e.initial) || 0)),
        fillRate: rate(e.fillTime),
        fineRate: Math.max(1, Math.round(rate(e.fillTime) / 5)),
        drainRate: rate(e.drainTime),
      })
      continue
    }
    if (e.type === 'valve') {
      const name = e.variable?.trim()
      add(e, 'valve', 'Q', 0, name, {})
      continue
    }
    if (e.type === 'display') {
      const name = e.variable?.trim()
      const word = String(addr(name)).trim().toUpperCase()
      if (!/^([CT]\d+|(V|M|I|Q|AI|AQ)W\d+)$/.test(word)) warnings.push(`${name || typeName(e)}: sin una palabra del S7-200 (C, T, VW, MW, AIW…); no se exporta.`)
      else {
        if (/^A?IW/.test(word)) warnings.push(`${name}: el display de PC_SIMU muestra la entrada analógica en bruto (sin pasar a unidades).`)
        rows[0].push({ object: 'display', name, word, byte: 999, bit: 0 })
      }
      continue
    }
    if (e.type === 'potentiometer') {
      const name = e.variable?.trim()
      const m = /^AIW(\d+)$/i.exec(String(addr(name)).trim())
      if (!m) warnings.push(`${name || typeName(e)}: sin una entrada analógica AIW; no se exporta.`)
      else rows[1].push({ object: 'pot', name, ai: Number(m[1]), byte: 900 + Number(m[1]), bit: 0 })
      continue
    }
    const kind = KINDS[e.type]
    if (!kind) {
      if (SCENE_TYPES[e.type]?.group !== 'Decoración') skipped.set(e.type, (skipped.get(e.type) ?? 0) + 1)
      continue
    }
    const name = e[kind.variable ?? 'variable']?.trim()
    const color = e.type === 'emergency' ? PCSIMU_SETA : (PCSIMU_COLORS[e.color] ?? (kind.pcsimu === 'led' ? PCSIMU_COLORS.green : PCSIMU_COLORS.black))
    const nc = e.type === 'emergency' || e.contact === 'NC' ? 1 : 0
    const extra = { color, nc, kind: DETECTION[e.kind] ?? DETECTION.capacitive }
    if (e.type === 'motor') {
      const reverse = e.reverse?.trim()
      if (reverse) {
        extra.left = bitOf(reverse, 'Q')
        if (!extra.left) missing(e, reverse, 'Q')
        else warnings.push(`${name || typeName(e)}: en PC_SIMU, ${reverse} es la salida de giro a la izquierda (en el editor invierte el giro de la marcha).`)
      }
      if (e.pulses?.trim()) warnings.push(`${name || typeName(e)}: el encoder (${e.pulses.trim()}) no pasa a PC_SIMU.`)
    }
    if (e.type === 'cylinder') {
      const leg = (key, area) => {
        const v = e[key]?.trim()
        if (!v) return null
        const at = bitOf(v, area)
        if (!at) missing(e, v, area)
        return at
      }
      Object.assign(extra, { retract: leg('retract', 'Q'), a0: leg('retracted', 'I'), a1: leg('extended', 'I') })
      extra.spring = !e.retract?.trim() // le falta la salida de recoger: se le da una (más abajo)
      extra.orientation = ORIENTATION[rot] ?? 0
      if (onMachine) {
        // PC_SIMU empuja (y sube, en vertical) las piezas con el gráfico 1, en el que el vástago sale 11/19 del
        // largo del cuerpo: el cuerpo, a la medida del recorrido, con la cara del vástago (recogido) donde el
        // editor tiene la placa, y tan ancho como ella (28 px) para alcanzar las mismas piezas.
        const W = Math.round(((Number(e.stroke) || 100) * 19) / 11)
        Object.assign(extra, { rect: placed(e, 88 - W, -14, W, 28), speed: cylinderSpeed(e) })
      }
      extra.extended = Number(e.initial) === 1
      const lost = ['position', 'vacuum', 'holding'].filter((k) => e[k]?.trim()).map((k) => e[k].trim())
      if (lost.length) warnings.push(`${name || typeName(e)}: ${lost.join(', ')} no pasa${lost.length > 1 ? 'n' : ''} a PC_SIMU (posición analógica y ventosa).`)
      if (e.mountedOn) warnings.push(`${name || typeName(e)}: en PC_SIMU no va montado sobre otro cilindro.`)
    }
    if (onMachine && e.type === 'sensor') Object.assign(extra, { rect: placed(e, -10, -5, 20, 10), orientation: ORIENTATION[rot] ?? 0, range: Math.round(Number(e.range) || 60) })
    // El rodillo del final de carrera, encima del anclaje (girado con el elemento).
    if (onMachine && e.type === 'limit') Object.assign(extra, { rect: placed(e, -6, -8, 12, 23), orientation: LIMIT_SIDE[rot] ?? 2 })
    add(e, kind.pcsimu, kind.area, kind.row, name, extra)
  }
  // Dónde aparece cada pieza. PC_SIMU da por vista una pieza en cuanto roza la franja de un detector (el
  // editor mira su centro): si al caer fuera a cruzar la de uno que mira de lado, aparece ya apoyada en la
  // superficie de debajo (si no, un detector de altura vería alta toda pieza que cae).
  const surfaces = machine.filter((m) => m.object === 'conveyor' || (m.object === 'profile' && m.support)).map((m) => m.rect)
  const sideZones = machine.filter((m) => m.object === 'detector' && m.orientation <= 1).map((m) => {
    const r = m.rect
    return m.orientation === 0 ? [r[2], r[1], r[2] + m.range, r[3]] : [r[0] - m.range, r[1], r[0], r[3]]
  })
  for (const m of machine.filter((m) => m.object === 'feeder')) {
    const { x, y, w, h } = m.piece
    const below = surfaces.filter((r) => r[0] < x + w / 2 && x - w / 2 < r[2] && r[1] >= y + h).map((r) => r[1])
    let top = y
    if (below.length) {
      const floor = Math.min(...below)
      if (sideZones.some((z) => overlapsRect(z, [x - w / 2, y, x + w / 2, floor]))) top = floor - h - 1
    }
    m.rect = [x - w / 2, top - h, x + w / 2, top]
  }
  // Salidas libres para lo que PC_SIMU necesita y el programa no tiene (withAuxOutputs las rellena en el .awl):
  // - un cilindro que empieza dentro solo vuelve con su salida «contraer» (y la de expandir a 0): no tiene
  //   vuelta por muelle; a los que no tienen A−, una salida que el .awl pone a NOT A+;
  // - un visualizador muestra salidas en BCD: dos bytes enteros con su valor.
  const aux = []
  const springs = [...rows[0], ...machine].filter((item) => item.spring)
  const displays = rows[0].filter((item) => item.object === 'display')
  if (springs.length || displays.length) {
    const used = new Set(reserved)
    for (const item of [...rows[0], ...machine]) if (item.byte !== undefined && item.object !== 'display' && OBJECTS[item.object].area !== 'I') used.add(`Q${item.byte}.${item.bit}`)
    for (const name of Object.keys(plc.variables ?? {})) {
      const a = parseAddress(addr(name))
      if (a?.area === 'Q' && a.index !== undefined) used.add(`Q${Math.floor(a.index / 8)}.${a.index % 8}`)
    }
    const freeByte = (b) => [0, 1, 2, 3, 4, 5, 6, 7].every((bit) => !used.has(`Q${b}.${bit}`))
    for (const item of displays) {
      let b = 0
      while (!freeByte(b) || !freeByte(b + 1)) b++
      for (const bb of [b, b + 1]) for (let bit = 0; bit < 8; bit++) used.add(`Q${bb}.${bit}`)
      item.qb = [b, b + 1]
      aux.push({ kind: 'display', word: item.word, qb: item.qb, name: item.name })
      warnings.push(`${item.name}: PC_SIMU lo muestra con displays en BCD; el .awl copia ${item.word} a QB${b} y QB${b + 1}.`)
    }
    let free = 0
    for (const item of springs) {
      while (used.has(`Q${Math.floor(free / 8)}.${free % 8}`)) free++
      item.retract = { byte: Math.floor(free / 8), bit: free % 8 }
      const to = `Q${item.retract.byte}.${item.retract.bit}`
      used.add(to)
      aux.push({ from: `Q${item.byte}.${item.bit}`, to, name: item.name })
      warnings.push(
        item.object === 'door'
          ? `${item.name}: cierra por su peso; PC_SIMU la cierra con su propia salida, así que el .awl pone ${to} = NOT Q${item.byte}.${item.bit}.`
          : `${item.name}: vuelve por muelle; PC_SIMU lo recoge con su propia salida, así que el .awl pone ${to} = NOT Q${item.byte}.${item.bit}.`,
      )
    }
  }
  const objects = []
  // La máquina, a escala y con su esquina de arriba a la izquierda en (40, 40); el panel, a su derecha.
  let panelX = 40
  if (machine.length) {
    const minX = Math.min(...machine.map((m) => m.rect[0]))
    const minY = Math.min(...machine.map((m) => m.rect[1]))
    const shift = (r) => [r[0] - minX + 40, r[1] - minY + 40, r[2] - minX + 40, r[3] - minY + 40]
    // Lo ocupado: los objetos y la franja que vigila cada detector (PC_SIMU la dibuja).
    const taken = machine.flatMap((m) => {
      const r = shift(m.rect)
      if (m.object !== 'detector' && m.object !== 'limit') return [r]
      const d = m.object === 'limit' ? 10 : m.range
      // (la de un detector vertical, PC_SIMU la dibuja hacia arriba y hacia abajo)
      const up = [r[0], r[1] - d, r[2], r[1]]
      const down = [r[0], r[3], r[2], r[3] + d]
      const zones = [[[r[2], r[1], r[2] + d, r[3]]], [[r[0] - d, r[1], r[0], r[3]]], [up, down], [up, down]][m.orientation ?? 0]
      return [r, ...zones]
    })
    for (const item of machine) {
      const { type, name, fields, text, a } = OBJECTS[item.object]
      const rect = shift(item.rect)
      objects.push({ type, name, rect, fields: fields(item), text: text?.(item) ?? '', a: a?.(item) ?? 0 })
      // Su nombre debajo, o encima, solo si no pisa nada.
      const cx = (rect[0] + rect[2]) / 2
      const spot = item.name && [label(item.name, cx, rect[3] + 4), label(item.name, cx, rect[1] - 21)].find((l) => !taken.some((r) => overlapsRect(r, l.rect)))
      if (spot) {
        objects.push(spot)
        taken.push(spot.rect)
      }
    }
    panelX = Math.max(...taken.map((r) => r[2])) + 80
  }
  let y = 40
  for (const row of rows) {
    if (!row.length) continue
    row.sort((p, q) => p.byte - q.byte || p.bit - q.bit)
    for (let start = 0; start < row.length; start += PER_ROW) {
      const line = row.slice(start, start + PER_ROW)
      const height = Math.max(...line.map((item) => sizeOf(item)[1]))
      let x = panelX
      for (const item of line) {
        const { labelGap = 0 } = OBJECTS[item.object]
        const size = sizeOf(item)
        const width = Math.max(CELL, 8 * item.name.length + 16, size[0] + 24)
        const cx = x + width / 2
        // Todos con la base a la misma altura, y el nombre debajo.
        const rect = [cx - size[0] / 2, y + height - size[1], cx + size[0] / 2, y + height]
        const parts = OBJECTS[item.object].parts?.(item, rect) ?? [{ ...item, rect }]
        for (const part of parts) {
          const o = OBJECTS[part.object]
          objects.push({ type: o.type, name: o.name, rect: part.rect, fields: o.fields(part), text: o.text?.(part) ?? '', a: o.a?.(part) ?? 0, b: o.b?.(part) ?? 0 })
        }
        objects.push(label(item.name, cx, y + height + 12 + labelGap))
        x += width
      }
      y += height + 60
    }
    y += 20
  }
  if (skipped.size) {
    const list = [...skipped].map(([type, n]) => `${tr(SCENE_TYPES[type]?.label ?? type)} (${n})`).join(', ')
    warnings.push(`Todavía no pasan a PC_SIMU: ${list}.`)
  }
  const text = pcsimuText(objects)
  return { text, bytes: encodeAnsi(text), warnings, aux, machine: machine.length > 0, count: objects.filter((o) => o.type !== PCSIMU_TYPES.text).length }
}

// Las salidas auxiliares de exportPcSimu, como redes al final del OB1 del programa del S7-200 (toS7200):
// «aux = NOT A+» (cilindros con vuelta por muelle) y el valor de un visualizador en BCD.
export function withAuxOutputs(awl, aux = []) {
  if (!aux.length) return awl
  const end = awl.indexOf('\r\nEND_ORGANIZATION_BLOCK')
  let n = Math.max(0, ...[...awl.slice(0, end).matchAll(/^Network (\d+)/gm)].map((m) => Number(m[1])))
  const nets = aux.map(({ kind, from, to, name, word, qb }) =>
    kind === 'display'
      ? // El valor en BCD (en VW990, fuera de lo que usa el programa): unidades y decenas en el primer byte.
        [`Network ${++n} // PC_SIMU: ${clean(name)} en los displays (QB${qb[0]}-QB${qb[1]}, BCD)`, 'LD     SM0.0', `MOVW   ${word}, VW990`, 'IBCD   VW990', `MOVB   VB991, QB${qb[0]}`, `MOVB   VB990, QB${qb[1]}`].join('\r\n')
      : [`Network ${++n} // PC_SIMU: ${to} recoge ${clean(name)} (vuelta por muelle)`, `LDN    ${from}`, `=      ${to}`].join('\r\n'),
  )
  return `${awl.slice(0, end)}\r\n${nets.join('\r\n')}${awl.slice(end)}`
}
