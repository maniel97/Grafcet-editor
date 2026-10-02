// Ejemplos de grafcet listos para abrir (diálogo Abrir > Ejemplos). Todos son conformes a
// IEC 60848 y simulables; las pruebas (tests/unit/examples.test.js) lo comprueban.
// Coordenadas en la cuadrícula del editor: etapa -> transición +100 px, transición -> etapa +70 px.

import { NOTE_SIZE } from './notes'

const step = (id, label, x, y, actions = [], extra = {}) => ({ id, type: 'step', position: { x, y }, data: { label, actions, ...extra } })
const trans = (id, condition, x, y) => ({ id, type: 'transition', position: { x, y }, data: { condition } })
const note = (id, x, y, text, size = {}) => ({ id, type: 'note', position: { x, y }, data: { text, color: 'yellow' }, ...NOTE_SIZE, height: 150, ...size })
const frame = (id, name, kind, x, y, width, height) => ({ id, type: 'frame', position: { x, y }, width, height, zIndex: -1, data: { name, kind } })
const links = (pairs) => pairs.map(([source, target]) => ({ id: `${source}-${target}`, source, target, type: 'grafcet' }))

// Secuencia lineal en columna que vuelve al principio: [etapa, transición, etapa, transición...].
function cycle(items, x = 200) {
  const nodes = []
  let y = 0
  items.forEach((item, i) => {
    if (i % 2 === 0) {
      nodes.push(step(`s${i / 2}`, String(i / 2), x, y, item.actions ?? [], i === 0 ? { initial: true } : {}))
      y += 100
    } else {
      nodes.push(trans(`t${(i + 1) / 2}`, item, x, y))
      y += 70
    }
  })
  const ids = nodes.map((n) => n.id)
  const pairs = ids.slice(1).map((id, i) => [ids[i], id])
  pairs.push([ids[ids.length - 1], ids[0]]) // última transición: bucle a la etapa inicial
  return { nodes, edges: links(pairs) }
}

export const EXAMPLES = [
  {
    id: 'taladradora',
    title: 'Taladradora',
    description: 'Secuencia lineal con temporización: bajar taladrando, repasar 2 s y subir.',
    tags: ['Lineal', 'Temporización', 'Bucle'],
    build() {
      const { nodes, edges } = cycle([
        { actions: [] },
        'Marcha · Pieza',
        { actions: ['Motor_broca', 'Bajar'] },
        'Fc_abajo',
        { actions: ['Motor_broca'] },
        '2s/X2',
        { actions: ['Subir'] },
        'Fc_arriba',
      ])
      nodes.push(
        note('nota', 520, 0, 'Taladradora\n\nCon pieza y Marcha, la broca baja girando hasta Fc_abajo, repasa 2 s y sube hasta Fc_arriba.'),
      )
      return { nodes, edges }
    },
  },
  {
    id: 'cilindros',
    title: 'Cilindros A+ B+ A− B−',
    description: 'Secuencia neumática clásica con finales de carrera a0/a1 y b0/b1.',
    tags: ['Lineal', 'Neumática'],
    build() {
      const { nodes, edges } = cycle([
        { actions: [] },
        'Marcha · a0 · b0',
        { actions: ['A+'] },
        'a1',
        { actions: ['B+'] },
        'b1',
        { actions: ['A-'] },
        'a0',
        { actions: ['B-'] },
        'b0',
      ])
      nodes.push(note('nota', 520, 0, 'Secuencia A+ B+ A− B−\n\nCada movimiento empieza cuando el anterior llega a su final de carrera.'))
      return { nodes, edges }
    },
  },
  {
    id: 'semaforo',
    title: 'Semáforo',
    description: 'Ciclo cerrado solo con temporizaciones: rojo 10 s, verde 8 s, ámbar 3 s.',
    tags: ['Temporización', 'Bucle'],
    build() {
      const { nodes, edges } = cycle([{ actions: ['Rojo'] }, '10s/X0', { actions: ['Verde'] }, '8s/X1', { actions: ['Ámbar'] }, '3s/X2'])
      nodes.push(note('nota', 520, 0, 'Semáforo\n\nCada etapa enciende una luz; la temporización de la etapa activa pasa a la siguiente.'))
      return { nodes, edges }
    },
  },
  {
    id: 'mezcladora',
    title: 'Mezcladora',
    description: 'Divergencia en O (producción o limpieza) y en Y (llenado simultáneo de dos depósitos).',
    // La rama de limpieza va a la izquierda: su bucle vuelve por la izquierda sin cruzar las demás.
    tags: ['Divergencia en O', 'Divergencia en Y', 'Temporización'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        trans('t7', 'Limpieza', -40, 100),
        step('s1', '1', 200, 170, ['Llenar_A']),
        step('s2', '2', 440, 170, ['Llenar_B']),
        trans('t2', 'Nivel_A', 200, 270),
        trans('t3', 'Nivel_B', 440, 270),
        step('s3', '3', 200, 340),
        step('s4', '4', 440, 340),
        trans('t4', '1', 200, 440),
        step('s5', '5', 200, 510, ['Mezclar']),
        trans('t5', '30s/X5', 200, 610),
        step('s6', '6', 200, 680, ['Vaciar']),
        trans('t6', 'Vacio', 200, 780),
        step('s7', '7', -40, 170, ['Lavar']),
        trans('t8', 'Fin_lavado', -40, 270),
        note(
          'nota',
          720,
          0,
          'Mezcladora\n\nEn 0 se elige (divergencia en O): Marcha para producir o Limpieza para lavar.\n\nAl producir, A y B se llenan a la vez (divergencia en Y) y se mezcla cuando ambos están llenos (convergencia en Y).',
          { width: 300, height: 250 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['s0', 't7'],
        ['t1', 's1'],
        ['t1', 's2'],
        ['s1', 't2'],
        ['s2', 't3'],
        ['t2', 's3'],
        ['t3', 's4'],
        ['s3', 't4'],
        ['s4', 't4'],
        ['t4', 's5'],
        ['s5', 't5'],
        ['t5', 's6'],
        ['s6', 't6'],
        ['t6', 's0'],
        ['t7', 's7'],
        ['s7', 't8'],
        ['t8', 's0'],
      ])
      return { nodes, edges }
    },
  },
  {
    id: 'emergencia',
    title: 'Paro de emergencia (forzado)',
    description: 'Dos grafcets parciales: el de seguridad G1 fuerza al de producción G2 a parar y a reiniciarse.',
    tags: ['Grafcets parciales', 'Forzado'],
    build() {
      const nodes = [
        frame('g1', 'G1', 'grafcet', -40, -40, 400, 560),
        step('s10', '10', 0, 0, [], { initial: true }),
        trans('t10', 'Emergencia', 0, 100),
        step('s11', '11', 0, 170, ['F/G2{}', 'Alarma']),
        trans('t11', 'Rearme · !Emergencia', 0, 270),
        step('s12', '12', 0, 340, ['F/G2{INIT}']),
        trans('t12', '1', 0, 440),
        frame('g2', 'G2', 'grafcet', 420, -40, 340, 560),
        step('s0', '0', 460, 0, [], { initial: true }),
        trans('t1', 'Marcha', 460, 100),
        step('s1', '1', 460, 170, ['Avanzar']),
        trans('t2', 'Fc_delante', 460, 270),
        step('s2', '2', 460, 340, ['Retroceder']),
        trans('t3', 'Fc_detras', 460, 440),
        note(
          'nota',
          800,
          0,
          'Paro de emergencia\n\nG1 vigila la seguridad. Con Emergencia, la etapa 11 ordena F/G2{}: la producción (G2) se queda sin ninguna etapa activa y no evoluciona.\n\nCon Rearme (y sin emergencia), la etapa 12 ordena F/G2{INIT}: G2 vuelve a su situación inicial.',
          { width: 300, height: 260 },
        ),
      ]
      const edges = links([
        ['s10', 't10'],
        ['t10', 's11'],
        ['s11', 't11'],
        ['t11', 's12'],
        ['s12', 't12'],
        ['t12', 's10'],
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's0'],
      ])
      return { nodes, edges }
    },
  },
  {
    id: 'macroetapa',
    title: 'Dosificadora (macroetapa)',
    description: 'La macroetapa M1 se detalla en su expansión, de la etapa de entrada E1 a la de salida S1.',
    tags: ['Macroetapa', 'Temporización'],
    build() {
      const nodes = [
        step('s0', '0', 0, 0, [], { initial: true }),
        trans('t1', 'Marcha', 0, 100),
        step('m1', 'M1', 0, 170, [], { macro: true }),
        trans('t2', 'Retirar', 0, 270),
        step('s2', '2', 0, 340, ['Expulsar']),
        trans('t3', 'Fc_expulsion', 0, 440),
        frame('fm1', 'M1', 'macro', 340, -40, 360, 460),
        step('e1', 'E1', 380, 0, ['Llenar']),
        trans('t11', 'Nivel', 380, 100),
        step('s11', '11', 380, 170, ['Calentar']),
        trans('t12', '20s/X11', 380, 270),
        step('x1', 'S1', 380, 340, ['Listo']),
        note(
          'nota',
          760,
          0,
          'Macroetapa\n\nAl activarse M1 se activa su etapa de entrada E1. La transición que sigue a M1 (Retirar) solo puede franquearse cuando está activa la etapa de salida S1.',
          { width: 280, height: 200 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 'm1'],
        ['m1', 't2'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's0'],
        ['e1', 't11'],
        ['t11', 's11'],
        ['s11', 't12'],
        ['t12', 'x1'],
      ])
      return { nodes, edges }
    },
  },
]
