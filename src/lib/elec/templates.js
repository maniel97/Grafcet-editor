// Plantillas del esquema eléctrico: los montajes clásicos, listos para simular y modificar.
// Cada una devuelve { components, wires } colocados a partir de (ox, oy). Los identificadores son
// los de los planos de siempre (-Q1, -KM1, -F2, -S0, -S1, -M1…).
import { ELEC_TYPES, GRID, cylinderSignals, nextLetterTag, terminalsOf } from './catalog'
import { pneumaticCircuit } from './pneumaticCircuit'
import { N_, t as tr } from '../i18n'

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
    // bend / bendX: altura del tramo horizontal (o posición del vertical) en coordenadas de la
    // plantilla; el cable la guarda medida desde su primer borne.
    wire(a, ta, b, tb, { bend, bendX } = {}) {
      const from = components.find((c) => c.id === id(a))
      const t = from && terminalsOf(from).find((x) => x.id === ta)
      const at = t ? { x: from.x + t.x, y: from.y + t.y } : { x: ox, y: oy }
      wires.push({
        id: `${prefix}-w${n++}`,
        from: { c: id(a), t: ta },
        to: { c: id(b), t: tb },
        ...(bend !== undefined ? { bend: oy + bend - at.y } : {}),
        ...(bendX !== undefined ? { bendX: ox + bendX - at.x } : {}),
      })
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
  b.add('Q1', 'breaker', 0, 80, { tag: 'Q1', poles: 3, text: tr('Protección del motor') })
  b.wire('L1', tap(20), 'Q1', '1')
  b.wire('L2', tap(60), 'Q1', '3')
  b.wire('L3', tap(100), 'Q1', '5')
  // Con inversión, más sitio entre aparatos: los cables de KM2 van a tres alturas distintas.
  const row = second ? 240 : 200
  b.add('KM1m', 'maincontacts', 0, row, { ref: 'KM1' })
  for (const [a, t] of [
    ['2', '1'],
    ['4', '3'],
    ['6', '5'],
  ])
    b.wire('Q1', a, 'KM1m', t)
  b.add('F2', 'thermal', 0, second ? 400 : 320, { tag: 'F2', text: tr('Relé térmico') })
  for (const [a, t] of [
    ['2', '1'],
    ['4', '3'],
    ['6', '5'],
  ])
    b.wire('KM1m', a, 'F2', t)
  if (second) {
    // Inversión: KM2 cruza L1 y L3.
    b.add('KM2m', 'maincontacts', 160, 240, { ref: 'KM2' })
    for (const [a, t, bend] of [
      ['2', '1', 190],
      ['4', '3', 210],
      ['6', '5', 230],
    ])
      b.wire('Q1', a, 'KM2m', t, { bend })
    b.wire('KM2m', '2', 'F2', '5', { bend: 340 })
    b.wire('KM2m', '4', 'F2', '3', { bend: 360 })
    b.wire('KM2m', '6', 'F2', '1', { bend: 380 })
  }
}

// Mando: L arriba (y = 0) y N abajo, desde x0; F2 (95-96) y S0 en serie al principio.
function controlStart(b, x0, bottom) {
  b.add('L', 'rail', x0 - 20, 0, { potential: 'L', length: 620 })
  b.add('N', 'rail', x0 - 20, bottom, { potential: 'N', length: 620 })
  b.add('F2c', 'contact', x0, 60, { ref: 'F2', contact: 'NC' })
  b.add('S0', 'pushbutton', x0, 140, { tag: 'S0', contact: 'NC', text: tr('Paro') })
  b.wire('L', tap(x0 + 20, x0 - 20), 'F2c', 'a')
  b.wire('F2c', 'b', 'S0', '11')
}

// Marcha con autorretención en la columna x: S (NA) en paralelo con el 13-14 de la bobina.
function startStop(b, x, from, fromT, start, coil, extra = []) {
  b.add(start, 'pushbutton', x, 260, { tag: start, contact: 'NO', text: tr('Marcha') })
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
    title: N_('Marcha-paro con autorretención'),
    description: N_('Mando: S1 arranca, el contacto 13-14 de KM1 lo mantiene y S0 para. Piloto H1 en marcha.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('L', 'rail', 0, 0, { potential: 'L', length: 340 })
      b.add('N', 'rail', 0, 600, { potential: 'N', length: 340 })
      b.add('S0', 'pushbutton', 20, 60, { tag: 'S0', contact: 'NC', text: tr('Paro') })
      b.wire('L', tap(40), 'S0', '11')
      const last = startStop(b, 20, 'S0', '12', 'S1', 'KM1')
      b.add('KM1', 'coil', 20, 480, { tag: 'KM1', kind: 'contactor', text: tr('Contactor') })
      b.wire(...last, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(40))
      b.add('KM1l', 'contact', 300, 260, { ref: 'KM1', contact: 'NO' })
      b.add('H1', 'lamp', 300, 480, { tag: 'H1', color: 'green', text: tr('En marcha') })
      b.wire('L', tap(320), 'KM1l', 'a')
      b.wire('KM1l', 'b', 'H1', 'X1')
      b.wire('H1', 'X2', 'N', tap(320))
      return b
    },
  },
  {
    id: 'directo',
    title: N_('Arranque directo de un motor'),
    description: N_('Potencia (Q1, KM1, F2, M1) y mando con autorretención; el relé térmico corta el mando.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      power(b)
      b.add('M1', 'motor3', 0, 440, { tag: 'M1', text: tr('Motor') })
      b.wire('F2', '2', 'M1', 'U')
      b.wire('F2', '4', 'M1', 'V')
      b.wire('F2', '6', 'M1', 'W')
      controlStart(b, 340, 620)
      const last = startStop(b, 340, 'S0', '12', 'S1', 'KM1')
      b.add('KM1', 'coil', 340, 480, { tag: 'KM1', kind: 'contactor', text: tr('Contactor del motor') })
      b.wire(...last, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(360, 320))
      return b
    },
  },
  {
    id: 'inversion',
    title: N_('Inversión de giro con enclavamiento'),
    description: N_('KM1 gira a derechas y KM2 a izquierdas (cruza L1 y L3). Enclavamiento eléctrico (contactos 21-22) y mecánico: nunca entran a la vez.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      power(b, { second: true })
      b.add('M1', 'motor3', 0, 520, { tag: 'M1', text: tr('Motor') })
      b.wire('F2', '2', 'M1', 'U')
      b.wire('F2', '4', 'M1', 'V')
      b.wire('F2', '6', 'M1', 'W')
      controlStart(b, 340, 620)
      const right = startStop(b, 340, 'S0', '12', 'S1', 'KM1', [['KM2i', 'KM2']])
      b.add('KM1', 'coil', 340, 500, { tag: 'KM1', kind: 'contactor', text: tr('Derechas'), interlock: 'KM2' })
      b.wire(...right, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(360, 320))
      const left = startStop(b, 640, 'S0', '12', 'S2', 'KM2', [['KM1i', 'KM1']])
      b.add('KM2', 'coil', 640, 500, { tag: 'KM2', kind: 'contactor', text: tr('Izquierdas'), interlock: 'KM1' })
      b.wire(...left, 'KM2', 'A1')
      b.wire('KM2', 'A2', 'N', tap(660, 320))
      return b
    },
  },
  {
    id: 'estrella-triangulo',
    title: N_('Arranque estrella-triángulo'),
    description: N_('KM1 (línea) y KM3 (estrella) arrancan; a los 5 s, KT1 pasa a KM2 (triángulo). KM2 y KM3, enclavados.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      power(b)
      b.add('M1', 'motor6', 0, 460, { tag: 'M1', text: tr('Motor') })
      b.wire('F2', '2', 'M1', 'U1')
      b.wire('F2', '4', 'M1', 'V1')
      b.wire('F2', '6', 'M1', 'W1')
      // Triángulo (KM2): W2, U2, V2 a L1, L2, L3. Estrella (KM3): une U2, V2 y W2.
      // Cada fase a su altura (sin cables montados unos sobre otros).
      b.add('KM2m', 'maincontacts', 180, 460, { ref: 'KM2' })
      b.wire('F2', '2', 'KM2m', '1', { bend: 410 })
      b.wire('F2', '4', 'KM2m', '3', { bend: 430 })
      b.wire('F2', '6', 'KM2m', '5', { bend: 450 })
      b.wire('KM2m', '2', 'M1', 'W2', { bend: 600 })
      b.wire('KM2m', '4', 'M1', 'U2', { bend: 620 })
      b.wire('KM2m', '6', 'M1', 'V2', { bend: 640 })
      b.add('KM3m', 'maincontacts', 0, 680, { ref: 'KM3' })
      b.wire('M1', 'W2', 'KM3m', '1')
      b.wire('M1', 'U2', 'KM3m', '3')
      b.wire('M1', 'V2', 'KM3m', '5')
      b.wire('KM3m', '2', 'KM3m', '4')
      b.wire('KM3m', '4', 'KM3m', '6')
      controlStart(b, 360, 760)
      const last = startStop(b, 360, 'S0', '12', 'S1', 'KM1')
      b.add('KM1', 'coil', 360, 620, { tag: 'KM1', kind: 'contactor', text: tr('Línea') })
      b.wire(...last, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(380, 340))
      // Con KM1: temporizador, estrella (hasta que salta KT1) y triángulo (después).
      b.add('KM1a', 'contact', 640, 260, { ref: 'KM1', contact: 'NO' })
      b.wire('S0', '12', 'KM1a', 'a')
      b.add('KT1', 'coil', 640, 620, { tag: 'KT1', kind: 'ton', preset: 5, text: tr('Estrella → triángulo') })
      b.wire('KM1a', 'b', 'KT1', 'A1')
      b.wire('KT1', 'A2', 'N', tap(660, 340))
      b.add('KT1c', 'contact', 780, 380, { ref: 'KT1', contact: 'NC' })
      b.add('KM2i', 'contact', 780, 500, { ref: 'KM2', contact: 'NC' })
      b.add('KM3', 'coil', 780, 620, { tag: 'KM3', kind: 'contactor', text: tr('Estrella') })
      b.wire('KM1a', 'b', 'KT1c', 'a')
      b.wire('KT1c', 'b', 'KM2i', 'a')
      b.wire('KM2i', 'b', 'KM3', 'A1')
      b.wire('KM3', 'A2', 'N', tap(800, 340))
      b.add('KT1o', 'contact', 920, 380, { ref: 'KT1', contact: 'NO' })
      b.add('KM3i', 'contact', 920, 500, { ref: 'KM3', contact: 'NC' })
      b.add('KM2', 'coil', 920, 620, { tag: 'KM2', kind: 'contactor', text: tr('Triángulo') })
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
function dwelling(b, width = 520, pe = 560) {
  b.add('L', 'rail', 0, 0, { potential: 'L', length: width })
  b.add('N', 'rail', 0, 20, { potential: 'N', length: width, wires: 'down' })
  b.add('PE', 'rail', 0, pe, { potential: 'PE', length: width })
  b.add('Q1', 'rcd', 20, 60, { tag: 'Q1', text: tr('Diferencial 30 mA') })
  b.wire('L', tap(40), 'Q1', '1')
  b.wire('N', tap(80), 'Q1', '3')
  b.add('Q2', 'breaker', 160, 180, { tag: 'Q2', poles: 1, text: 'PIA 10 A' })
  b.wire('Q1', '2', 'Q2', '1')
  // Fase protegida: Q2:2; neutro: Q1:4.
  return { phase: ['Q2', '2'], neutral: ['Q1', '4'] }
}
const lampTo = (b, name, x, y, neutral, tag = 'E1', bend) => {
  b.add(name, 'lamp', x, y, { tag, color: 'amber', text: tr('Punto de luz') })
  b.wire(name, 'X2', ...neutral, bend === undefined ? {} : { bend })
  return [name, 'X1']
}

ELEC_TEMPLATES.push(
  {
    id: 'punto-luz',
    title: N_('Punto de luz con interruptor'),
    description: N_('Vivienda: diferencial (Q1) y PIA (Q2), interruptor S1 y lámpara E1. Prueba el diferencial con su botón T.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b)
      b.add('S1', 'switch', 220, 300, { tag: 'S1', contact: 'NO', text: tr('Interruptor') })
      b.wire(...phase, 'S1', '13')
      b.wire('S1', '14', ...lampTo(b, 'E1', 220, 420, neutral))
      return b
    },
  },
  {
    id: 'conmutada',
    title: N_('Conmutada (dos puntos)'),
    description: N_('La lámpara se enciende y apaga desde dos sitios: dos conmutadores unidos por los dos hilos «viajeros».'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b)
      b.add('S1', 'changeover', 180, 300, { tag: 'S1', text: tr('Conmutador 1') })
      b.add('S2', 'changeover', 340, 300, { tag: 'S2', text: tr('Conmutador 2') })
      b.wire(...phase, 'S1', 'C')
      b.wire('S1', '1', 'S2', '1')
      b.wire('S1', '2', 'S2', '2')
      b.wire('S2', 'C', ...lampTo(b, 'E1', 480, 420, neutral))
      return b
    },
  },
  {
    id: 'cruzamiento',
    title: N_('Cruzamiento (tres puntos)'),
    description: N_('Dos conmutadores en los extremos y un cruzamiento en medio: cualquiera de los tres cambia la lámpara.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b, 700, 620)
      b.add('S1', 'changeover', 180, 300, { tag: 'S1', text: tr('Conmutador 1') })
      b.add('S2', 'crossover', 340, 420, { tag: 'S2', text: tr('Cruzamiento') })
      b.add('S3', 'changeover', 500, 300, { tag: 'S3', text: tr('Conmutador 2') })
      b.wire(...phase, 'S1', 'C')
      b.wire('S1', '1', 'S2', 'A1', { bend: 390 })
      b.wire('S1', '2', 'S2', 'A2', { bend: 410 })
      // Viajeros y neutro, cada uno a su altura por debajo.
      b.wire('S2', 'B1', 'S3', '1', { bend: 520 })
      b.wire('S2', 'B2', 'S3', '2', { bend: 540 })
      b.wire('S3', 'C', ...lampTo(b, 'E1', 700, 420, neutral, 'E1', 580))
      return b
    },
  },
  {
    id: 'telerruptor',
    title: N_('Telerruptor'),
    description: N_('Varios pulsadores en paralelo: cada pulsación del telerruptor KL1 cambia la lámpara.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b, 700)
      const buttons = ['S1', 'S2', 'S3']
      buttons.forEach((n, i) => {
        b.add(n, 'pushbutton', 180 + i * 120, 300, { tag: n, contact: 'NO', text: tr('Pulsador {n}', { n: i + 1 }) })
        b.wire(...phase, n, '13')
      })
      b.add('KL1', 'coil', 180, 420, { tag: 'KL1', kind: 'impulse', text: tr('Telerruptor') })
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
    title: N_('Minutero de escalera'),
    description: N_('Un pulsador cualquiera enciende la escalera; el minutero KT1 la apaga sola a los 30 s.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const { phase, neutral } = dwelling(b, 700)
      for (const [i, n] of ['S1', 'S2'].entries()) {
        b.add(n, 'pushbutton', 180 + i * 120, 300, { tag: n, contact: 'NO', text: tr('Planta {n}', { n: i + 1 }) })
        b.wire(...phase, n, '13')
      }
      b.add('KT1', 'coil', 180, 420, { tag: 'KT1', kind: 'tof', preset: 30, text: tr('Minutero') })
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
    title: N_('Mando a 24 V~ con transformador'),
    description: N_('El transformador T1 (protegido con el fusible F1) da 24 V~ al mando: marcha-paro de KM1 a tensión de seguridad.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('L', 'rail', 0, 0, { potential: 'L', length: 360 })
      b.add('N', 'rail', 0, 20, { potential: 'N', length: 360, wires: 'down' })
      b.add('F1', 'fuse', 20, 60, { tag: 'F1', poles: 1, text: tr('Fusible 2 A') })
      b.wire('L', tap(40), 'F1', '1')
      // Transformador a la derecha: su neutro baja sin pasar por los rótulos.
      b.add('T1', 'transformer', 260, 180, { tag: 'T1', text: '230/24 V' })
      b.wire('F1', '2', 'T1', 'P1')
      b.wire('N', tap(320), 'T1', 'P2')
      b.add('S0', 'pushbutton', 20, 320, { tag: 'S0', contact: 'NC', text: tr('Paro') })
      b.wire('T1', 'S1', 'S0', '11')
      b.add('S1', 'pushbutton', 20, 440, { tag: 'S1', contact: 'NO', text: tr('Marcha') })
      b.add('KM1h', 'contact', 160, 440, { ref: 'KM1', contact: 'NO' })
      b.wire('S0', '12', 'S1', '13')
      b.wire('S0', '12', 'KM1h', 'a')
      b.wire('KM1h', 'b', 'S1', '14')
      b.add('KM1', 'coil', 20, 560, { tag: 'KM1', kind: 'contactor', text: tr('Contactor (24 V~)') })
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
    title: N_('Cabecera de máquina'),
    description: N_('Interruptor general -Q0, relé de control de fases -KF1 (piloto si las fases están bien) y fuente de 24 V DC -G1 para el mando.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      for (const [i, p] of ['L1', 'L2', 'L3', 'N'].entries()) b.add(p, 'rail', 0, i * 20, { potential: p, length: 520, ...(p === 'N' ? { wires: 'down' } : {}) })
      b.add('Q0', 'mainswitch', 20, 100, { tag: 'Q0', text: tr('Interruptor general') })
      b.wire('L1', tap(40), 'Q0', '1')
      b.wire('L2', tap(80), 'Q0', '3')
      b.wire('L3', tap(120), 'Q0', '5')
      b.add('KF1', 'phasemonitor', 20, 240, { tag: 'KF1', text: tr('Control de fases') })
      b.wire('Q0', '2', 'KF1', 'L1')
      b.wire('Q0', '4', 'KF1', 'L2')
      b.wire('Q0', '6', 'KF1', 'L3')
      b.add('G1', 'psu', 260, 240, { tag: 'G1' })
      b.wire('Q0', '2', 'G1', 'L')
      b.wire('N', tap(320), 'G1', 'N')
      b.add('KF1c', 'contact', 420, 360, { ref: 'KF1', contact: 'NO' })
      b.add('H1', 'lamp', 420, 480, { tag: 'H1', color: 'white', text: tr('Tensión y fases correctas') })
      b.wire('G1', 'L+', 'KF1c', 'a')
      b.wire('KF1c', 'b', 'H1', 'X1')
      b.wire('H1', 'X2', 'G1', 'M')
      return b
    },
  },
  {
    id: 'seguridad',
    title: N_('Parada de emergencia (categoría 3)'),
    description: N_('Seta y puerta de doble canal al relé de seguridad -KS1; rearme S2; dos contactores redundantes. Abrir un canal para; vuelve solo con el rearme.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('L+', 'rail', 0, 0, { potential: 'L+', length: 900 })
      b.add('M', 'rail', 0, 680, { potential: 'M', length: 900 })
      b.add('KS1', 'safetyrelay', 290, 380, { tag: 'KS1', text: tr('Relé de seguridad') })
      b.wire('L+', tap(300), 'KS1', 'A1')
      b.wire('KS1', 'A2', 'M', tap(300))
      // Los dos canales y el rearme, cada uno a su altura (sin cables montados unos sobre otros).
      b.add('S1', 'emergency', 20, 100, { tag: 'S1', channels: 2, text: tr('Seta de emergencia') })
      b.add('B1', 'doorswitch', 20, 240, { tag: 'B1', text: tr('Puerta del resguardo') })
      b.wire('KS1', 'S11', 'S1', '11', { bend: 80 })
      b.wire('S1', '12', 'B1', '11')
      b.wire('B1', '12', 'KS1', 'S12', { bend: 335 })
      b.wire('KS1', 'S21', 'S1', '21', { bend: 60 })
      b.wire('S1', '22', 'B1', '21')
      b.wire('B1', '22', 'KS1', 'S22', { bend: 350 })
      b.add('S2', 'pushbutton', 200, 240, { tag: 'S2', contact: 'NO', text: tr('Rearme') })
      b.wire('KS1', 'S33', 'S2', '13')
      b.wire('S2', '14', 'KS1', 'S34', { bend: 365 })
      b.add('KM1', 'coil', 560, 560, { tag: 'KM1', kind: 'contactor', text: tr('Contactor 1') })
      b.add('KM2', 'coil', 700, 560, { tag: 'KM2', kind: 'contactor', text: tr('Contactor 2') })
      b.wire('L+', tap(440), 'KS1', '13')
      b.wire('KS1', '14', 'KM1', 'A1', { bend: 515 })
      b.wire('KM1', 'A2', 'M', tap(580))
      b.wire('L+', tap(460), 'KS1', '23')
      b.wire('KS1', '24', 'KM2', 'A1', { bend: 530 })
      b.wire('KM2', 'A2', 'M', tap(720))
      b.add('H1', 'lamp', 840, 560, { tag: 'H1', color: 'red', text: tr('Parada de emergencia') })
      b.wire('L+', tap(480), 'KS1', '41')
      b.wire('KS1', '42', 'H1', 'X1', { bend: 545 })
      b.wire('H1', 'X2', 'M', tap(860))
      return b
    },
  },
  {
    id: 'variador',
    title: N_('Variador de frecuencia'),
    description: N_('Cinta con variador -T1: S1 adelante, S2 atrás, S3 segunda velocidad (25 Hz) y, con S4, consigna del potenciómetro -R1. La baliza se pone verde en marcha.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      for (const [i, p] of ['L1', 'L2', 'L3'].entries()) b.add(p, 'rail', 0, i * 20, { potential: p, length: 160 })
      b.add('Q1', 'motorprotector', 20, 100, { tag: 'Q1', text: tr('Guardamotor') })
      b.wire('L1', tap(40), 'Q1', '1')
      b.wire('L2', tap(80), 'Q1', '3')
      b.wire('L3', tap(120), 'Q1', '5')
      b.add('T1', 'vfd', 20, 520, { tag: 'T1', speed2: 25, text: tr('Variador') })
      b.wire('Q1', '2', 'T1', 'L1')
      b.wire('Q1', '4', 'T1', 'L2')
      b.wire('Q1', '6', 'T1', 'L3')
      b.add('M1', 'motor3', 20, 720, { tag: 'M1', text: tr('Motor de la cinta') })
      b.wire('T1', 'U', 'M1', 'U')
      b.wire('T1', 'V', 'M1', 'V')
      b.wire('T1', 'W', 'M1', 'W')
      // Selectores escalonados (cada cable a su entrada por una altura distinta), alimentados en
      // cadena desde el +24 del variador.
      const switches = [
        ['S1', 'DI1', 'Adelante'],
        ['S2', 'DI2', N_('Atrás')],
        ['S3', 'DI3', '2ª velocidad'],
      ]
      switches.forEach(([n, di, text], i) => {
        b.add(n, 'switch', 360 + i * 120, 220 + i * 40, { tag: n, contact: 'NO', text })
        if (i === 0) b.wire('T1', '+24', n, '13')
        else b.wire(switches[i - 1][0], '13', n, '13')
        b.wire(n, '14', 'T1', di)
      })
      b.add('R1', 'potentiometer', 700, 220, { tag: 'R1', initial: 0.5, text: tr('Consigna 0-10 V') })
      b.add('S4', 'switch', 720, 340, { tag: 'S4', contact: 'NO', text: tr('Consigna externa') })
      b.wire('R1', 'W', 'S4', '13')
      b.wire('S4', '14', 'T1', 'AI1')
      // Baliza: verde con el relé de marcha R1-R2 del variador, desde su propia alimentación de 24 V.
      b.add('Lp', 'rail', 300, 660, { potential: 'L+', length: 300 })
      b.add('M', 'rail', 300, 940, { potential: 'M', length: 300 })
      b.add('P1', 'beacon', 420, 780, { tag: 'P1', text: tr('Baliza') })
      b.wire('T1', 'R2', 'Lp', tap(300, 300))
      b.wire('T1', 'R1', 'P1', 'X3')
      b.wire('P1', 'X0', 'M', tap(520, 300))
      return b
    },
  },
  {
    id: 'arrancador-suave',
    title: N_('Arrancador suave'),
    description: N_('El arrancador -T1 sube la tensión del motor en una rampa (3 s): la cinta arranca sin tirones. S1 da la orden.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      for (const [i, p] of ['L1', 'L2', 'L3'].entries()) b.add(p, 'rail', 0, i * 20, { potential: p, length: 520 })
      b.add('N', 'rail', 0, 600, { potential: 'N', length: 520 })
      b.add('Q1', 'breaker', 20, 120, { tag: 'Q1', poles: 3, text: tr('Protección') })
      b.wire('L1', tap(40), 'Q1', '1')
      b.wire('L2', tap(80), 'Q1', '3')
      b.wire('L3', tap(120), 'Q1', '5')
      b.add('T1', 'softstarter', 20, 260, { tag: 'T1', ramp: 3, text: tr('Arrancador suave') })
      b.wire('Q1', '2', 'T1', 'L1')
      b.wire('Q1', '4', 'T1', 'L2')
      b.wire('Q1', '6', 'T1', 'L3')
      b.add('M1', 'motor3', 20, 420, { tag: 'M1', text: tr('Motor') })
      b.wire('T1', 'T1', 'M1', 'U')
      b.wire('T1', 'T2', 'M1', 'V')
      b.wire('T1', 'T3', 'M1', 'W')
      // Mando (A1-A2 a 230 V): S1 desde L1, a la derecha de la protección; A2 al neutro de abajo.
      b.add('S1', 'switch', 260, 120, { tag: 'S1', contact: 'NO', text: tr('Marcha') })
      b.wire('L1', tap(280), 'S1', '13')
      b.wire('S1', '14', 'T1', 'A1')
      b.wire('T1', 'A2', 'N', tap(300))
      return b
    },
  },
  {
    id: 'freno',
    title: N_('Motor con freno'),
    description: N_('El freno -MB1 se alimenta con un contacto de KM1: con el motor en marcha se suelta; al parar, frena.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      power(b)
      b.add('M1', 'motor3', 0, 440, { tag: 'M1', text: tr('Motor') })
      b.wire('F2', '2', 'M1', 'U')
      b.wire('F2', '4', 'M1', 'V')
      b.wire('F2', '6', 'M1', 'W')
      controlStart(b, 340, 620)
      const last = startStop(b, 340, 'S0', '12', 'S1', 'KM1')
      b.add('KM1', 'coil', 340, 480, { tag: 'KM1', kind: 'contactor', text: tr('Motor') })
      b.wire(...last, 'KM1', 'A1')
      b.wire('KM1', 'A2', 'N', tap(360, 320))
      // Freno en su columna del mando: con KM1 dentro (motor en marcha) se suelta; al parar, frena.
      b.add('KM1b', 'contact', 640, 260, { ref: 'KM1', contact: 'NO' })
      b.add('MB1', 'brake', 640, 480, { tag: 'MB1', text: tr('Freno') })
      b.wire('L', tap(660, 320), 'KM1b', 'a')
      b.wire('KM1b', 'b', 'MB1', 'A1')
      b.wire('MB1', 'A2', 'N', tap(660, 320))
      return b
    },
  },
  {
    id: 'electroneumatica',
    title: N_('Cilindro con electroválvula 5/2'),
    description: N_('Electroneumática: mientras se pulsa S1, -Y1 pilota la 5/2 monoestable y el cilindro A sale (frenado en el escape por 1V2); al soltar, vuelve con el muelle de la válvula. El detector a1 enciende H1.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('Lp', 'rail', 0, 0, { potential: 'L+', length: 200 })
      b.add('M', 'rail', 0, 400, { potential: 'M', length: 200 })
      b.add('S1', 'pushbutton', 20, 60, { tag: 'S1', contact: 'NO', text: 'A+' })
      b.add('Y1', 'valve', 20, 240, { tag: 'Y1', text: 'A+' })
      b.wire('Lp', tap(40), 'S1', '13')
      b.wire('S1', '14', 'Y1', 'A1')
      b.wire('Y1', 'A2', 'M', tap(40))
      b.add('B1', 'limit', 120, 60, { tag: 'B1', contact: 'NO', signal: 'a1', text: 'A fuera' })
      b.add('H1', 'lamp', 120, 240, { tag: 'H1', color: 'green', text: 'A fuera' })
      b.wire('Lp', tap(140), 'B1', '13')
      b.wire('B1', '14', 'H1', 'X1')
      b.wire('H1', 'X2', 'M', tap(140))
      // Aire: fuente -> unidad de mantenimiento -> 1V1 -> cilindro (1V2 en el escape del lado B).
      b.add('A', 'pcylinder', 340, 20, { tag: 'A', acting: 'double', time: 1, initial: 0, text: '' })
      b.add('V2', 'throttle', 460, 140, { tag: '1V2', setting: 0.5 })
      b.add('V1', 'pvalve', 220, 260, { tag: '1V1', ways: '5/2', sol14: 'Y1', sol12: '', manual: 'none' })
      b.add('Z', 'frl', 360, 380, { tag: '0Z1' })
      b.add('P', 'airsource', 360, 500, { tag: '0P1' })
      b.wire('P', '1', 'Z', '1')
      b.wire('Z', '2', 'V1', '1')
      b.wire('V1', '4', 'A', 'A')
      b.wire('V1', '2', 'V2', '1')
      b.wire('V2', '2', 'A', 'B')
      return b
    },
  },
  {
    id: 'electroneumatica-biestable',
    title: N_('Cilindro con 5/2 biestable (memoria)'),
    description: N_('Electroneumática: un impulso en S1 (-Y1) saca el cilindro A y se queda fuera aunque se suelte (la válvula biestable recuerda); un impulso en S2 (-Y2) lo hace entrar.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('Lp', 'rail', 0, 0, { potential: 'L+', length: 200 })
      b.add('M', 'rail', 0, 400, { potential: 'M', length: 200 })
      for (const [k, x, text] of [
        [1, 20, 'A+'],
        [2, 120, 'A−'],
      ]) {
        b.add(`S${k}`, 'pushbutton', x, 60, { tag: `S${k}`, contact: 'NO', text })
        b.add(`Y${k}`, 'valve', x, 240, { tag: `Y${k}`, text })
        b.wire('Lp', tap(x + 20), `S${k}`, '13')
        b.wire(`S${k}`, '14', `Y${k}`, 'A1')
        b.wire(`Y${k}`, 'A2', 'M', tap(x + 20))
      }
      addAir(b, pneumaticCircuit([{ tag: 'A', sol14: 'Y1', sol12: 'Y2' }], 460, 20, 'air'))
      return b
    },
  },
  {
    id: 'electrohidraulica-prensa',
    title: N_('Prensa hidráulica con 4/3 en tándem'),
    description: N_('Electrohidráulica: mientras se pulsa S1 (-Y1) el cilindro baja, y con S2 (-Y2) sube. Al soltar, el distribuidor vuelve al centro: el cilindro se queda quieto donde esté (el aceite no se comprime) y la bomba descarga al depósito (el manómetro marca 0). Al llegar al tope, la presión sube hasta la limitadora.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('Lp', 'rail', 0, 0, { potential: 'L+', length: 300 })
      b.add('M', 'rail', 0, 400, { potential: 'M', length: 300 })
      for (const [k, x, text] of [
        [1, 20, 'Bajar'],
        [2, 120, 'Subir'],
      ]) {
        b.add(`S${k}`, 'pushbutton', x, 60, { tag: `S${k}`, contact: 'NO', text })
        b.add(`Y${k}`, 'valve', x, 240, { tag: `Y${k}`, text })
        b.wire('Lp', tap(x + 20), `S${k}`, '13')
        b.wire(`S${k}`, '14', `Y${k}`, 'A1')
        b.wire(`Y${k}`, 'A2', 'M', tap(x + 20))
      }
      b.add('B1', 'limit', 220, 60, { tag: 'B1', contact: 'NO', signal: 'a1', text: 'Abajo' })
      b.add('H1', 'lamp', 220, 240, { tag: 'H1', color: 'green', text: 'Abajo' })
      b.wire('Lp', tap(240), 'B1', '13')
      b.wire('B1', '14', 'H1', 'X1')
      b.wire('H1', 'X2', 'M', tap(240))
      // Aceite: grupo -> distribuidor 4/3 (centro en tándem) -> cilindro; limitadora y manómetro en P.
      b.add('A', 'hcylinder', 440, 20, { tag: 'A', time: 3, initial: 0, text: 'Prensa' })
      b.add('V1', 'hvalve', 340, 220, { tag: '1V1', ways: '4/3', center: 'tandem', sol14: 'Y1', sol12: 'Y2', manual: 'none' })
      b.add('P', 'hpump', 440, 420, { tag: '0P1', motor: '' })
      b.add('R', 'hrelief', 620, 400, { tag: '0V1', setting: 100 })
      b.add('T', 'htank', 620, 340, { tag: '0Z2' })
      b.add('G', 'hgauge', 280, 420, { tag: '0Z1' })
      b.wire('V1', 'A', 'A', 'A')
      b.wire('V1', 'B', 'A', 'B')
      b.wire('P', 'P', 'V1', 'P')
      b.wire('V1', 'T', 'P', 'T')
      b.wire('P', 'P', 'R', 'P')
      b.wire('R', 'T', 'T', 'T')
      b.wire('G', '1', 'P', 'P')
      return b
    },
  },
  {
    id: 'electrohidraulica-elevador',
    title: N_('Elevador hidráulico con bajada frenada'),
    description: N_('Electrohidráulica: S1 (-Y1) sube la plataforma y S2 (-Y2) la baja, frenada por el regulador 1V2 (el aceite pasa libre al subir y estrangulado al bajar). Centro cerrado: al soltar, la plataforma se queda sujeta a media altura y la bomba trabaja contra la limitadora.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('Lp', 'rail', 0, 0, { potential: 'L+', length: 200 })
      b.add('M', 'rail', 0, 400, { potential: 'M', length: 200 })
      for (const [k, x, text] of [
        [1, 20, 'Subir'],
        [2, 120, 'Bajar'],
      ]) {
        b.add(`S${k}`, 'pushbutton', x, 60, { tag: `S${k}`, contact: 'NO', text })
        b.add(`Y${k}`, 'valve', x, 240, { tag: `Y${k}`, text })
        b.wire('Lp', tap(x + 20), `S${k}`, '13')
        b.wire(`S${k}`, '14', `Y${k}`, 'A1')
        b.wire(`Y${k}`, 'A2', 'M', tap(x + 20))
      }
      b.add('A', 'hcylinder', 340, 20, { tag: 'A', time: 3, initial: 0, text: 'Plataforma' })
      b.add('Q', 'hthrottle', 280, 120, { tag: '1V2', setting: 0.4 })
      b.add('V1', 'hvalve', 240, 240, { tag: '1V1', ways: '4/3', center: 'closed', sol14: 'Y1', sol12: 'Y2', manual: 'none' })
      b.add('P', 'hpump', 340, 440, { tag: '0P1', motor: '' })
      b.add('R', 'hrelief', 520, 420, { tag: '0V1', setting: 120 })
      b.add('T', 'htank', 520, 360, { tag: '0Z2' })
      b.add('G', 'hgauge', 180, 440, { tag: '0Z1' })
      b.wire('V1', 'A', 'Q', '1')
      b.wire('Q', '2', 'A', 'A')
      b.wire('V1', 'B', 'A', 'B')
      b.wire('P', 'P', 'V1', 'P')
      b.wire('V1', 'T', 'P', 'T')
      b.wire('P', 'P', 'R', 'P')
      b.wire('R', 'T', 'T', 'T')
      b.wire('G', '1', 'P', 'P')
      return b
    },
  },
  {
    id: 'secuencia-ab',
    title: N_('Secuencia A+ B+ A− B− con finales de carrera'),
    description: N_('Electroneumática sin autómata: cada movimiento lo da el final de carrera del anterior (válvulas biestables). Mientras S1 (marcha) esté pulsado, repite el ciclo: A+ con S1 y b0, B+ con a1, A− con b1 y B− con a0.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('Lp', 'rail', 0, 0, { potential: 'L+', length: 420 })
      b.add('M', 'rail', 0, 500, { potential: 'M', length: 420 })
      // A+ : S1 y b0 en serie.
      b.add('S1', 'pushbutton', 20, 40, { tag: 'S1', contact: 'NO', text: tr('Marcha') })
      b.add('Bb0', 'limit', 20, 160, { tag: 'B3', contact: 'NO', signal: 'b0', text: 'b0' })
      b.wire('Lp', tap(40), 'S1', '13')
      b.wire('S1', '14', 'Bb0', '13')
      const branch = (name, x, from, fromT, tag, text) => {
        b.add(name, 'valve', x, 340, { tag, text })
        b.wire(from, fromT, name, 'A1')
        b.wire(name, 'A2', 'M', tap(x + 20))
      }
      branch('Y1', 20, 'Bb0', '14', 'Y1', 'A+')
      // B+ con a1, A− con b1, B− con a0.
      for (const [k, x, signal, tag, text, limitTag] of [
        [1, 120, 'a1', 'Y3', 'B+', 'B2'],
        [2, 220, 'b1', 'Y2', 'A−', 'B4'],
        [3, 320, 'a0', 'Y4', 'B−', 'B1'],
      ]) {
        b.add(`L${k}`, 'limit', x, 160, { tag: limitTag, contact: 'NO', signal, text: signal })
        b.wire('Lp', tap(x + 20), `L${k}`, '13')
        branch(`V${k}`, x, `L${k}`, '14', tag, text)
      }
      addAir(
        b,
        pneumaticCircuit(
          [
            { tag: 'A', sol14: 'Y1', sol12: 'Y2' },
            { tag: 'B', sol14: 'Y3', sol12: 'Y4' },
          ],
          640,
          20,
          'air',
        ),
      )
      return b
    },
  },
)

// Motores especiales: monofásico con inversión, Dahlander y dos devanados.
// Mando con dos marchas enclavadas (como en la inversión de giro) en la columna x0: S0 para;
// S1 y S2 arrancan cada sentido o velocidad con su autorretención y el NC del otro contactor.
function twoWayControl(b, x0, railL, railX0, nRail, nX0, [first, second], extra = null) {
  b.add('S0', 'pushbutton', x0, 80, { tag: 'S0', contact: 'NC', text: tr('Paro') })
  b.wire(railL, tap(x0 + 20, railX0), 'S0', '11')
  const branch = (k, x, start, coil, other, text, bend) => {
    b.add(start, 'pushbutton', x, 220, { tag: start, contact: 'NO', text })
    b.add(`${coil}h`, 'contact', x + 140, 220, { ref: coil, contact: 'NO' })
    b.wire('S0', '12', start, '13', x === x0 ? {} : { bend })
    b.wire('S0', '12', `${coil}h`, 'a', { bend: bend + 10 })
    b.wire(`${coil}h`, 'b', start, '14')
    b.add(`${other}i${k}`, 'contact', x, 340, { ref: other, contact: 'NC' })
    b.wire(start, '14', `${other}i${k}`, 'a')
    b.add(coil, 'coil', x, 460, { tag: coil, kind: 'contactor', text, interlock: other })
    b.wire(`${other}i${k}`, 'b', coil, 'A1')
    b.wire(coil, 'A2', nRail, tap(x + 20, nX0))
    return `${other}i${k}`
  }
  branch(1, x0, 'S1', first.coil, second.coil, first.text, 160)
  const last = branch(2, x0 + 280, 'S2', second.coil, first.coil, second.text, 180)
  // Contactor que entra con el segundo (puente de estrella del Dahlander).
  if (extra) {
    b.add(extra.coil, 'coil', x0 + 420, 460, { tag: extra.coil, kind: 'contactor', text: extra.text })
    b.wire(last, 'b', extra.coil, 'A1', { bend: 440 })
    b.wire(extra.coil, 'A2', nRail, tap(x0 + 440, nX0))
  }
}

ELEC_TEMPLATES.push(
  {
    id: 'monofasico-inversion',
    title: N_('Motor monofásico con inversión de giro'),
    description: N_('Motor de condensador: KM1 gira a derechas y KM2 a izquierdas cambiando la conexión del devanado auxiliar (Z1-Z2); el principal (U1-U2) no cambia. Enclavamiento eléctrico y mecánico.'),
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      b.add('L', 'rail', 0, 0, { potential: 'L', length: 1020 })
      b.add('N', 'rail', 0, 20, { potential: 'N', length: 380, wires: 'down' })
      b.add('Q1', 'breaker', 20, 60, { tag: 'Q1', poles: 1, text: 'PIA 10 A' })
      b.wire('L', tap(40), 'Q1', '1')
      b.add('KM1m', 'maincontacts', 20, 220, { ref: 'KM1' })
      b.add('KM2m', 'maincontacts', 180, 220, { ref: 'KM2' })
      // KM1: U1 y Z1 a fase, Z2 a neutro. KM2: U1 y Z2 a fase, Z1 a neutro (auxiliar al revés).
      b.wire('Q1', '2', 'KM1m', '1')
      b.wire('Q1', '2', 'KM1m', '3', { bend: 160 })
      b.wire('Q1', '2', 'KM2m', '1', { bend: 170 })
      b.wire('Q1', '2', 'KM2m', '5', { bend: 180 })
      b.wire('N', tap(120), 'KM1m', '5')
      b.wire('N', tap(240), 'KM2m', '3')
      b.add('M1', 'motor1', 20, 440, { tag: 'M1', capacitor: 'permanent', text: tr('Motor') })
      b.wire('KM1m', '2', 'M1', 'U1')
      b.wire('KM2m', '2', 'M1', 'U1', { bend: 320 })
      b.wire('KM1m', '4', 'M1', 'Z1', { bend: 340 })
      b.wire('KM2m', '4', 'M1', 'Z1', { bend: 360 })
      b.wire('KM1m', '6', 'M1', 'Z2')
      b.wire('KM2m', '6', 'M1', 'Z2', { bend: 380 })
      // U2 al neutro, por la derecha.
      b.wire('M1', 'U2', 'N', tap(360), { bend: 420 })
      b.add('N2', 'rail', 440, 600, { potential: 'N', length: 580 })
      twoWayControl(b, 460, 'L', 0, 'N2', 440, [
        { coil: 'KM1', text: tr('Derechas') },
        { coil: 'KM2', text: tr('Izquierdas') },
      ])
      return b
    },
  },
  ...[
    {
      id: 'dahlander',
      type: 'dahlander',
      title: N_('Motor Dahlander (dos velocidades)'),
      description: N_('Un solo devanado: KM1 da la velocidad lenta (triángulo, por 1U-1V-1W); KM2 con KM3 (que puentea 1U-1V-1W) da la rápida (doble estrella, por 2U-2V-2W). Enclavadas: nunca las dos a la vez.'),
    },
    {
      id: 'dos-devanados',
      type: 'motor2w',
      title: N_('Motor de dos devanados (dos velocidades)'),
      description: N_('Dos devanados separados: KM1 alimenta el de la velocidad lenta (1U-1V-1W) y KM2 el de la rápida (2U-2V-2W). Enclavadas: nunca las dos a la vez.'),
    },
  ].map(({ id, type, title, description }) => ({
    id,
    title,
    description,
    build(ox, oy, prefix) {
      const b = builder(ox, oy, prefix)
      const dahlander = type === 'dahlander'
      b.add('L1', 'rail', 0, 0, { potential: 'L1', length: 1100 })
      b.add('L2', 'rail', 0, 20, { potential: 'L2', length: 520 })
      b.add('L3', 'rail', 0, 40, { potential: 'L3', length: 520 })
      b.add('Q1', 'motorprotector', 20, 100, { tag: 'Q1', text: tr('Guardamotor') })
      b.wire('L1', tap(40), 'Q1', '1')
      b.wire('L2', tap(80), 'Q1', '3')
      b.wire('L3', tap(120), 'Q1', '5')
      b.add('KM1m', 'maincontacts', 20, 240, { ref: 'KM1' })
      b.add('KM2m', 'maincontacts', 220, 240, { ref: 'KM2' })
      for (const [a, t] of [
        ['2', '1'],
        ['4', '3'],
        ['6', '5'],
      ])
        b.wire('Q1', a, 'KM1m', t)
      for (const [a, t, bend] of [
        ['2', '1', 195],
        ['4', '3', 210],
        ['6', '5', 225],
      ])
        b.wire('Q1', a, 'KM2m', t, { bend })
      b.add('M1', type, 20, 520, { tag: 'M1', text: tr('Motor') })
      for (const [a, t] of [
        ['2', '1U'],
        ['4', '1V'],
        ['6', '1W'],
      ])
        b.wire('KM1m', a, 'M1', t)
      for (const [a, t, bend] of [
        ['2', '2U', 340],
        ['4', '2V', 360],
        ['6', '2W', 380],
      ])
        b.wire('KM2m', a, 'M1', t, { bend })
      if (dahlander) {
        // KM3 puentea 1U-1V-1W (tomados a la salida de KM1) para la doble estrella.
        b.add('KM3m', 'maincontacts', 380, 460, { ref: 'KM3' })
        for (const [a, t, bend] of [
          ['2', '1', 400],
          ['4', '3', 420],
          ['6', '5', 440],
        ])
          b.wire('KM1m', a, 'KM3m', t, { bend })
        b.wire('KM3m', '2', 'KM3m', '4')
        b.wire('KM3m', '4', 'KM3m', '6')
      }
      b.add('N', 'rail', 560, 600, { potential: 'N', length: 540 })
      twoWayControl(
        b,
        580,
        'L1',
        0,
        'N',
        560,
        [
          { coil: 'KM1', text: tr('Lenta') },
          { coil: 'KM2', text: tr('Rápida') },
        ],
        dahlander ? { coil: 'KM3', text: tr('Puente estrella') } : null,
      )
      return b
    },
  })),
)

// Añade la parte neumática (lib/elec/pneumaticCircuit.js) a un montaje.
function addAir(b, air) {
  const local = (id) => id.replace(/^air-/, 'air')
  for (const c of air.components) b.add(local(c.id), c.type, c.x, c.y, Object.fromEntries(Object.entries(c).filter(([k]) => !['id', 'type', 'x', 'y'].includes(k))))
  for (const w of air.wires) b.wire(local(w.from.c), w.from.t, local(w.to.c), w.to.t)
}

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
    // Cilindros: la siguiente letra libre (A -> B).
    if (ELEC_TYPES[c.type]?.letterTag) {
      rename.set(c.tag, nextLetterTag([...all, ...[...rename.values()].map((tag) => ({ tag }))]))
      continue
    }
    const prefix = c.tag.replace(/\d+$/, '')
    let n = 1
    while (used.has(`${prefix}${n}`) || [...rename.values()].includes(`${prefix}${n}`)) n++
    rename.set(c.tag, `${prefix}${n}`)
  }
  for (const v of rename.values()) used.add(v)
  const fix = (t) => (t && rename.has(t) ? rename.get(t) : t)
  // Detectores de un cilindro renombrado: a0/a1 -> b0/b1.
  const signals = new Map()
  for (const c of b.components) {
    if (c.type !== 'pcylinder' || !rename.has(c.tag)) continue
    const [o0, o1] = cylinderSignals(c.tag)
    const [n0, n1] = cylinderSignals(rename.get(c.tag))
    signals.set(o0, n0).set(o1, n1)
  }
  const components = b.components.map((c) => ({
    ...c,
    ...(c.tag ? { tag: fix(c.tag) } : {}),
    ...(c.ref ? { ref: fix(c.ref) } : {}),
    ...(c.interlock ? { interlock: fix(c.interlock) } : {}),
    ...(c.sol14 ? { sol14: fix(c.sol14) } : {}),
    ...(c.sol12 ? { sol12: fix(c.sol12) } : {}),
    ...(c.signal && signals.has(c.signal) ? { signal: signals.get(c.signal) } : {}),
  }))
  return { components, wires: b.wires, renamed: Object.fromEntries(rename) }
}

// Solo la potencia de un montaje (lo que hay a la izquierda de maxX: embarrados recortados,
// protecciones, contactos principales y motor), colocada en (ox, oy), para los ejemplos con
// autómata: el mando (las bobinas) lo pone el autómata.
export function powerPart(id, maxX, ox, oy, prefix = id) {
  const template = ELEC_TEMPLATES.find((t) => t.id === id)
  const b = template.build(ox, oy, `${prefix}-p`)
  const kept = b.components
    .filter((c) => c.x - ox < maxX)
    .map((c) => (c.type === 'rail' ? { ...c, length: Math.min(Number(c.length) || 0, maxX - (c.x - ox)) } : c))
  const ids = new Set(kept.map((c) => c.id))
  return { components: kept, wires: b.wires.filter((w) => ids.has(w.from.c) && ids.has(w.to.c)) }
}
