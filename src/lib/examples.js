// Ejemplos de grafcet listos para abrir (diálogo Abrir > Ejemplos). Todos son conformes a
// IEC 60848 y simulables; las pruebas (tests/unit/examples.test.js) lo comprueban.
// Coordenadas en la cuadrícula del editor: etapa -> transición +100 px, transición -> etapa +70 px.

import { NOTE_SIZE } from './notes'

const step = (id, label, x, y, actions = [], extra = {}) => ({ id, type: 'step', position: { x, y }, data: { label, actions, ...extra } })
const trans = (id, condition, x, y) => ({ id, type: 'transition', position: { x, y }, data: { condition } })
const note = (id, x, y, text, size = {}) => ({ id, type: 'note', position: { x, y }, data: { text, color: 'yellow' }, ...NOTE_SIZE, ...size })
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
    tags: ['Divergencia en O', 'Divergencia en Y', 'Temporización'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        trans('t7', 'Limpieza', 680, 100),
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
        step('s7', '7', 680, 170, ['Lavar']),
        trans('t8', 'Fin_lavado', 680, 270),
        note(
          'nota',
          920,
          0,
          'Mezcladora\n\nEn 0 se elige (divergencia en O): Marcha para producir o Limpieza para lavar.\n\nAl producir, A y B se llenan a la vez (divergencia en Y) y se mezcla cuando ambos están llenos (convergencia en Y).',
          { width: 260, height: 190 },
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
]
