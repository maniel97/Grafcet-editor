// Esquema eléctrico (plc.electrical): catálogo de componentes, con sus bornes y su geometría.
// Símbolos según IEC 60617, identificación según IEC 81346 (-S1, -KM1, -Q1, -F2, -M1, -H1, -Y1)
// y numeración de bornes como en los aparatos reales (A1-A2, 13-14, 21-22, 95-96, 1-2…).
//
// plc.electrical = {
//   enabled: bool,          // simular con el esquema (si hay autómata, sus entradas y salidas
//                            // pasan por los cables)
//   components: [{ id, type, x, y, tag, ...propiedades }],
//   wires: [{ id, from: { c, t }, to: { c, t } }],   // c: componente, t: borne
// }
// Todo en una cuadrícula de 20 px; los aparatos se dibujan en vertical (la corriente baja).

export const GRID = 20

// Potenciales que dan los embarrados (y la fuente del autómata).
export const POTENTIALS = {
  'L+': { label: 'L+ (24 V)', kind: 'dc+' },
  M: { label: 'M (0 V)', kind: 'dc-' },
  L: { label: 'L (fase)', kind: 'phase' },
  N: { label: 'N (neutro)', kind: 'neutral' },
  L1: { label: 'L1', kind: 'phase' },
  L2: { label: 'L2', kind: 'phase' },
  L3: { label: 'L3', kind: 'phase' },
  PE: { label: 'PE (tierra)', kind: 'earth' },
}
// Secundario de un transformador: un potencial propio de cada transformador (sec:<id>:1 / :2).
export const isSecondary = (p) => typeof p === 'string' && p.startsWith('sec:')
// Embarrados de abajo (los cables salen hacia arriba).
export const LOWER_RAILS = new Set(['M', 'N', 'PE'])
export const railSide = (c) => (c.wires === 'down' ? 'bottom' : c.wires === 'up' ? 'top' : LOWER_RAILS.has(c.potential) ? 'top' : 'bottom')

const two = (top, bottom, h = 80) => [
  { id: top, x: 20, y: 0, side: 'top' },
  { id: bottom, x: 20, y: h, side: 'bottom' },
]
const twoPoles = (h = 80) => [
  { id: '1', x: 20, y: 0, side: 'top' },
  { id: '2', x: 20, y: h, side: 'bottom' },
  { id: '3', x: 60, y: 0, side: 'top' },
  { id: '4', x: 60, y: h, side: 'bottom' },
]
const threePoles = (h = 80) =>
  [0, 1, 2].flatMap((i) => [
    { id: String(2 * i + 1), x: 20 + 40 * i, y: 0, side: 'top' },
    { id: String(2 * i + 2), x: 20 + 40 * i, y: h, side: 'bottom' },
  ])

// Conexión neumática (se une con tubos, no con cables).
const pneu = (id, x, y, side) => ({ id, x, y, side, pneu: true })
// Válvulas: una casilla por posición (80 px), con el accionamiento a cada lado (40 px). Las
// conexiones se dibujan en la casilla de reposo: la de la derecha (o la central en las de 3
// posiciones); la de la izquierda es la del pilotaje 14.
export const VALVE_SIDE = 40
export const VALVE_SQUARE = 80
export const valveSquares = (c) => (c.ways === '5/3' ? 3 : 2)
export const restSquare = () => 1
export const isPneumatic = (type) => ELEC_TYPES[type]?.group === 'Neumática'
// Señales de los detectores de un cilindro (A: a0 dentro, a1 fuera).
export const cylinderSignals = (tag) => (tag ? [`${tag.toLowerCase()}0`, `${tag.toLowerCase()}1`] : [])

// Entradas y salidas del autómata (CPU S7-200 224 por defecto: 14 E / 10 S).
export function plcTerminals(c) {
  const ins = Math.max(1, Math.min(24, Number(c.inputs) || 14))
  const outs = Math.max(1, Math.min(16, Number(c.outputs) || 10))
  const ains = Math.max(0, Math.min(8, Number(c.analogIn) || 0))
  const aouts = Math.max(0, Math.min(4, Number(c.analogOut) || 0))
  const addr = (area, i) => `${area}${Math.floor(i / 8)}.${i % 8}`
  const top = [
    'L+',
    'M',
    '1M',
    ...Array.from({ length: ins }, (_, i) => addr('I', i)),
    ...(ains ? ['AM', ...(c.aiAddrs ?? Array.from({ length: ains }, (_, i) => `AIW${2 * i}`)).slice(0, ains)] : []),
  ]
  const aq = (c.aqAddrs ?? Array.from({ length: aouts }, (_, i) => `AQW${2 * i}`)).slice(0, aouts)
  const bottom = ['1L', ...Array.from({ length: outs }, (_, i) => addr('Q', i)), ...(aouts ? ['AQM', ...aq] : [])]
  return [
    ...top.map((id, i) => ({ id, x: 20 + 40 * i, y: 0, side: 'top' })),
    ...bottom.map((id, i) => ({ id, x: 20 + 40 * i, y: 120, side: 'bottom' })),
  ]
}

// Tipos: label, grupo de la paleta, prefijo del identificador, tamaño, bornes y propiedades.
export const ELEC_TYPES = {
  rail: {
    label: 'Embarrado',
    group: 'Alimentación',
    prefix: '',
    defaults: { potential: 'L', length: 400 },
    size: (c) => ({ w: Number(c.length) || 400, h: 20 }),
    terminals: (c) =>
      Array.from({ length: Math.floor((Number(c.length) || 400) / GRID) + 1 }, (_, i) => ({
        id: `t${i}`,
        x: i * GRID,
        y: 10,
        // wires: 'down' / 'up' fija hacia dónde salen los cables (N arriba, junto a L, va hacia abajo).
        side: railSide(c),
      })),
  },
  pushbutton: { label: 'Pulsador', group: 'Mando', prefix: 'S', defaults: { contact: 'NO', signal: '', text: '' }, size: () => ({ w: 40, h: 80 }), terminals: (c) => (c.contact === 'NC' ? two('11', '12') : two('13', '14')) },
  switch: { label: 'Interruptor / selector', group: 'Mando', prefix: 'S', defaults: { contact: 'NO', signal: '', text: '' }, size: () => ({ w: 40, h: 80 }), terminals: (c) => (c.contact === 'NC' ? two('11', '12') : two('13', '14')) },
  // Seta de emergencia (channels: 2, doble canal 11-12 y 21-22 para un relé de seguridad).
  emergency: {
    label: 'Seta de emergencia',
    group: 'Mando',
    prefix: 'S',
    defaults: { channels: 1, signal: '', text: 'Emergencia' },
    size: (c) => ({ w: Number(c.channels) === 2 ? 80 : 40, h: 80 }),
    terminals: (c) => (Number(c.channels) === 2 ? [...two('11', '12'), { id: '21', x: 60, y: 0, side: 'top' }, { id: '22', x: 60, y: 80, side: 'bottom' }] : two('11', '12')),
  },
  // kind: limit (final de carrera), float (flotador), pressure (presostato), thermostat (termostato).
  limit: { label: 'Final de carrera / detector', group: 'Mando', prefix: 'B', defaults: { kind: 'limit', contact: 'NO', signal: '', text: '' }, size: () => ({ w: 40, h: 80 }), terminals: (c) => (c.contact === 'NC' ? two('11', '12') : two('13', '14')) },
  // Conmutador de 3 posiciones (0-1-2): en 1 cierra 13-14; en 2, 23-24.
  selector3: {
    label: 'Conmutador 0-1-2',
    group: 'Mando',
    prefix: 'S',
    defaults: { text: '' },
    size: () => ({ w: 80, h: 80 }),
    terminals: () => [
      { id: '13', x: 20, y: 0, side: 'top' },
      { id: '14', x: 20, y: 80, side: 'bottom' },
      { id: '23', x: 60, y: 0, side: 'top' },
      { id: '24', x: 60, y: 80, side: 'bottom' },
    ],
  },
  // Detector de proximidad de 3 hilos: BN (+), BU (−) y BK (salida, PNP a + o NPN a −).
  sensor3: {
    label: 'Detector de 3 hilos (PNP/NPN)',
    group: 'Mando',
    prefix: 'B',
    defaults: { output: 'PNP', kind: 'inductive', signal: '', text: '' },
    size: () => ({ w: 80, h: 80 }),
    terminals: () => [
      { id: 'BN', x: 20, y: 0, side: 'top' },
      { id: 'BK', x: 40, y: 80, side: 'bottom' },
      { id: 'BU', x: 60, y: 0, side: 'top' },
    ],
  },
  counter: {
    label: 'Contador',
    group: 'Mando',
    prefix: 'KC',
    defaults: { preset: 3, text: '' },
    size: () => ({ w: 80, h: 80 }),
    terminals: () => [...two('A1', 'A2'), { id: 'R1', x: 60, y: 0, side: 'top' }, { id: 'R2', x: 60, y: 80, side: 'bottom' }],
  },
  // Pulsador luminoso: contacto 13-14 y piloto X1-X2 en el mismo aparato.
  litbutton: {
    label: 'Pulsador luminoso',
    group: 'Mando',
    prefix: 'S',
    defaults: { color: 'green', signal: '', light: '', text: '' },
    size: () => ({ w: 80, h: 80 }),
    terminals: () => [...two('13', '14'), { id: 'X1', x: 60, y: 0, side: 'top' }, { id: 'X2', x: 60, y: 80, side: 'bottom' }],
  },
  // Columna de señalización: rojo, ámbar, verde y zumbador con un común X0.
  beacon: {
    label: 'Columna de señalización',
    group: 'Mando',
    prefix: 'P',
    defaults: { red: '', amber: '', green: '', buzzer: '', text: '' },
    size: () => ({ w: 120, h: 120 }),
    terminals: () => [
      { id: 'X1', x: 20, y: 0, side: 'top' },
      { id: 'X2', x: 40, y: 0, side: 'top' },
      { id: 'X3', x: 60, y: 0, side: 'top' },
      { id: 'X4', x: 80, y: 0, side: 'top' },
      { id: 'X0', x: 100, y: 120, side: 'bottom' },
    ],
  },
  // Transmisores analógicos: 4-20 mA a 2 hilos (+ / −) o 0-10 V a 3 hilos (+, 0V, OUT).
  transmitter: {
    label: 'Transmisor analógico',
    group: 'Mando',
    prefix: 'B',
    defaults: { output: '4-20mA', signal: '', text: '' },
    size: () => ({ w: 80, h: 80 }),
    terminals: (c) =>
      c.output === '0-10V'
        ? [
            { id: '+', x: 20, y: 0, side: 'top' },
            { id: '0V', x: 60, y: 0, side: 'top' },
            { id: 'OUT', x: 40, y: 80, side: 'bottom' },
          ]
        : [
            { id: '+', x: 20, y: 0, side: 'top' },
            { id: '−', x: 40, y: 80, side: 'bottom' },
          ],
  },
  // Potenciómetro de consigna: su cursor W da de 0 a 10 V (con su referencia propia).
  potentiometer: { label: 'Potenciómetro de consigna', group: 'Mando', prefix: 'R', defaults: { initial: 0.5, text: '' }, size: () => ({ w: 80, h: 80 }), terminals: () => [{ id: 'W', x: 40, y: 80, side: 'bottom' }] },
  // Relé de seguridad: A1-A2 alimentación; canales S11-S12 y S21-S22; rearme S33-S34; salidas de
  // seguridad 13-14 y 23-24 (NA) y auxiliar 41-42 (NC).
  safetyrelay: {
    label: 'Relé de seguridad',
    group: 'Seguridad',
    prefix: 'KS',
    defaults: { text: '' },
    size: () => ({ w: 200, h: 120 }),
    terminals: () => [
      ...['A1', 'S11', 'S12', 'S21', 'S22', 'S33', 'S34', '13', '23', '41'].map((id, i) => ({ id, x: 20 * i + 10, y: 0, side: 'top' })),
      ...['A2', '14', '24', '42'].map((id, i) => ({ id, x: [10, 150, 170, 190][i], y: 120, side: 'bottom' })),
    ],
  },
  // Interruptor de puerta de seguridad (dos contactos NC, abiertos con la puerta abierta).
  doorswitch: { label: 'Interruptor de puerta', group: 'Seguridad', prefix: 'B', defaults: { signal: '', text: 'Resguardo' }, size: () => ({ w: 80, h: 80 }), terminals: () => [...two('11', '12'), { id: '21', x: 60, y: 0, side: 'top' }, { id: '22', x: 60, y: 80, side: 'bottom' }] },
  // Cortina fotoeléctrica: alimentación +24 / 0V; salidas OSSD1 y OSSD2 (a + mientras está libre).
  lightcurtain: {
    label: 'Cortina fotoeléctrica',
    group: 'Seguridad',
    prefix: 'B',
    defaults: { signal: '', text: '' },
    size: () => ({ w: 100, h: 100 }),
    terminals: () => [
      { id: '+24', x: 20, y: 0, side: 'top' },
      { id: '0V', x: 80, y: 0, side: 'top' },
      { id: 'OSSD1', x: 40, y: 100, side: 'bottom' },
      { id: 'OSSD2', x: 60, y: 100, side: 'bottom' },
    ],
  },
  buzzer: { label: 'Timbre / zumbador', group: 'Mando', prefix: 'H', defaults: { kind: 'bell', signal: '', text: '' }, size: () => ({ w: 40, h: 80 }), terminals: () => two('X1', 'X2') },
  contact: { label: 'Contacto auxiliar', group: 'Mando', prefix: '', defaults: { ref: 'KM1', contact: 'NO' }, size: () => ({ w: 40, h: 80 }), terminals: () => two('a', 'b') },
  coil: {
    label: 'Bobina (contactor, relé, temporizador)',
    group: 'Mando',
    prefix: 'KM',
    defaults: { kind: 'contactor', preset: 3, signal: '', text: '' },
    size: () => ({ w: 40, h: 80 }),
    terminals: () => two('A1', 'A2'),
  },
  valve: { label: 'Electroválvula', group: 'Mando', prefix: 'Y', defaults: { signal: '', text: '' }, size: () => ({ w: 40, h: 80 }), terminals: () => two('A1', 'A2') },
  lamp: { label: 'Piloto', group: 'Mando', prefix: 'H', defaults: { color: 'green', signal: '', text: '' }, size: () => ({ w: 40, h: 80 }), terminals: () => two('X1', 'X2') },
  // Fusible (con seccionador portafusibles: se abre a mano y, fundido, se repone).
  fuse: { label: 'Fusible / seccionador', group: 'Potencia', prefix: 'F', defaults: { poles: 1, text: '' }, size: (c) => ({ w: Number(c.poles) === 3 ? 120 : 40, h: 80 }), terminals: (c) => (Number(c.poles) === 3 ? threePoles() : two('1', '2')) },
  // Diferencial (fase y neutro): salta con una derivación a tierra o con su botón de prueba.
  rcd: { label: 'Diferencial', group: 'Potencia', prefix: 'Q', defaults: { text: '' }, size: () => ({ w: 80, h: 80 }), terminals: () => twoPoles() },
  // Interruptor general / seccionador de corte en carga (se maniobra a mano; con candado).
  mainswitch: { label: 'Interruptor general', group: 'Alimentación', prefix: 'Q', defaults: { text: 'Interruptor general' }, size: () => ({ w: 120, h: 80 }), terminals: () => threePoles() },
  // Fuente de alimentación 230 V~ -> 24 V DC: con tensión en L-N, da L+ y M.
  psu: {
    label: 'Fuente de alimentación 24 V DC',
    group: 'Alimentación',
    prefix: 'G',
    defaults: { text: '230 V~ / 24 V DC' },
    size: () => ({ w: 80, h: 100 }),
    terminals: () => [
      { id: 'L', x: 20, y: 0, side: 'top' },
      { id: 'N', x: 60, y: 0, side: 'top' },
      { id: 'L+', x: 20, y: 100, side: 'bottom' },
      { id: 'M', x: 60, y: 100, side: 'bottom' },
    ],
  },
  // Relé de control de fases: su contacto (por su identificador) cierra con las tres fases en orden.
  phasemonitor: {
    label: 'Relé de control de fases',
    group: 'Alimentación',
    prefix: 'KF',
    defaults: { text: '' },
    size: () => ({ w: 120, h: 80 }),
    terminals: () => ['L1', 'L2', 'L3'].map((id, i) => ({ id, x: 20 + 40 * i, y: 0, side: 'top' })),
  },
  // Transformador de mando: el secundario es un circuito aparte (S1-S2) mientras el primario
  // (P1-P2) tiene tensión.
  transformer: {
    label: 'Transformador de mando',
    group: 'Alimentación',
    prefix: 'T',
    defaults: { text: '230/24 V' },
    size: () => ({ w: 80, h: 100 }),
    terminals: () => [
      { id: 'P1', x: 20, y: 0, side: 'top' },
      { id: 'P2', x: 60, y: 0, side: 'top' },
      { id: 'S1', x: 20, y: 100, side: 'bottom' },
      { id: 'S2', x: 60, y: 100, side: 'bottom' },
    ],
  },
  breaker: { label: 'Magnetotérmico', group: 'Potencia', prefix: 'Q', defaults: { poles: 3, text: '' }, size: (c) => ({ w: Number(c.poles) === 1 ? 40 : 120, h: 80 }), terminals: (c) => (Number(c.poles) === 1 ? two('1', '2') : threePoles()) },
  motorprotector: { label: 'Guardamotor', group: 'Potencia', prefix: 'Q', defaults: { text: '' }, size: () => ({ w: 120, h: 80 }), terminals: () => threePoles() },
  thermal: { label: 'Relé térmico', group: 'Potencia', prefix: 'F', defaults: { text: '' }, size: () => ({ w: 120, h: 80 }), terminals: () => threePoles() },
  maincontacts: { label: 'Contactos principales', group: 'Potencia', prefix: '', defaults: { ref: 'KM1' }, size: () => ({ w: 120, h: 80 }), terminals: () => threePoles() },
  // Variador de frecuencia: L1-L3 entrada, U-V-W al motor; mando con su propio 24 V (+24 / GND):
  // DI1 marcha adelante, DI2 marcha atrás, DI3 segunda velocidad, AI1 consigna 0-10 V; relé de
  // marcha R1-R2 (cerrado con el motor en marcha).
  vfd: {
    label: 'Variador de frecuencia',
    group: 'Potencia',
    prefix: 'T',
    defaults: { speed2: 25, text: '' },
    size: () => ({ w: 240, h: 120 }),
    terminals: () => [
      ...['L1', 'L2', 'L3'].map((id, i) => ({ id, x: 20 + 40 * i, y: 0, side: 'top' })),
      ...['+24', 'DI1', 'DI2', 'DI3', 'AI1', 'GND'].map((id, i) => ({ id, x: 140 + 20 * i, y: 0, side: 'top' })),
      ...['U', 'V', 'W'].map((id, i) => ({ id, x: 20 + 40 * i, y: 120, side: 'bottom' })),
      { id: 'R1', x: 180, y: 120, side: 'bottom' },
      { id: 'R2', x: 220, y: 120, side: 'bottom' },
    ],
  },
  // Arrancador suave: L1-L3 a T1-T3 con rampa de arranque (A1-A2 mando); contacto de fin de rampa
  // por su identificador.
  softstarter: {
    label: 'Arrancador suave',
    group: 'Potencia',
    prefix: 'T',
    defaults: { ramp: 3, text: '' },
    size: () => ({ w: 200, h: 100 }),
    terminals: () => [
      ...['L1', 'L2', 'L3'].map((id, i) => ({ id, x: 20 + 40 * i, y: 0, side: 'top' })),
      { id: 'A1', x: 160, y: 0, side: 'top' },
      ...['T1', 'T2', 'T3'].map((id, i) => ({ id, x: 20 + 40 * i, y: 100, side: 'bottom' })),
      { id: 'A2', x: 160, y: 100, side: 'bottom' },
    ],
  },
  // Freno del motor (electrofreno): suelta con tensión; sin ella, frena.
  brake: { label: 'Freno del motor', group: 'Potencia', prefix: 'MB', defaults: { signal: '', text: 'Freno' }, size: () => ({ w: 40, h: 80 }), terminals: () => two('A1', 'A2') },
  motor3: {
    label: 'Motor trifásico',
    group: 'Potencia',
    prefix: 'M',
    defaults: { signal: '', reverse: '', text: '' },
    size: () => ({ w: 120, h: 100 }),
    terminals: () => ['U', 'V', 'W'].map((id, i) => ({ id, x: 20 + 40 * i, y: 0, side: 'top' })),
  },
  motor6: {
    label: 'Motor estrella-triángulo',
    group: 'Potencia',
    prefix: 'M',
    defaults: { signal: '', reverse: '', text: '' },
    size: () => ({ w: 120, h: 120 }),
    terminals: () => [
      ...['U1', 'V1', 'W1'].map((id, i) => ({ id, x: 20 + 40 * i, y: 0, side: 'top' })),
      ...['W2', 'U2', 'V2'].map((id, i) => ({ id, x: 20 + 40 * i, y: 120, side: 'bottom' })),
    ],
  },
  // Borna de una regleta (-X1:1, -X1:2…): une su borne de arriba con el de abajo. kind: 'pe' (tierra).
  terminal: {
    label: 'Borna',
    group: 'Bornas',
    prefix: 'X',
    defaults: { n: 1, kind: 'normal' },
    size: () => ({ w: 40, h: 40 }),
    terminals: () => [
      { id: '1', x: 20, y: 0, side: 'top' },
      { id: '2', x: 20, y: 40, side: 'bottom' },
    ],
  },
  // Instalaciones de interior.
  changeover: {
    label: 'Conmutador (vivienda)',
    group: 'Vivienda',
    prefix: 'S',
    defaults: { text: '' },
    size: () => ({ w: 80, h: 80 }),
    terminals: () => [
      { id: 'C', x: 40, y: 0, side: 'top' },
      { id: '1', x: 20, y: 80, side: 'bottom' },
      { id: '2', x: 60, y: 80, side: 'bottom' },
    ],
  },
  crossover: {
    label: 'Cruzamiento (vivienda)',
    group: 'Vivienda',
    prefix: 'S',
    defaults: { text: '' },
    size: () => ({ w: 80, h: 80 }),
    terminals: () => [
      { id: 'A1', x: 20, y: 0, side: 'top' },
      { id: 'A2', x: 60, y: 0, side: 'top' },
      { id: 'B1', x: 20, y: 80, side: 'bottom' },
      { id: 'B2', x: 60, y: 80, side: 'bottom' },
    ],
  },
  socket: {
    label: 'Base de enchufe',
    group: 'Vivienda',
    prefix: 'X',
    defaults: { text: '' },
    size: () => ({ w: 80, h: 60 }),
    terminals: () => [
      { id: 'L', x: 20, y: 0, side: 'top' },
      { id: 'N', x: 40, y: 0, side: 'top' },
      { id: 'PE', x: 60, y: 0, side: 'top' },
    ],
  },
  // Neumática (ISO 1219-1; conexiones ISO 5599: 1 presión, 2 y 4 utilización, 3 y 5 escape). Sus
  // conexiones (pneu) se unen con tubos, no con cables; identificación ISO 1219-2 (0P1, 0Z1, 1V1) y
  // cilindros con letra (A, B…: detectores a0 / a1) como en las secuencias A+ B+ A− B−.
  airsource: { label: 'Fuente de aire comprimido', group: 'Neumática', prefix: '0P', defaults: { text: '' }, size: () => ({ w: 40, h: 40 }), terminals: () => [pneu('1', 20, 0, 'top')] },
  frl: { label: 'Unidad de mantenimiento', group: 'Neumática', prefix: '0Z', defaults: { text: '' }, size: () => ({ w: 40, h: 80 }), terminals: () => [pneu('2', 20, 0, 'top'), pneu('1', 20, 80, 'bottom')] },
  pvalve: {
    label: 'Válvula distribuidora',
    group: 'Neumática',
    prefix: '1V',
    defaults: { ways: '5/2', sol14: '', sol12: '', manual: 'none', normally: 'NC', center: 'closed', text: '' },
    size: (c) => ({ w: VALVE_SIDE * 2 + VALVE_SQUARE * valveSquares(c), h: 80 }),
    terminals: (c) => {
      const x0 = VALVE_SIDE + VALVE_SQUARE * restSquare(c)
      return c.ways === '3/2'
        ? [pneu('2', x0 + 20, 0, 'top'), pneu('1', x0 + 20, 80, 'bottom'), pneu('3', x0 + 60, 80, 'bottom')]
        : [pneu('4', x0 + 20, 0, 'top'), pneu('2', x0 + 60, 0, 'top'), pneu('5', x0 + 20, 80, 'bottom'), pneu('1', x0 + 40, 80, 'bottom'), pneu('3', x0 + 60, 80, 'bottom')]
    },
  },
  pcylinder: {
    label: 'Cilindro neumático',
    group: 'Neumática',
    prefix: '',
    letterTag: true,
    defaults: { acting: 'double', time: 1, initial: 0, text: '' },
    size: () => ({ w: 160, h: 60 }),
    terminals: (c) => (c.acting === 'single' ? [pneu('A', 20, 60, 'bottom')] : [pneu('A', 20, 60, 'bottom'), pneu('B', 140, 60, 'bottom')]),
  },
  throttle: { label: 'Regulador de caudal', group: 'Neumática', prefix: '1V', defaults: { setting: 0.5, text: '' }, size: () => ({ w: 40, h: 80 }), terminals: () => [pneu('2', 20, 0, 'top'), pneu('1', 20, 80, 'bottom')] },
  plc: {
    label: 'Autómata (E/S)',
    group: 'Autómata',
    prefix: 'A',
    defaults: { inputs: 14, outputs: 10, text: '' },
    size: (c) => {
      const t = plcTerminals(c)
      return { w: Math.max(...t.map((x) => x.x)) + 20, h: 120 }
    },
    terminals: plcTerminals,
  },
}

export const elecType = (type) => ELEC_TYPES[type]
export const terminalsOf = (c) => ELEC_TYPES[c.type]?.terminals(c) ?? []
export const sizeOf = (c) => ELEC_TYPES[c.type]?.size(c) ?? { w: 40, h: 40 }

// Identificador IEC 81346 con su signo: -KM1.
export const showTag = (tag) => (tag ? `-${tag}` : '')

// Siguiente identificador libre con un prefijo: S1, S2… (los contactos auxiliares y los
// principales llevan el del aparato al que pertenecen).
export function nextTag(components, prefix) {
  if (!prefix) return ''
  const used = new Set(components.map((c) => c.tag))
  for (let i = 1; ; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`
}
// Siguiente letra libre (cilindros: A, B, C…).
export function nextLetterTag(components) {
  const used = new Set(components.map((c) => c.tag))
  for (let i = 0; i < 26; i++) if (!used.has(String.fromCharCode(65 + i))) return String.fromCharCode(65 + i)
  return nextTag(components, 'Z')
}
// Identificador nuevo para un componente de este tipo.
export const newTag = (components, type, prefix = ELEC_TYPES[type]?.prefix) => (ELEC_TYPES[type]?.letterTag ? nextLetterTag(components) : nextTag(components, prefix))

// Numeración de los contactos auxiliares de cada aparato (de izquierda a derecha, de arriba
// abajo): NA 13-14, 23-24…; NC 11-12, 21-22…; los del relé térmico, 95-96 (NC) y 97-98 (NA).
export function contactNumbers(components) {
  const byRef = new Map()
  const thermal = new Set(components.filter((c) => c.type === 'thermal').map((c) => c.tag))
  const list = components.filter((c) => c.type === 'contact').sort((a, b) => a.x - b.x || a.y - b.y)
  const out = {}
  for (const c of list) {
    if (thermal.has(c.ref)) {
      out[c.id] = c.contact === 'NC' ? ['95', '96'] : ['97', '98']
      continue
    }
    const n = (byRef.get(c.ref) ?? 0) + 1
    byRef.set(c.ref, n)
    out[c.id] = c.contact === 'NC' ? [`${n}1`, `${n}2`] : [`${n}3`, `${n}4`]
  }
  return out
}

// Referencias cruzadas de cada aparato: sus contactos (números) para escribirlos bajo la bobina.
export function crossReferences(components) {
  const numbers = contactNumbers(components)
  const refs = {}
  for (const c of components) {
    if (c.type === 'contact' && c.ref) (refs[c.ref] ??= []).push({ kind: c.contact === 'NC' ? 'NC' : 'NA', numbers: numbers[c.id] })
    if (c.type === 'maincontacts' && c.ref) (refs[c.ref] ??= []).push({ kind: 'principal', numbers: ['1', '6'] })
  }
  return refs
}

// Normaliza una dirección del proyecto a la de los bornes: %IX0.0 -> I0.0, %QX1.2 -> Q1.2; las
// analógicas, a AIW / AQW: IW64, PIW64 o %IW64 -> AIW64; QW80 -> AQW80.
export const terminalAddress = (address) =>
  String(address ?? '')
    .trim()
    .toUpperCase()
    .replace(/^%([IQ])X/, '$1')
    .replace(/^%?P?IW(\d+)$/, 'AIW$1')
    .replace(/^%?P?QW(\d+)$/, 'AQW$1')
