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

// Entradas y salidas del autómata (CPU S7-200 224 por defecto: 14 E / 10 S).
export function plcTerminals(c) {
  const ins = Math.max(1, Math.min(24, Number(c.inputs) || 14))
  const outs = Math.max(1, Math.min(16, Number(c.outputs) || 10))
  const addr = (area, i) => `${area}${Math.floor(i / 8)}.${i % 8}`
  const top = ['L+', 'M', '1M', ...Array.from({ length: ins }, (_, i) => addr('I', i))]
  const bottom = ['1L', ...Array.from({ length: outs }, (_, i) => addr('Q', i))]
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
        side: LOWER_RAILS.has(c.potential) ? 'top' : 'bottom',
      })),
  },
  pushbutton: { label: 'Pulsador', group: 'Mando', prefix: 'S', defaults: { contact: 'NO', signal: '', text: '' }, size: () => ({ w: 40, h: 80 }), terminals: (c) => (c.contact === 'NC' ? two('11', '12') : two('13', '14')) },
  switch: { label: 'Interruptor / selector', group: 'Mando', prefix: 'S', defaults: { contact: 'NO', signal: '', text: '' }, size: () => ({ w: 40, h: 80 }), terminals: (c) => (c.contact === 'NC' ? two('11', '12') : two('13', '14')) },
  emergency: { label: 'Seta de emergencia', group: 'Mando', prefix: 'S', defaults: { signal: '', text: 'Emergencia' }, size: () => ({ w: 40, h: 80 }), terminals: () => two('11', '12') },
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

// Normaliza una dirección del proyecto a la de los bornes: %IX0.0 -> I0.0, %QX1.2 -> Q1.2.
export const terminalAddress = (address) =>
  String(address ?? '')
    .trim()
    .toUpperCase()
    .replace(/^%([IQ])X/, '$1')
