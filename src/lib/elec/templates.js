// Plantillas del esquema eléctrico: los montajes clásicos, listos para simular y modificar.
// Cada una devuelve { components, wires } colocados a partir de (ox, oy). Los identificadores son
// los de los planos de siempre (-Q1, -KM1, -F2, -S0, -S1, -M1…).
import { GRID } from './catalog'

// Constructor: añade componentes y cables con ids propios de esta inserción.
function builder(ox, oy, prefix) {
  const components = []
  const wires = []
  let n = 0
  const id = (name) => `${prefix}-${name}`
  return {
    components,
    wires,
    add(name, type, x, y, props = {}) {
      components.push({ id: id(name), type, x: ox + x, y: oy + y, ...props })
      return id(name)
    },
    wire(a, ta, b, tb) {
      wires.push({ id: `${prefix}-w${n++}`, from: { c: id(a), t: ta }, to: { c: id(b), t: tb } })
    },
  }
}
// Toma de un embarrado que empieza en x0 para un borne en x.
const tap = (x, x0 = 0) => `t${Math.round((x - x0) / GRID)}`

// Potencia: L1, L2, L3 -> Q1 -> contactores (los que se pidan) -> F2 -> motor.
function power(b, { second = false } = {}) {
  b.add('L1', 'rail', 0, 0, { potential: 'L1', length: 280 })
  b.add('L2', 'rail', 0, 20, { potential: 'L2', length: 280 })
  b.add('L3', 'rail', 0, 40, { potential: 'L3', length: 280 })
  b.add('Q1', 'breaker', 0, 80, { tag: 'Q1', poles: 3, text: 'Protección del motor' })
  b.wire('L1', tap(20), 'Q1', '1')
  b.wire('L2', tap(60), 'Q1', '3')
  b.wire('L3', tap(100), 'Q1', '5')
  b.add('KM1m', 'maincontacts', 0, 200, { ref: 'KM1' })
  for (const [a, t] of [
    ['2', '1'],
    ['4', '3'],
    ['6', '5'],
  ])
    b.wire('Q1', a, 'KM1m', t)
  b.add('F2', 'thermal', 0, 320, { tag: 'F2', text: 'Relé térmico' })
  for (const [a, t] of [
    ['2', '1'],
    ['4', '3'],
    ['6', '5'],
  ])
    b.wire('KM1m', a, 'F2', t)
  if (second) {
    // Inversión: KM2 cruza L1 y L3.
    b.add('KM2m', 'maincontacts', 160, 200, { ref: 'KM2' })
    for (const [a, t] of [
      ['2', '1'],
      ['4', '3'],
      ['6', '5'],
    ])
      b.wire('Q1', a, 'KM2m', t)
    b.wire('KM2m', '2', 'F2', '5')
    b.wire('KM2m', '4', 'F2', '3')
    b.wire('KM2m', '6', 'F2', '1')
  }
}

// Mando: L arriba (y = 0) y N abajo, desde x0; F2 (95-96) y S0 en serie al principio.
function controlStart(b, x0, bottom) {
  b.add('L', 'rail', x0 - 20, 0, { potential: 'L', length: 620 })
  b.add('N', 'rail', x0 - 20, bottom, { potential: 'N', length: 620 })
  b.add('F2c', 'contact', x0, 60, { ref: 'F2', contact: 'NC' })
  b.add('S0', 'pushbutton', x0, 160, { tag: 'S0', contact: 'NC', text: 'Paro' })
  b.wire('L', tap(x0 + 20, x0 - 20), 'F2c', 'a')
  b.wire('F2c', 'b', 'S0', '11')
}

// Marcha con autorretención en la columna x: S (NA) en paralelo con el 13-14 de la bobina.
function startStop(b, x, from, fromT, start, coil, extra = []) {
  b.add(start, 'pushbutton', x, 260, { tag: start, contact: 'NO', text: 'Marcha' })
  b.add(`${coil}h`, 'contact', x + 140, 260, { ref: coil, contact: 'NO' })
  b.wire(from, fromT, start, '13')
  b.wire(from, fromT, `${coil}h`, 'a')
  let last = [start, '14']
  b.wire(`${coil}h`, 'b', start, '14')
  for (const [name, ref] of extra) {
    b.add(name, 'contact', x, 380, { ref, contact: 'NC' })
    b.wire(...last, name, 'a')
    last = [name, 'b']
  }
  return last
}

export const ELEC_TEMPLATES = [
  {
    id: 'marcha-paro',
    title: 'Marcha-paro con autorretención',
    description: 'Mando: S1 arranca, el contacto 13-14 de KM1 lo mantiene y S0 para. Piloto H1 en marcha.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('L', 'rail', 0, 0, { potential: 'L', length: 340 })
      b.add('N', 'rail', 0, 600, { potential: 'N', length: 340 })
      b.add('S0', 'pushbutton', 20, 60, { tag: 'S0', contact: 'NC', text: 'Paro' })
      b.wire('L', tap(40), 'S0', '11')
      const last = startStop(b, 20, 'S0', '12', 'S1', 'KM1')
      b.add('KM1', 'coil', 20, 480, { tag: 'KM1', kind: 'contactor', text: 'Contactor' })
      b.wire(...last, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(40))
      b.add('KM1l', 'contact', 300, 260, { ref: 'KM1', contact: 'NO' })
      b.add('H1', 'lamp', 300, 480, { tag: 'H1', color: 'green', text: 'En marcha' })
      b.wire('L', tap(320), 'KM1l', 'a')
      b.wire('KM1l', 'b', 'H1', 'X1')
      b.wire('H1', 'X2', 'N', tap(320))
      return b
    },
  },
  {
    id: 'directo',
    title: 'Arranque directo de un motor',
    description: 'Potencia (Q1, KM1, F2, M1) y mando con autorretención; el relé térmico corta el mando.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      power(b)
      b.add('M1', 'motor3', 0, 440, { tag: 'M1', text: 'Motor' })
      b.wire('F2', '2', 'M1', 'U')
      b.wire('F2', '4', 'M1', 'V')
      b.wire('F2', '6', 'M1', 'W')
      controlStart(b, 340, 620)
      const last = startStop(b, 340, 'S0', '12', 'S1', 'KM1')
      b.add('KM1', 'coil', 340, 480, { tag: 'KM1', kind: 'contactor', text: 'Contactor del motor' })
      b.wire(...last, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(360, 320))
      return b
    },
  },
  {
    id: 'inversion',
    title: 'Inversión de giro con enclavamiento',
    description: 'KM1 gira a derechas y KM2 a izquierdas (cruza L1 y L3). Los contactos 21-22 impiden que entren a la vez.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      power(b, { second: true })
      b.add('M1', 'motor3', 0, 440, { tag: 'M1', text: 'Motor' })
      b.wire('F2', '2', 'M1', 'U')
      b.wire('F2', '4', 'M1', 'V')
      b.wire('F2', '6', 'M1', 'W')
      controlStart(b, 340, 620)
      const right = startStop(b, 340, 'S0', '12', 'S1', 'KM1', [['KM2i', 'KM2']])
      b.add('KM1', 'coil', 340, 500, { tag: 'KM1', kind: 'contactor', text: 'Derechas' })
      b.wire(...right, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(360, 320))
      const left = startStop(b, 640, 'S0', '12', 'S2', 'KM2', [['KM1i', 'KM1']])
      b.add('KM2', 'coil', 640, 500, { tag: 'KM2', kind: 'contactor', text: 'Izquierdas' })
      b.wire(...left, 'KM2', 'A1')
      b.wire('KM2', 'A2', 'N', tap(660, 320))
      return b
    },
  },
  {
    id: 'estrella-triangulo',
    title: 'Arranque estrella-triángulo',
    description: 'KM1 (línea) y KM3 (estrella) arrancan; a los 5 s, KT1 pasa a KM2 (triángulo). KM2 y KM3, enclavados.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      power(b)
      b.add('M1', 'motor6', 0, 460, { tag: 'M1', text: 'Motor' })
      b.wire('F2', '2', 'M1', 'U1')
      b.wire('F2', '4', 'M1', 'V1')
      b.wire('F2', '6', 'M1', 'W1')
      // Triángulo (KM2): W2, U2, V2 a L1, L2, L3. Estrella (KM3): une U2, V2 y W2.
      b.add('KM2m', 'maincontacts', 180, 440, { ref: 'KM2' })
      b.wire('F2', '2', 'KM2m', '1')
      b.wire('F2', '4', 'KM2m', '3')
      b.wire('F2', '6', 'KM2m', '5')
      b.wire('KM2m', '2', 'M1', 'W2')
      b.wire('KM2m', '4', 'M1', 'U2')
      b.wire('KM2m', '6', 'M1', 'V2')
      b.add('KM3m', 'maincontacts', 0, 640, { ref: 'KM3' })
      b.wire('M1', 'W2', 'KM3m', '1')
      b.wire('M1', 'U2', 'KM3m', '3')
      b.wire('M1', 'V2', 'KM3m', '5')
      b.wire('KM3m', '2', 'KM3m', '4')
      b.wire('KM3m', '4', 'KM3m', '6')
      controlStart(b, 360, 760)
      const last = startStop(b, 360, 'S0', '12', 'S1', 'KM1')
      b.add('KM1', 'coil', 360, 620, { tag: 'KM1', kind: 'contactor', text: 'Línea' })
      b.wire(...last, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(380, 340))
      // Con KM1: temporizador, estrella (hasta que salta KT1) y triángulo (después).
      b.add('KM1a', 'contact', 640, 260, { ref: 'KM1', contact: 'NO' })
      b.wire('S0', '12', 'KM1a', 'a')
      b.add('KT1', 'coil', 640, 620, { tag: 'KT1', kind: 'ton', preset: 5, text: 'Estrella → triángulo' })
      b.wire('KM1a', 'b', 'KT1', 'A1')
      b.wire('KT1', 'A2', 'N', tap(660, 340))
      b.add('KT1c', 'contact', 780, 380, { ref: 'KT1', contact: 'NC' })
      b.add('KM2i', 'contact', 780, 500, { ref: 'KM2', contact: 'NC' })
      b.add('KM3', 'coil', 780, 620, { tag: 'KM3', kind: 'contactor', text: 'Estrella' })
      b.wire('KM1a', 'b', 'KT1c', 'a')
      b.wire('KT1c', 'b', 'KM2i', 'a')
      b.wire('KM2i', 'b', 'KM3', 'A1')
      b.wire('KM3', 'A2', 'N', tap(800, 340))
      b.add('KT1o', 'contact', 920, 380, { ref: 'KT1', contact: 'NO' })
      b.add('KM3i', 'contact', 920, 500, { ref: 'KM3', contact: 'NC' })
      b.add('KM2', 'coil', 920, 620, { tag: 'KM2', kind: 'contactor', text: 'Triángulo' })
      b.wire('KM1a', 'b', 'KT1o', 'a')
      b.wire('KT1o', 'b', 'KM3i', 'a')
      b.wire('KM3i', 'b', 'KM2', 'A1')
      b.wire('KM2', 'A2', 'N', tap(940, 340))
      return b
    },
  },
]

// Inserta una plantilla debajo de lo que ya haya (o en el origen).
export function insertTemplate(template, existing = { components: [] }) {
  const list = existing.components ?? []
  const oy = list.length ? Math.ceil((Math.max(...list.map((c) => c.y)) + 200) / GRID) * GRID : 0
  const b = template.build(40, oy + 40, `${template.id}-${Date.now().toString(36)}`)
  return { components: b.components, wires: b.wires }
}
