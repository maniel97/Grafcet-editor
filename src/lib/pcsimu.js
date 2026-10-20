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
import { analogConfig, isAnalog, rawRange, realLiteral } from './analog'
import { encodeAnsi } from './ladder/exportS7200'
import { SCENE_TYPES, PIECE_SIZES, sensorZone, worldRect } from './sim/scene'
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
    // Sin vástago (f15 = 18, gráfico 3 de carrera larga): el carro, de 0,2 del largo, empieza a 0,045 y corre
    // b·(0,2·largo/10)/9, con b de 0 a 350 (7/9 del largo).
    size: [60, 20],
    sizeVertical: [20, 60],
    fields: ({ byte, bit, retract, a0, a1, orientation, extended, speed, graphic2, rodless }) => [
      retract ? 1 : 0, byte, retract?.byte ?? 0, bit, retract?.bit ?? 0,
      a0 ? 1 : 0, a1 ? 1 : 0, a0?.byte ?? 0, a1?.byte ?? 0, a0?.bit ?? 0,
      orientation, (rodless ? 18 : graphic2 ? 13 : 11) + (extended ? 10 : 0), retract ? 11 : 1, speed ?? CYLINDER_SPEED,
    ],
    text: ({ speed }) => `.${pad(speed ?? CYLINDER_SPEED)}.${pad(0)}.${pad(0)}.0.${pad(0)}.0.0`,
    a: ({ a1 }) => a1?.bit ?? 0,
  },
  // Ventosa (tipo 19, f15 = 100): f4 = 0 monoestable, la activa f5.f7; f9 = 1 con vacuostato (entrada f11.f13);
  // f14 orientación (como la del cilindro). Va con el cilindro que la lleva por su grupo (ver «grupo»).
  suction: {
    type: 19,
    name: 'Ventosa',
    size: [20, 20],
    fields: ({ byte, bit, holding, orientation }) => [0, byte, 0, bit, 0, holding ? 1 : 0, 0, holding?.byte ?? 0, 0, holding?.bit ?? 0, orientation, 100, 1, CYLINDER_SPEED],
    text: () => `.${pad(CYLINDER_SPEED)}.${pad(0)}.${pad(0)}.0.${pad(0)}.0.0`,
  },
  // Actuador de giro (tipo 19, f15 = 210 giro corto, 230 largo; +10 empieza girado), con los campos del
  // cilindro. Lo de su grupo gira por arriba desde la izquierda, en (b − 175)°, b de 0 a 80 o 160, alrededor de
  // un pivote a R = (ancho / 2) · texto2 a la derecha de su sitio en el archivo (y alto/21 más abajo).
  rotary: {
    type: 19,
    name: 'Actuador de giro',
    size: [50, 50],
    fields: ({ byte, bit, retract, a0, a1, extended, long }) => [
      retract ? 1 : 0, byte, retract?.byte ?? 0, bit, retract?.bit ?? 0,
      a0 ? 1 : 0, a1 ? 1 : 0, a0?.byte ?? 0, a1?.byte ?? 0, a0?.bit ?? 0,
      0, (long ? 230 : 210) + (extended ? 10 : 0), retract ? 11 : 1, 20,
    ],
    text: () => `.${pad(30)}.${pad(0)}.${pad(0)}.0.${pad(0)}.0.0`,
    text2: ({ radius }) => (radius / 25).toFixed(6),
    a: ({ a1 }) => a1?.bit ?? 0,
  },
  // Pinza (tipo 19, f15 = 300): f4 = 0 monoestable, la cierra f5.f7; f10 = 1 con detector de pinza cerrada
  // (entrada f12.a); f9 el de abierta (f11.f13). Va con el cilindro que la lleva por su grupo, como la ventosa.
  gripper: {
    type: 19,
    name: 'Pinza',
    size: [20, 30],
    fields: ({ byte, bit, holding, orientation }) => [0, byte, 0, bit, 0, 0, holding ? 1 : 0, 0, holding?.byte ?? 0, 0, orientation, 300, 1, CYLINDER_SPEED],
    text: () => `.${pad(CYLINDER_SPEED)}.${pad(0)}.${pad(0)}.0.${pad(0)}.0.0`,
    a: ({ holding }) => holding?.bit ?? 0,
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
  // Válvula: abre con f5.f7; f10 caudal (lo que sube o baja por paso el nivel del depósito, en la escala de su
  // capacidad); f11 = 1: hay líquido en su entrada; f16 = 1: vertical. La de llenado llena el depósito en cuyo
  // borde de arriba apoya (dentro de su ancho, con 10 px de margen); la de vaciado va pegada por debajo.
  valve: { type: 23, name: 'Válvula', size: [40, 30], fields: ({ byte, bit, rate = 10, liquid = true }) => [0, byte, 0, bit, 0, 0, rate, liquid ? 1 : 0, 0, 0, 0, 0, 1, 0] },
  // Depósito: captadores de nivel máximo f5.f7 (si f15 = 1), medio f6.f8 (si f17 = 1) y mínimo f10.f11 (si f9 =
  // 1); nivel analógico en la AIW f12 (si f4 = 1); f16 = 2: líquidos; su capacidad, en el segundo texto; b: el
  // nivel (de 0 a la capacidad).
  tankBody: {
    type: 22,
    name: 'Depósito',
    fields: ({ max, mid, min, ai }) => [ai == null ? 0 : 1, max?.byte ?? 0, mid?.byte ?? 0, max?.bit ?? 0, mid?.bit ?? 0, min ? 1 : 0, min?.byte ?? 0, min?.bit ?? 0, ai ?? 0, 0, 0, max ? 1 : 0, 2, mid ? 1 : 0],
    text2: () => String(TANK_CAPACITY),
    b: ({ initial }) => Math.round(TANK_CAPACITY * initial),
  },
  // El depósito del editor, con sus válvulas: las de llenado encima, apoyadas en su borde, y la de vaciado
  // pegada por debajo, centradas.
  tank: {
    name: 'Depósito',
    size: [100, 190],
    parts: (item, [x1, y1, x2, y2]) => {
      const cx = (x1 + x2) / 2
      const top = y1 + 30
      const fills = [item.fill, item.fine].filter(Boolean)
      const at = fills.length === 2 ? [cx - 44, cx + 4] : [cx - 20]
      return [
        ...fills.map((v, i) => ({ object: 'valve', ...v, rate: v === item.fine ? item.fineRate : item.fillRate, rect: [at[i], y1, at[i] + 40, top] })),
        { ...item, object: 'tankBody', rect: [x1, top, x2, y2 - 30] },
        ...(item.drain ? [{ object: 'valve', ...item.drain, rate: item.drainRate, liquid: false, rect: [cx - 20, y2 - 30, cx + 20, y2] }] : []),
      ]
    },
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
  // Selector (tipo 3): f9 entradas seguidas desde f5.f7, una por posición (a 1 la de la posición en que está);
  // f16 = 0: dibujo «Conmutador 1».
  selector: { type: 3, name: 'Selector', area: 'I', size: [30, 30], fields: ({ byte, bit, n }) => [0, byte, 0, bit, 0, n, 0, 0, 0, 0, 0, 0, 0, 0] },
  // Ascensor (tipo 27), de 4 plantas (B, 1, 2, 3): sube f5.f7, baja f6.f8, abre la puerta f4.f14, la cierra
  // f12.f16; f17 velocidad (f17 / 10 por paso, al menos 1; las plantas, cada 240, con 10 de ventana para el
  // detector: a 10, 1 por paso, para que el autómata, que ve las entradas con retraso, la pare a tiempo). Las entradas, de 4 en 4 bits (byte y bit de cada una, hasta IB15): en f10, puerta
  // abierta, puerta cerrada, modo (1: un detector por planta; 0: uno solo en la cabina, que se enciende en todas),
  // detector en cabina y el byte de la planta B; en
  // f11, el bit de la B y las plantas 1, 2 y 3; en f9, las condiciones de seguridad (sin usar).
  elevator: {
    type: 27,
    name: 'Ascensor',
    size: [226, 610],
    fields: ({ byte, bit, down, open, close, floors, doorOpen, doorClosed }) => {
      const nib = (list) => list.reduce((v, x, i) => v + (x & 15) * 16 ** i, 0)
      const f10 = nib([doorOpen.byte, doorOpen.bit, doorClosed.byte, doorClosed.bit, 1, 0, 0, floors[0].byte])
      const f11 = nib([floors[0].bit, floors[1].byte, floors[1].bit, floors[2].byte, floors[2].bit, floors[3].byte, floors[3].bit, 0])
      return [open.byte, byte, down.byte, bit, down.bit, 0, f10, f11, close.byte, 0, open.bit, 0, close.bit, 10]
    },
  },
  // Teclado (tipo 4): f10 filas × f11 columnas de teclas, cada una una entrada, seguidas desde f5.f7 (f16 = 0).
  keypad: { type: 4, name: 'Teclado', area: 'I', size: [75, 100], fields: ({ byte, bit, rows, cols }) => [0, byte, 0, bit, 0, 0, rows, cols, 0, 0, 0, 0, 0, 0] },
  // Preselector (tipo 5): f11 cifras en BCD, cuatro entradas por cifra desde f5.f7 (de izquierda a derecha: la
  // de más peso primero).
  thumbwheel: { type: 5, name: 'Preselector', area: 'I', size: [60, 40], fields: ({ byte, digits }) => [0, byte, 0, 0, 0, 0, 1, digits, 0, 0, 0, 0, 0, 0] },
  // Potenciómetro numérico (tipo 17, f9 = 3): la entrada analógica AIW f5, de f7 a f4 en bruto, mostrada de f13 a f12.
  numeric: { type: 17, name: 'Potenciómetro', area: 'I', size: [60, 30], fields: ({ ai, r0, r1, min, max }) => [r1, ai, 0, r0, 0, 3, 0, 0, max, min, 0, 0, 0, 0] },
  // Barra (tipo 16): la salida analógica AQW f5, de f7 a f4 en bruto, mostrada de f13 a f12; f9: 0 vertical,
  // 1 horizontal; f16 = 0 unipolar.
  bar: {
    type: 16,
    name: 'Barra',
    size: [25, 80],
    sizeVertical: [25, 80],
    fields: ({ ao, r0, r1, min, max, vertical }) => [r1, ao, 0, r0, 0, vertical ? 0 : 1, 0, 0, max, min, 0, 0, 0, 0],
  },
  beacon: { type: 29, name: 'Baliza', size: [50, 125], fields: ({ red, amber, green }) => [0, red.byte, amber.byte, red.bit, amber.bit, 0, 0, 0, 0, 0, green.byte, green.bit, 0, 0] },
}
const CYLINDER_SPEED = 50 // la de los ejemplos de PC_SIMU
const TANK_CAPACITY = 1000 // la de los ejemplos de PC_SIMU
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
const rectOf = (r) => [r.x, r.y, r.x + r.w, r.y + r.h]
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
  const inverts = [] // entradas que el programa lee invertidas (el captador de vacío de un depósito)
  const thumbwheels = [] // preselectores sobre una palabra: en BCD, en bytes de entrada libres
  const rows1 = rows[1]
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
  const rotOf = (e) => ((Number(e.rot) || 0) % 360 + 360) % 360
  // Planta vista desde arriba: PC_SIMU la ve de frente. Pasan las cintas horizontales; lo que va sobre una
  // (el alimentador) y los detectores cuyo haz la cruza, proyectados (beltUnder).
  const belts = front ? [] : elements.filter((e) => e.type === 'conveyor' && e.place !== 'desk' && (rotOf(e) === 0 || rotOf(e) === 180)).map((e) => placed(e, 0, -15, Number(e.length) || 240, 30))
  const beltUnder = (r) => belts.find((b) => overlapsRect(b, r))
  // Cilindros que llevan algo (otro montado en su vástago, su ventosa): en PC_SIMU, con el gráfico 2.
  const carriers = new Set(elements.filter((e) => e.type === 'cylinder' && e.place !== 'desk').flatMap((e) => [e.mountedOn, e.vacuum?.trim() ? e.id : null]).filter(Boolean))
  for (let e of elements) {
    const rot = rotOf(e)
    if (!front && e.place !== 'desk' && (e.type === 'ramp' || e.type === 'diverter' || e.type === 'sink')) {
      if (e.type !== 'sink') note('Vista desde arriba: lo que aparta las piezas a un lado de la cinta (desviadores, rampas) no pasa a PC_SIMU, que la ve de frente; las piezas siguen por la cinta.')
      continue
    }
    let onMachine = e.place !== 'desk' && MACHINE.has(e.type)
    if (!front && onMachine) {
      if (e.type === 'conveyor') onMachine = rot === 0 || rot === 180
      else if (e.type === 'feeder') onMachine = Boolean(beltUnder([e.x - 1, e.y - 1, e.x + 1, e.y + 1]))
      else if (e.type === 'sensor') onMachine = (rot === 90 || rot === 270) && Boolean(beltUnder(rectOf(sensorZone(e))))
      else onMachine = false
    }
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
      // (desde arriba, la pieza está sobre la cinta: en PC_SIMU, apoyada en ella)
      const restOn = front ? null : beltUnder([e.x - 1, e.y - 1, e.x + 1, e.y + 1])[1]
      machine.push({ object: 'feeder', name: '', piece: { x: e.x, y: e.y - h / 2, w, h }, restOn, trigger, area: q ? 'Q' : 'I', auto: !t && e.auto !== false, material: e.material === 'metal' ? 5 : 6 })
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
      // Caudal: lo que sube el nivel (de la capacidad, 1000) en cada paso de PC_SIMU, que por defecto es de 100 ms.
      const rate = (t) => Math.max(1, Math.round((TANK_CAPACITY * 0.1) / (Number(t) || 10)))
      // El de vacío del editor vale 1 con el depósito vacío; el de mínimo de PC_SIMU, cuando el líquido lo cubre:
      // el programa lo lee invertido (withAuxOutputs).
      if (empty) {
        const mem = `V1012.${inverts.length}`
        inverts.push({ kind: 'invert', input: `I${empty.byte}.${empty.bit}`, mem, name: e.empty.trim() })
        warnings.push(`${e.empty.trim()}: el captador de mínimo de PC_SIMU se activa con líquido; el .awl lee I${empty.byte}.${empty.bit} invertida (en ${mem}).`)
      }
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
    if (e.type === 'selector') {
      const n = Math.min(4, Math.max(2, Math.round(Number(e.positions) || 3)))
      const vars = Array.from({ length: n }, (_, i) => e[`pos${i + 1}`]?.trim() || '')
      const at = vars.map((v) => (v ? bitOf(v, 'I') : null))
      vars.forEach((v, i) => v && !at[i] && missing(e, v, 'I'))
      // PC_SIMU: una entrada por posición, seguidas. Una posición sin entrada (el «0») vale si su bit está libre.
      const k = at.findIndex(Boolean)
      const base = k < 0 ? -1 : at[k].byte * 8 + at[k].bit - k
      const fits = base >= 0 && at.every((a, i) => (a ? a.byte * 8 + a.bit === base + i : !vars[i] && !usedI.has(base + i)))
      const title = e.text?.trim() || vars.filter(Boolean).join(' / ')
      if (fits) rows[1].push({ object: 'selector', name: title, byte: Math.floor(base / 8), bit: base % 8, n })
      else {
        if (k >= 0) warnings.push(`${title}: en PC_SIMU un selector usa entradas seguidas, una por posición; sale como interruptores sueltos.`)
        vars.forEach((v, i) => at[i] && rows[1].push({ object: 'switch', name: v, ...at[i], nc: 0 }))
      }
      continue
    }
    if (e.type === 'rotary') {
      const title = e.text?.trim() || e.turn?.trim() || typeName(e)
      if (e.place === 'desk' || !front || rotOf(e) !== 0) {
        warnings.push(`${title}: el actuador de giro pasa a PC_SIMU solo en la planta vista de frente y sin girar; no se exporta.`)
        continue
      }
      const bit = (key, area) => {
        const v = e[key]?.trim()
        if (!v) return null
        const at = bitOf(v, area)
        if (!at) missing(e, v, area)
        return at
      }
      const turn = bit('turn', 'Q')
      if (!turn) {
        if (!e.turn?.trim()) warnings.push(`${title}: sin su salida de girar; no se exporta.`)
        continue
      }
      const radius = Number(e.arm) || 80
      machine.push({ object: 'rotary', id: e.id, name: e.turn.trim(), ...turn, retract: bit('back', 'Q'), spring: !e.back?.trim(), a0: bit('start', 'I'), a1: bit('end', 'I'), extended: Number(e.initial) === 1, long: Boolean(e.long), radius, rect: [e.x - 25, e.y - 25, e.x + 25, e.y + 25] })
      const vacuum = e.vacuum?.trim()
      if (vacuum) {
        const at = bitOf(vacuum, 'Q')
        if (!at) missing(e, vacuum, 'Q')
        else {
          // La herramienta, donde la pone PC_SIMU a 180°: su esquina a R a la izquierda del pivote (y 50/21 arriba).
          const gripper = e.tool === 'gripper'
          const [tw, th] = gripper ? [20, 30] : [20, 20]
          const x0 = e.x - tw / 2 - radius
          const y0 = e.y - th / 2 - 2
          machine.push({ object: gripper ? 'gripper' : 'suction', name: vacuum, ...at, holding: bit('holding', 'I'), orientation: 3, rect: [x0, y0, x0 + tw, y0 + th], carrier: e.id })
        }
      }
      continue
    }
    if (e.type === 'elevator') {
      const title = e.text?.trim() || typeName(e)
      const out = (key) => (e[key]?.trim() ? bitOf(e[key].trim(), 'Q') : null)
      const inp = (key) => (e[key]?.trim() ? bitOf(e[key].trim(), 'I') : null)
      const [up, down, open, close] = ['up', 'down', 'open', 'close'].map(out)
      if (!up || !down) {
        warnings.push(`${title}: sin sus salidas de subir y bajar; no se exporta.`)
        continue
      }
      // PC_SIMU no deja una salida o una entrada sin poner: las que falten (y los detectores de las plantas
      // que no tiene el del editor), en entradas libres.
      const spare = () => {
        let i = 0
        while (usedI.has(i)) i++
        usedI.add(i)
        return { byte: Math.floor(i / 8), bit: i % 8 }
      }
      const floors = [0, 1, 2, 3].map((k) => inp(`f${k + 1}`) ?? spare())
      const doorOpen = inp('doorOpen') ?? spare()
      const doorClosed = inp('doorClosed') ?? spare()
      const all = [up, down, open, close, ...floors, doorOpen, doorClosed].filter(Boolean)
      if (all.some((a) => a.byte > 15)) {
        warnings.push(`${title}: el ascensor de PC_SIMU guarda sus direcciones en 4 bits (hasta el byte 15); no se exporta.`)
        continue
      }
      const zero = { byte: 0, bit: 0 }
      // Con la máquina (no en el panel: es tan alto que bajaría los mandos fuera de la pantalla, y PC_SIMU no
      // deja reducir la vista); el panel, a su derecha.
      const [w, h] = OBJECTS.elevator.size
      machine.push({ object: 'elevator', name: title, ...up, down, open: open ?? zero, close: close ?? zero, floors, doorOpen, doorClosed, rect: [e.x - w / 2, e.y - h / 2, e.x + w / 2, e.y + h / 2] })
      if (!open || !close) warnings.push(`${title}: sin salidas para la puerta, en PC_SIMU no se abre.`)
      if (Math.round(Number(e.floors) || 3) < 4) warnings.push(`${title}: el ascensor de PC_SIMU tiene 4 plantas (B, 1, 2 y 3); las que sobran, con detectores en entradas libres.`)
      continue
    }
    if (e.type === 'keypad') {
      const count = Math.min(12, Math.max(1, Math.round(Number(e.count) || 12)))
      const cols = Math.min(count, Math.max(1, Math.round(Number(e.columns) || 3)))
      const rows = Math.ceil(count / cols)
      const vars = Array.from({ length: count }, (_, i) => e[`k${i + 1}`]?.trim() || '')
      const at = vars.map((v) => (v ? bitOf(v, 'I') : null))
      vars.forEach((v, i) => v && !at[i] && missing(e, v, 'I'))
      // PC_SIMU: filas × columnas entradas seguidas; las teclas sin entrada (y las que faltan para completar la
      // última fila), en bits libres.
      const k = at.findIndex(Boolean)
      const base = k < 0 ? -1 : at[k].byte * 8 + at[k].bit - k
      const fits = base >= 0 && Array.from({ length: rows * cols }, (_, i) => (at[i] ? at[i].byte * 8 + at[i].bit === base + i : !vars[i] && !usedI.has(base + i))).every(Boolean)
      const title = e.text?.trim() || typeName(e)
      if (fits) rows1.push({ object: 'keypad', name: title, byte: Math.floor(base / 8), bit: base % 8, rows, cols })
      else {
        if (k >= 0) warnings.push(`${title}: en PC_SIMU un teclado usa entradas seguidas, una por tecla; sale como pulsadores sueltos.`)
        vars.forEach((v, i) => at[i] && rows1.push({ object: 'button', name: v, ...at[i], nc: 0, color: PCSIMU_COLORS.black }))
      }
      continue
    }
    if (e.type === 'preselector') {
      const name = e.variable?.trim()
      const word = String(addr(name)).trim().toUpperCase()
      const digits = Math.min(4, Math.max(1, Math.round(Number(e.digits) || 2)))
      const title = e.text?.trim() || name
      const ai = /^AIW(\d+)$/.exec(word)
      if (ai) {
        // Sobre una entrada analógica: el potenciómetro numérico de PC_SIMU, con su escala.
        const { signal, min, max } = analogConfig(plc.variables?.[name])
        const [r0, r1] = rawRange(signal, 's7200')
        rows1.push({ object: 'numeric', name: title, ai: Number(ai[1]), r0, r1, min: Math.round(min), max: Math.round(max), byte: 900 + Number(ai[1]), bit: 0 })
      } else if (/^([VM]W\d+|C\d+)$/.test(word)) {
        // Sobre una palabra: el preselector de PC_SIMU en BCD, en entradas libres que el .awl pasa a la palabra.
        thumbwheels.push({ object: 'thumbwheel', name: title, word, digits })
      } else warnings.push(`${name || typeName(e)}: sin una entrada analógica AIW ni una palabra VW / MW; no se exporta.`)
      continue
    }
    if (e.type === 'bargraph') {
      const name = e.variable?.trim()
      const word = String(addr(name)).trim().toUpperCase()
      const ao = /^AQW(\d+)$/.exec(word)
      const entry = plc.variables?.[name]
      if (ao && isAnalog(entry?.type)) {
        const { signal, min, max } = analogConfig(entry)
        const [r0, r1] = rawRange(signal, 's7200')
        rows[0].push({ object: 'bar', name: e.text?.trim() || name, ao: Number(ao[1]), r0, r1, min: Math.round(min), max: Math.round(max), vertical: e.vertical !== false, byte: 950, bit: 0 })
        continue
      }
      // PC_SIMU solo muestra en barra una salida analógica: lo demás, con displays (como un visualizador).
      if (name) warnings.push(`${name}: PC_SIMU solo muestra en barra una salida analógica (AQW); sale en displays.`)
      e = { ...e, type: 'display' }
    }
    if (e.type === 'display') {
      const name = e.variable?.trim()
      const word = String(addr(name)).trim().toUpperCase()
      const title = e.text?.trim() || name
      if (!/^([CT]\d+|(V|M|I|Q|AI|AQ)W\d+)$/.test(word)) warnings.push(`${name || typeName(e)}: sin una palabra del S7-200 (C, T, VW, MW, AIW…); no se exporta.`)
      else {
        // Una analógica, en sus unidades (de su valor en bruto, con su escala): (bruto − r0) · (máx − mín) / (r1 − r0) + mín.
        const entry = plc.variables?.[name]
        let scale = null
        if (isAnalog(entry?.type)) {
          const { signal, min, max } = analogConfig(entry)
          const [r0, r1] = rawRange(signal, 's7200')
          scale = { r0, rspan: r1 - r0, min: Math.round(min), span: Math.round(max - min) }
        }
        rows[0].push({ object: 'display', name: title, word, scale, byte: 999, bit: 0 })
      }
      continue
    }
    if (e.type === 'potentiometer') {
      const name = e.variable?.trim()
      const m = /^AIW(\d+)$/i.exec(String(addr(name)).trim())
      if (!m) warnings.push(`${name || typeName(e)}: sin una entrada analógica AIW; no se exporta.`)
      else rows[1].push({ object: 'pot', name: e.text?.trim() || name, ai: Number(m[1]), byte: 900 + Number(m[1]), bit: 0 })
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
        // PC_SIMU mide el paso con divisiones enteras: el recorrido (b hasta 350) va a saltos. Se elige el largo
        // que más se acerca a la carrera, y se avisa si aun así queda lejos.
        const stroke = Number(e.stroke) || 100
        const off = (travel) => Math.abs(travel - stroke) > 10 && warnings.push(`${name || typeName(e)}: en PC_SIMU recorre ${Math.round(travel)} px (en el editor, ${stroke}): solo puede hacerlo a saltos de ${e.rodless ? 39 : 8} px.`)
        if (e.rodless) {
          // Sin vástago (gráfico 3): carro de W·200/1000, que corre b·⌊carro/10⌋/9; con W = 50·u + 25, ⌊carro/10⌋ = u.
          // El carro del editor (de 60 a 88) a medio camino de los dos errores: el de dentro y el de fuera.
          const u = Math.max(1, Math.round((stroke * 9) / 350))
          const W3 = 50 * u + 25
          const travel = (350 * u) / 9
          off(travel)
          Object.assign(extra, { rect: placed(e, Math.round(74 + stroke / 2 - travel / 2 - 0.045 * W3 - (Math.floor(W3 / 5)) / 2), -14, W3, 28), rodless: true })
        } else if (carriers.has(e.id)) {
          // Solo los gráficos 2 y 3 llevan su grupo; en el 2 el vástago sale b·⌊W/20⌋/45 (b hasta 350), con la cara
          // a 0,745 del largo; con W = 20·u + 10, ⌊W/20⌋ = u.
          const u = Math.max(1, Math.round((stroke * 45) / 350))
          const W2 = 20 * u + 10
          off((350 * u) / 45)
          Object.assign(extra, { rect: placed(e, 88 - Math.round(W2 * 0.745), -14, W2, 28), graphic2: true })
        }
      }
      extra.extended = Number(e.initial) === 1
      if (onMachine) {
        // Lo que lleva encima (otro cilindro montado en su vástago, su ventosa) va con él en PC_SIMU por el
        // grupo: el actuador mueve los objetos que se llaman como su grupo (más abajo).
        extra.id = e.id
        if (e.mountedOn) extra.carrier = e.mountedOn
        const vacuum = e.vacuum?.trim()
        if (vacuum) {
          const at = bitOf(vacuum, 'Q')
          if (!at) missing(e, vacuum, 'Q')
          else machine.push({ object: e.tool === 'gripper' ? 'gripper' : 'suction', name: vacuum, ...at, holding: leg('holding', 'I'), orientation: extra.orientation, rect: e.tool === 'gripper' ? placed(e, 88, -15, 20, 30) : placed(e, 88, -10, 20, 20), carrier: e.id })
        }
      }
      const lost = (onMachine ? ['position'] : ['position', 'vacuum', 'holding']).filter((k) => e[k]?.trim()).map((k) => e[k].trim())
      if (lost.length) warnings.push(`${name || typeName(e)}: ${lost.join(', ')} no pasa${lost.length > 1 ? 'n' : ''} a PC_SIMU (posición analógica y ventosa).`)
      if (e.mountedOn && !onMachine) warnings.push(`${name || typeName(e)}: en PC_SIMU no va montado sobre otro cilindro.`)
    }
    if (onMachine && e.type === 'sensor') Object.assign(extra, { rect: placed(e, -10, -5, 20, 10), orientation: ORIENTATION[rot] ?? 0, range: Math.round(Number(e.range) || 60) })
    if (onMachine && e.type === 'sensor' && !front) {
      // Desde arriba, el haz cruza la cinta de lado: en PC_SIMU, el detector va encima, mirando hacia abajo, en
      // el mismo punto. Si el haz no llega al centro de la cinta (a t px de él), solo ve las piezas de más de
      // 2t: de frente, las de más de 2t de alto, así que su franja baja hasta 2t por encima de la cinta.
      const zone = rectOf(sensorZone(e))
      const belt = beltUnder(zone)
      const c = (belt[1] + belt[3]) / 2
      const t = zone[1] <= c && c <= zone[3] ? 0 : Math.min(Math.abs(zone[1] - c), Math.abs(zone[3] - c))
      const cx = (zone[0] + zone[2]) / 2
      Object.assign(extra, { rect: [cx - 5, belt[1] - 80, cx + 5, belt[1] - 60], orientation: 3, range: Math.max(1, Math.round(60 - 2 * t)) })
    }
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
    if (m.restOn != null) top = m.restOn - h - 1
    else if (below.length) {
      const floor = Math.min(...below)
      if (sideZones.some((z) => overlapsRect(z, [x - w / 2, y, x + w / 2, floor]))) top = floor - h - 1
    }
    m.rect = [x - w / 2, top - h, x + w / 2, top]
  }
  // Salidas libres para lo que PC_SIMU necesita y el programa no tiene (withAuxOutputs las rellena en el .awl):
  // - un cilindro que empieza dentro solo vuelve con su salida «contraer» (y la de expandir a 0): no tiene
  //   vuelta por muelle; a los que no tienen A−, una salida que el .awl pone a NOT A+;
  // - un visualizador muestra salidas en BCD: dos bytes enteros con su valor.
  // Preselectores sobre una palabra: uno o dos bytes de entrada enteros libres (las unidades en el primero).
  for (const item of thumbwheels) {
    const bytes = item.digits > 2 ? 2 : 1
    let b = 0
    const free = (byte) => [0, 1, 2, 3, 4, 5, 6, 7].every((bit) => !usedI.has(byte * 8 + bit))
    while (!free(b) || (bytes === 2 && !free(b + 1))) b++
    for (let i = 0; i < bytes * 8; i++) usedI.add(b * 8 + i)
    rows1.push({ ...item, byte: b, bit: 0 })
    inverts.push({ kind: 'bcdIn', bytes: bytes === 2 ? [b, b + 1] : [b], digits: item.digits, word: item.word, name: item.name })
    warnings.push(`${item.name}: PC_SIMU lo da en BCD en IB${b}${bytes === 2 ? ` e IB${b + 1}` : ''}; el .awl lo pasa a ${item.word}.`)
  }
  const aux = [...inverts]
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
      aux.push({ kind: 'display', word: item.word, qb: item.qb, name: item.name, scale: item.scale })
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
    // Grupos: PC_SIMU coloca lo de un grupo respecto a su sitio al empezar y al del que lo lleva, y solo en el
    // eje en que este se mueve, así que no encadena (lo que va en Z no sigue a la X que lleva a Z). Por eso
    // toda una cadena comparte un grupo: lo que va encima se llama como él, y cada cilindro que lleva algo lo
    // tiene de grupo (a sí mismo no se mueve).
    const byId = new Map(machine.filter((m) => m.object === 'cylinder' || m.object === 'rotary').map((m) => [m.id, m]))
    const rootOf = (item, depth = 0) => (item.carrier && byId.has(item.carrier) && depth < 8 ? rootOf(byId.get(item.carrier), depth + 1) : item.id)
    const chains = new Map()
    for (const c of byId.values()) if (machine.some((m) => m.carrier === c.id) && !chains.has(rootOf(c))) chains.set(rootOf(c), `Grupo_${chains.size + 1}`)
    const groupName = (item) => (item.carrier && byId.has(item.carrier) ? chains.get(rootOf(item)) : undefined)
    const groupOf = (item) => (item.id && machine.some((m) => m.carrier === item.id) ? chains.get(rootOf(item)) : undefined)
    for (const item of machine) {
      const { type, name, fields, text, text2, a } = OBJECTS[item.object]
      const rect = shift(item.rect)
      objects.push({ type, name: groupName(item) ?? name, rect, fields: fields(item), text: text?.(item) ?? '', text2: text2?.(item) ?? '', group: groupOf(item) ?? '', a: a?.(item) ?? 0 })
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
          objects.push({ type: o.type, name: o.name, rect: part.rect, fields: o.fields(part), text: o.text?.(part) ?? '', text2: o.text2?.(part) ?? '', a: o.a?.(part) ?? 0, b: o.b?.(part) ?? 0 })
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

// Lo que exportPcSimu necesita en el programa del S7-200 (toS7200), como redes del OB1: al final, «aux = NOT
// A+» (cilindros con vuelta por muelle) y el valor de un visualizador en BCD; al principio, las entradas que
// se leen invertidas y los preselectores en BCD.
export function withAuxOutputs(awl, aux = []) {
  if (!aux.length) return awl
  const end = awl.indexOf('\r\nEND_ORGANIZATION_BLOCK')
  let n = Math.max(0, ...[...awl.slice(0, end).matchAll(/^Network (\d+)/gm)].map((m) => Number(m[1])))
  const FIRST = ['invert', 'bcdIn'] // las que van al principio del OB1
  const nets = aux.filter((x) => !FIRST.includes(x.kind)).map(({ kind, from, to, name, word, qb, scale }) =>
    kind === 'display'
      ? // El valor en BCD (en VW1010, fuera de lo que usa el programa): unidades y decenas en el primer byte. Una
        // analógica, antes en sus unidades, con reales (como el resto del programa; el simulador S7_200 no hace
        // MUL / DIV como Micro/WIN): (bruto − r0) · (máx − mín) / (r1 − r0) + mín, redondeado.
        [
          `Network ${++n} // PC_SIMU: ${clean(name)} en los displays (QB${qb[0]}-QB${qb[1]}, BCD)`,
          'LD     SM0.0',
          ...(scale
            ? [
                `ITD    ${word}, VD1000`,
                'DTR    VD1000, VD1000',
                `-R     ${realLiteral(scale.r0)}, VD1000`,
                `*R     ${realLiteral(scale.span / scale.rspan)}, VD1000`,
                `+R     ${realLiteral(scale.min)}, VD1000`,
                'ROUND  VD1000, VD1000',
                'DTI    VD1000, VW1010',
              ]
            : [`MOVW   ${word}, VW1010`]),
          // Entre 0 y 9999 (IBCD no convierte otra cosa: saldrían cifras sin sentido).
          `Network ${++n} // (de 0 a 9999)`,
          'LDW<=  VW1010, -1',
          'MOVW   +0, VW1010',
          `Network ${++n}`,
          'LDW>=  VW1010, +10000',
          'MOVW   +9999, VW1010',
          `Network ${++n}`,
          'LD     SM0.0',
          'IBCD   VW1010',
          `MOVB   VB1011, QB${qb[0]}`,
          `MOVB   VB1010, QB${qb[1]}`,
        ].join('\r\n')
      : [`Network ${++n} // PC_SIMU: ${to} recoge ${clean(name)} (vuelta por muelle)`, `LDN    ${from}`, `=      ${to}`].join('\r\n'),
  )
  let text = `${awl.slice(0, end)}${nets.length ? `\r\n${nets.join('\r\n')}` : ''}${awl.slice(end)}`
  // Al principio del OB1 (las demás redes se renumeran):
  // - entradas que el programa lee invertidas: en el OB1 la entrada se cambia por una marca, que una red nueva
  //   pone a NOT entrada;
  // - preselectores en BCD: sus bytes de entrada, pasados a la palabra (las unidades en el primero; VW1016).
  const first = aux.filter((x) => FIRST.includes(x.kind))
  if (first.length) {
    const ob1End = text.indexOf('\r\nEND_ORGANIZATION_BLOCK')
    const begin = text.indexOf('BEGIN\r\n') + 'BEGIN\r\n'.length
    let body = text.slice(begin, ob1End)
    for (const { input, mem } of first.filter((x) => x.kind === 'invert')) {
      const re = new RegExp(`(?<![\w.])${input.replace('.', '\.')}(?![\w.])`, 'g')
      body = body.split('\r\n').map((line) => (line.startsWith('Network') || line.startsWith('//') ? line : line.replace(re, mem))).join('\r\n')
    }
    body = body.replace(/^Network (\d+)/gm, (_, k) => `Network ${Number(k) + first.length}`)
    const nets0 = first.map((x, i) =>
      x.kind === 'invert'
        ? [`Network ${i + 1} // PC_SIMU: ${clean(x.name)} (${x.input}) invertida en ${x.mem}`, `LDN    ${x.input}`, `=      ${x.mem}`].join('\r\n')
        : [
            `Network ${i + 1} // PC_SIMU: ${clean(x.name)} (preselector en BCD en IB${x.bytes.join(', IB')}) a ${x.word}`,
            'LD     SM0.0',
            // PC_SIMU da las cifras de izquierda a derecha, de 4 en 4 bits desde el bit 0 (la primera, la de
            // más peso, en el medio byte bajo): en cada byte se cambian los dos medios bytes y la palabra se
            // desplaza hasta que las unidades queden a la derecha. Con instrucciones de palabra (SLW, SRW, ANDW,
            // ORW), que tiene también la CPU 214 (RLB, girar un byte, solo las 22x).
            `MOVB   IB${x.bytes[0]}, VB1016`,
            x.bytes[1] === undefined ? 'MOVB   0, VB1017' : `MOVB   IB${x.bytes[1]}, VB1017`,
            'MOVW   VW1016, VW1018',
            'SLW    VW1016, 4',
            'ANDW   -3856, VW1016', // 16#F0F0
            'SRW    VW1018, 4',
            'ANDW   +3855, VW1018', // 16#0F0F
            'ORW    VW1018, VW1016',
            ...(x.digits < 4 ? [`SRW    VW1016, ${4 * (4 - x.digits)}`] : []),
            'BCDI   VW1016',
            `MOVW   VW1016, ${x.word}`,
          ].join('\r\n'),
    )
    text = `${text.slice(0, begin)}${nets0.join('\r\n')}\r\n${body}${text.slice(ob1End)}`
  }
  return text
}
