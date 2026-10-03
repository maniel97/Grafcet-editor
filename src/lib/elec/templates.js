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
    description: 'KM1 gira a derechas y KM2 a izquierdas (cruza L1 y L3). Enclavamiento eléctrico (contactos 21-22) y mecánico: nunca entran a la vez.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      power(b, { second: true })
      b.add('M1', 'motor3', 0, 440, { tag: 'M1', text: 'Motor' })
      b.wire('F2', '2', 'M1', 'U')
      b.wire('F2', '4', 'M1', 'V')
      b.wire('F2', '6', 'M1', 'W')
      controlStart(b, 340, 620)
      const right = startStop(b, 340, 'S0', '12', 'S1', 'KM1', [['KM2i', 'KM2']])
      b.add('KM1', 'coil', 340, 500, { tag: 'KM1', kind: 'contactor', text: 'Derechas', interlock: 'KM2' })
      b.wire(...right, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(360, 320))
      const left = startStop(b, 640, 'S0', '12', 'S2', 'KM2', [['KM1i', 'KM1']])
      b.add('KM2', 'coil', 640, 500, { tag: 'KM2', kind: 'contactor', text: 'Izquierdas', interlock: 'KM1' })
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

// Instalaciones de interior: L y N arriba, PE abajo; el diferencial -Q1 y el magnetotérmico -Q2
// protegen el circuito (alimentación común de las plantillas de vivienda).
function dwelling(b, width = 520) {
  b.add('L', 'rail', 0, 0, { potential: 'L', length: width })
  b.add('N', 'rail', 0, 20, { potential: 'N', length: width })
  b.add('PE', 'rail', 0, 560, { potential: 'PE', length: width })
  b.add('Q1', 'rcd', 20, 60, { tag: 'Q1', text: 'Diferencial 30 mA' })
  b.wire('L', tap(40), 'Q1', '1')
  b.wire('N', tap(80), 'Q1', '3')
  b.add('Q2', 'breaker', 20, 180, { tag: 'Q2', poles: 1, text: 'PIA 10 A' })
  b.wire('Q1', '2', 'Q2', '1')
  // Fase protegida: Q2:2; neutro: Q1:4.
  return { phase: ['Q2', '2'], neutral: ['Q1', '4'] }
}
const lampTo = (b, name, x, y, neutral, tag = 'E1') => {
  b.add(name, 'lamp', x, y, { tag, color: 'amber', text: 'Punto de luz' })
  b.wire(name, 'X2', ...neutral)
  return [name, 'X1']
}

ELEC_TEMPLATES.push(
  {
    id: 'punto-luz',
    title: 'Punto de luz con interruptor',
    description: 'Vivienda: diferencial (Q1) y PIA (Q2), interruptor S1 y lámpara E1. Prueba el diferencial con su botón T.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b)
      b.add('S1', 'switch', 220, 300, { tag: 'S1', contact: 'NO', text: 'Interruptor' })
      b.wire(...phase, 'S1', '13')
      b.wire('S1', '14', ...lampTo(b, 'E1', 220, 420, neutral))
      return b
    },
  },
  {
    id: 'conmutada',
    title: 'Conmutada (dos puntos)',
    description: 'La lámpara se enciende y apaga desde dos sitios: dos conmutadores unidos por los dos hilos «viajeros».',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b)
      b.add('S1', 'changeover', 180, 300, { tag: 'S1', text: 'Conmutador 1' })
      b.add('S2', 'changeover', 340, 300, { tag: 'S2', text: 'Conmutador 2' })
      b.wire(...phase, 'S1', 'C')
      b.wire('S1', '1', 'S2', '1')
      b.wire('S1', '2', 'S2', '2')
      b.wire('S2', 'C', ...lampTo(b, 'E1', 480, 420, neutral))
      return b
    },
  },
  {
    id: 'cruzamiento',
    title: 'Cruzamiento (tres puntos)',
    description: 'Dos conmutadores en los extremos y un cruzamiento en medio: cualquiera de los tres cambia la lámpara.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b, 700)
      b.add('S1', 'changeover', 180, 300, { tag: 'S1', text: 'Conmutador 1' })
      b.add('S2', 'crossover', 340, 300, { tag: 'S2', text: 'Cruzamiento' })
      b.add('S3', 'changeover', 500, 300, { tag: 'S3', text: 'Conmutador 2' })
      b.wire(...phase, 'S1', 'C')
      b.wire('S1', '1', 'S2', 'A1')
      b.wire('S1', '2', 'S2', 'A2')
      b.wire('S2', 'B1', 'S3', '1')
      b.wire('S2', 'B2', 'S3', '2')
      b.wire('S3', 'C', ...lampTo(b, 'E1', 640, 420, neutral))
      return b
    },
  },
  {
    id: 'telerruptor',
    title: 'Telerruptor',
    description: 'Varios pulsadores en paralelo: cada pulsación del telerruptor KL1 cambia la lámpara.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b, 700)
      const buttons = ['S1', 'S2', 'S3']
      buttons.forEach((n, i) => {
        b.add(n, 'pushbutton', 180 + i * 120, 300, { tag: n, contact: 'NO', text: `Pulsador ${i + 1}` })
        b.wire(...phase, n, '13')
      })
      b.add('KL1', 'coil', 180, 420, { tag: 'KL1', kind: 'impulse', text: 'Telerruptor' })
      for (const n of buttons) b.wire(n, '14', 'KL1', 'A1')
      b.wire('KL1', 'A2', ...neutral)
      b.add('KL1c', 'contact', 560, 300, { ref: 'KL1', contact: 'NO' })
      b.wire(...phase, 'KL1c', 'a')
      b.wire('KL1c', 'b', ...lampTo(b, 'E1', 560, 420, neutral))
      return b
    },
  },
  {
    id: 'minutero',
    title: 'Minutero de escalera',
    description: 'Un pulsador cualquiera enciende la escalera; el minutero KT1 la apaga sola a los 30 s.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b, 700)
      for (const [i, n] of ['S1', 'S2'].entries()) {
        b.add(n, 'pushbutton', 180 + i * 120, 300, { tag: n, contact: 'NO', text: `Planta ${i + 1}` })
        b.wire(...phase, n, '13')
      }
      b.add('KT1', 'coil', 180, 420, { tag: 'KT1', kind: 'tof', preset: 30, text: 'Minutero' })
      b.wire('S1', '14', 'KT1', 'A1')
      b.wire('S2', '14', 'KT1', 'A1')
      b.wire('KT1', 'A2', ...neutral)
      b.add('KT1c', 'contact', 480, 300, { ref: 'KT1', contact: 'NO' })
      b.wire(...phase, 'KT1c', 'a')
      b.wire('KT1c', 'b', ...lampTo(b, 'E1', 480, 420, neutral))
      return b
    },
  },
  {
    id: 'mando-24v',
    title: 'Mando a 24 V~ con transformador',
    description: 'El transformador T1 (protegido con el fusible F1) da 24 V~ al mando: marcha-paro de KM1 a tensión de seguridad.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('L', 'rail', 0, 0, { potential: 'L', length: 300 })
      b.add('N', 'rail', 0, 20, { potential: 'N', length: 300 })
      b.add('F1', 'fuse', 20, 60, { tag: 'F1', poles: 1, text: 'Fusible 2 A' })
      b.wire('L', tap(40), 'F1', '1')
      b.add('T1', 'transformer', 20, 180, { tag: 'T1', text: '230/24 V' })
      b.wire('F1', '2', 'T1', 'P1')
      b.wire('N', tap(80), 'T1', 'P2')
      b.add('S0', 'pushbutton', 20, 320, { tag: 'S0', contact: 'NC', text: 'Paro' })
      b.wire('T1', 'S1', 'S0', '11')
      b.add('S1', 'pushbutton', 20, 420, { tag: 'S1', contact: 'NO', text: 'Marcha' })
      b.add('KM1h', 'contact', 160, 420, { ref: 'KM1', contact: 'NO' })
      b.wire('S0', '12', 'S1', '13')
      b.wire('S0', '12', 'KM1h', 'a')
      b.wire('KM1h', 'b', 'S1', '14')
      b.add('KM1', 'coil', 20, 540, { tag: 'KM1', kind: 'contactor', text: 'Contactor (24 V~)' })
      b.wire('S1', '14', 'KM1', 'A1')
      b.wire('KM1', 'A2', 'T1', 'S2')
      return b
    },
  },
)

// Industria: cabecera de máquina, seguridad, variador, arrancador suave y freno.
ELEC_TEMPLATES.push(
  {
    id: 'cabecera',
    title: 'Cabecera de máquina',
    description: 'Interruptor general -Q0, relé de control de fases -KF1 (piloto si las fases están bien) y fuente de 24 V DC -G1 para el mando.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      for (const [i, p] of ['L1', 'L2', 'L3', 'N'].entries()) b.add(p, 'rail', 0, i * 20, { potential: p, length: 520 })
      b.add('Q0', 'mainswitch', 20, 100, { tag: 'Q0', text: 'Interruptor general' })
      b.wire('L1', tap(40), 'Q0', '1')
      b.wire('L2', tap(80), 'Q0', '3')
      b.wire('L3', tap(120), 'Q0', '5')
      b.add('KF1', 'phasemonitor', 20, 240, { tag: 'KF1', text: 'Control de fases' })
      b.wire('Q0', '2', 'KF1', 'L1')
      b.wire('Q0', '4', 'KF1', 'L2')
      b.wire('Q0', '6', 'KF1', 'L3')
      b.add('G1', 'psu', 260, 240, { tag: 'G1' })
      b.wire('Q0', '2', 'G1', 'L')
      b.wire('N', tap(320), 'G1', 'N')
      b.add('KF1c', 'contact', 420, 360, { ref: 'KF1', contact: 'NO' })
      b.add('H1', 'lamp', 420, 480, { tag: 'H1', color: 'white', text: 'Tensión y fases correctas' })
      b.wire('G1', 'L+', 'KF1c', 'a')
      b.wire('KF1c', 'b', 'H1', 'X1')
      b.wire('H1', 'X2', 'G1', 'M')
      return b
    },
  },
  {
    id: 'seguridad',
    title: 'Parada de emergencia (categoría 3)',
    description: 'Seta y puerta de doble canal al relé de seguridad -KS1; rearme S2; dos contactores redundantes. Abrir un canal para; vuelve solo con el rearme.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('L+', 'rail', 0, 0, { potential: 'L+', length: 760 })
      b.add('M', 'rail', 0, 640, { potential: 'M', length: 760 })
      b.add('KS1', 'safetyrelay', 300, 380, { tag: 'KS1', text: 'Relé de seguridad' })
      b.wire('L+', tap(310), 'KS1', 'A1')
      b.wire('KS1', 'A2', 'M', tap(310))
      b.add('S1', 'emergency', 20, 60, { tag: 'S1', channels: 2, text: 'Seta de emergencia' })
      b.add('B1', 'doorswitch', 20, 200, { tag: 'B1', text: 'Puerta del resguardo' })
      b.wire('KS1', 'S11', 'S1', '11')
      b.wire('S1', '12', 'B1', '11')
      b.wire('B1', '12', 'KS1', 'S12')
      b.wire('KS1', 'S21', 'S1', '21')
      b.wire('S1', '22', 'B1', '21')
      b.wire('B1', '22', 'KS1', 'S22')
      b.add('S2', 'pushbutton', 160, 200, { tag: 'S2', contact: 'NO', text: 'Rearme' })
      b.wire('KS1', 'S33', 'S2', '13')
      b.wire('S2', '14', 'KS1', 'S34')
      b.add('KM1', 'coil', 560, 520, { tag: 'KM1', kind: 'contactor', text: 'Contactor 1' })
      b.add('KM2', 'coil', 640, 520, { tag: 'KM2', kind: 'contactor', text: 'Contactor 2' })
      b.wire('L+', tap(450), 'KS1', '13')
      b.wire('KS1', '14', 'KM1', 'A1')
      b.wire('KM1', 'A2', 'M', tap(580))
      b.wire('L+', tap(470), 'KS1', '23')
      b.wire('KS1', '24', 'KM2', 'A1')
      b.wire('KM2', 'A2', 'M', tap(660))
      b.add('H1', 'lamp', 720, 520, { tag: 'H1', color: 'red', text: 'Parada de emergencia' })
      b.wire('L+', tap(490), 'KS1', '41')
      b.wire('KS1', '42', 'H1', 'X1')
      b.wire('H1', 'X2', 'M', tap(740))
      return b
    },
  },
  {
    id: 'variador',
    title: 'Variador de frecuencia',
    description: 'Cinta con variador -T1: S1 adelante, S2 atrás, S3 segunda velocidad (25 Hz) y, con S4, consigna del potenciómetro -R1. La baliza se pone verde en marcha.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      for (const [i, p] of ['L1', 'L2', 'L3'].entries()) b.add(p, 'rail', 0, i * 20, { potential: p, length: 760 })
      b.add('Q1', 'motorprotector', 20, 100, { tag: 'Q1', text: 'Guardamotor' })
      b.wire('L1', tap(40), 'Q1', '1')
      b.wire('L2', tap(80), 'Q1', '3')
      b.wire('L3', tap(120), 'Q1', '5')
      b.add('T1', 'vfd', 20, 260, { tag: 'T1', speed2: 25, text: 'Variador' })
      b.wire('Q1', '2', 'T1', 'L1')
      b.wire('Q1', '4', 'T1', 'L2')
      b.wire('Q1', '6', 'T1', 'L3')
      b.add('M1', 'motor3', 20, 460, { tag: 'M1', text: 'Motor de la cinta' })
      b.wire('T1', 'U', 'M1', 'U')
      b.wire('T1', 'V', 'M1', 'V')
      b.wire('T1', 'W', 'M1', 'W')
      const switches = [
        ['S1', 'DI1', 'Adelante'],
        ['S2', 'DI2', 'Atrás'],
        ['S3', 'DI3', '2ª velocidad'],
      ]
      switches.forEach(([n, di, text], i) => {
        b.add(n, 'switch', 320 + i * 120, 100, { tag: n, contact: 'NO', text })
        b.wire('T1', '+24', n, '13')
        b.wire(n, '14', 'T1', di)
      })
      b.add('R1', 'potentiometer', 680, 60, { tag: 'R1', initial: 0.5, text: 'Consigna 0-10 V' })
      b.add('S4', 'switch', 680, 200, { tag: 'S4', contact: 'NO', text: 'Consigna externa' })
      b.wire('R1', 'W', 'S4', '13')
      b.wire('S4', '14', 'T1', 'AI1')
      b.add('P1', 'beacon', 360, 420, { tag: 'P1', text: 'Baliza' })
      b.wire('T1', 'R1', 'P1', 'X3')
      b.wire('T1', '+24', 'T1', 'R2')
      b.wire('P1', 'X0', 'T1', 'GND')
      return b
    },
  },
  {
    id: 'arrancador-suave',
    title: 'Arrancador suave',
    description: 'El arrancador -T1 sube la tensión del motor en una rampa (3 s): la cinta arranca sin tirones. S1 da la orden.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      for (const [i, p] of ['L1', 'L2', 'L3', 'N'].entries()) b.add(p, 'rail', 0, i * 20, { potential: p, length: 520 })
      b.add('Q1', 'breaker', 20, 120, { tag: 'Q1', poles: 3, text: 'Protección' })
      b.wire('L1', tap(40), 'Q1', '1')
      b.wire('L2', tap(80), 'Q1', '3')
      b.wire('L3', tap(120), 'Q1', '5')
      b.add('T1', 'softstarter', 20, 260, { tag: 'T1', ramp: 3, text: 'Arrancador suave' })
      b.wire('Q1', '2', 'T1', 'L1')
      b.wire('Q1', '4', 'T1', 'L2')
      b.wire('Q1', '6', 'T1', 'L3')
      b.add('M1', 'motor3', 20, 420, { tag: 'M1', text: 'Motor' })
      b.wire('T1', 'T1', 'M1', 'U')
      b.wire('T1', 'T2', 'M1', 'V')
      b.wire('T1', 'T3', 'M1', 'W')
      b.add('S1', 'switch', 160, 120, { tag: 'S1', contact: 'NO', text: 'Marcha' })
      b.wire('Q1', '2', 'S1', '13')
      b.wire('S1', '14', 'T1', 'A1')
      b.wire('T1', 'A2', 'N', tap(180))
      return b
    },
  },
  {
    id: 'freno',
    title: 'Motor con freno',
    description: 'El freno -MB1 va conectado a los bornes del motor: con KM1 dentro, se suelta; al parar, frena.',
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      power(b)
      b.add('M1', 'motor3', 0, 440, { tag: 'M1', text: 'Motor' })
      b.wire('F2', '2', 'M1', 'U')
      b.wire('F2', '4', 'M1', 'V')
      b.wire('F2', '6', 'M1', 'W')
      b.add('MB1', 'brake', 180, 440, { tag: 'MB1', text: 'Freno' })
      b.wire('F2', '2', 'MB1', 'A1')
      b.wire('F2', '4', 'MB1', 'A2')
      controlStart(b, 340, 620)
      const last = startStop(b, 340, 'S0', '12', 'S1', 'KM1')
      b.add('KM1', 'coil', 340, 480, { tag: 'KM1', kind: 'contactor', text: 'Motor' })
      b.wire(...last, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(360, 320))
      return b
    },
  },
)

// Inserta una plantilla debajo de lo que ya haya en la hoja (o en el origen). Sus identificadores
// que ya existan en el esquema (all: todos los componentes, de todas las hojas) pasan al siguiente
// libre (-KM1 -> -KM3…), y con ellos sus contactos, contactos principales y enclavamientos.
let inserted = 0 // para que dos inserciones seguidas no repitan identificadores internos
export function insertTemplate(template, existing = { components: [] }, all = existing.components ?? []) {
  const list = existing.components ?? []
  const oy = list.length ? Math.ceil((Math.max(...list.map((c) => c.y)) + 200) / GRID) * GRID : 0
  const b = template.build(40, oy + 40, `${template.id}-${Date.now().toString(36)}${(inserted++).toString(36)}`)
  const used = new Set(all.filter((c) => c.tag && c.type !== 'rail').map((c) => c.tag))
  const rename = new Map()
  for (const c of b.components) {
    if (!c.tag || c.type === 'rail' || rename.has(c.tag) || !used.has(c.tag)) continue
    const prefix = c.tag.replace(/\d+$/, '')
    let n = 1
    while (used.has(`${prefix}${n}`) || [...rename.values()].includes(`${prefix}${n}`)) n++
    rename.set(c.tag, `${prefix}${n}`)
  }
  for (const v of rename.values()) used.add(v)
  const fix = (t) => (t && rename.has(t) ? rename.get(t) : t)
  const components = b.components.map((c) => ({
    ...c,
    ...(c.tag ? { tag: fix(c.tag) } : {}),
    ...(c.ref ? { ref: fix(c.ref) } : {}),
    ...(c.interlock ? { interlock: fix(c.interlock) } : {}),
  }))
  return { components, wires: b.wires, renamed: Object.fromEntries(rename) }
}
