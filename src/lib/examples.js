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

// Niveles de los ejemplos (de lo más sencillo a lo más completo): el diálogo los agrupa así.
export const LEVELS = [
  { id: 1, title: 'Primeros pasos' },
  { id: 2, title: 'Secuencias' },
  { id: 3, title: 'Elegir y hacer a la vez' },
  { id: 4, title: 'Estructurar el automatismo' },
  { id: 5, title: 'Proceso e integración' },
]

export const EXAMPLES = [
  {
    id: 'marcha-paro',
    level: 1,
    title: 'Marcha y paro de un motor',
    description: 'La primera etapa y la primera transición: arrancar con Marcha y parar con un pulsador normalmente cerrado.',
    tags: ['Lineal', 'Contacto NC', 'Planta'],
    build() {
      const { nodes, edges } = cycle([{ actions: [] }, 'Marcha', { actions: ['Motor', 'Piloto'] }, '!Paro'])
      nodes.push(
        note(
          'nota',
          520,
          0,
          '# Marcha y paro de un motor\n**Nivel 1.** Lo más básico: una etapa de reposo (0) y una de trabajo (1) con acciones continuas.\n\n- **Paro** es un pulsador **NC** (normalmente cerrado), como en los cuadros reales: sin pulsar da 1, así que la transición es `!Paro` (se cumple al pulsarlo).\n- Entradas: `Marcha` (NA), `Paro` (NC)\n- Salidas: `Motor`, `Piloto`\n\nPruébalo: **Simular** y usa los pulsadores del pupitre.',
          { width: 320, height: 300 },
        ),
      )
      const scene = {
        elements: [
          { id: 'motor', type: 'motor', x: 220, y: 120, rot: 0, variable: 'Motor', reverse: '', pulses: '', text: 'Motor' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'paro', type: 'button', x: 0, y: 0, rot: 0, variable: 'Paro', contact: 'NC', color: 'red', text: 'Paro', place: 'desk' },
          { id: 'piloto', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Piloto', color: 'green', text: 'En marcha', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'contador',
    level: 1,
    title: 'Contar pulsaciones',
    description: 'Flancos y acciones memorizadas: a la tercera pulsación se enciende una luz.',
    tags: ['Flanco', 'Contador', 'Divergencia en O', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [{ text: 'C:=0', kind: 'stored-on' }], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        step('s1', '1', 200, 170),
        // Elección excluyente: contar (C < 2) o la tercera pulsación (C >= 2).
        trans('t2', '↑P · C < 2', 200, 270),
        trans('t4', '↑P · C >= 2', 440, 270),
        step('s2', '2', 200, 340, [{ text: 'C:=C+1', kind: 'stored-on' }]),
        trans('t3', '1', 200, 440),
        step('s3', '3', 440, 340, ['Luz']),
        trans('t5', 'Reset', 440, 440),
        note(
          'nota',
          640,
          0,
          '# Contar pulsaciones\n**Nivel 1.** Cada pulsación de `P` suma 1 al contador `C` (acción memorizada al activar la etapa 2). A la tercera, se enciende `Luz`.\n\n- `↑P` es un **flanco**: solo cuenta el instante en que se pulsa, no mientras se mantiene.\n- La etapa 2 dura un instante (receptividad `1`): su acción es memorizada, así que se ejecuta igual.\n- Entradas: `Marcha`, `P`, `Reset` · Salida: `Luz` · Contador: `C`\n\nPruébalo: **Simular**, Marcha y pulsa P tres veces; el visualizador muestra C.',
          { width: 330, height: 360 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['s1', 't4'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's1'],
        ['t4', 's3'],
        ['s3', 't5'],
        ['t5', 's0'],
      ])
      const scene = {
        elements: [
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'p', type: 'button', x: 0, y: 0, rot: 0, variable: 'P', contact: 'NO', color: 'black', text: 'P', place: 'desk' },
          { id: 'reset', type: 'button', x: 0, y: 0, rot: 0, variable: 'Reset', contact: 'NO', color: 'blue', text: 'Reset', place: 'desk' },
          { id: 'c', type: 'display', x: 0, y: 0, rot: 0, variable: 'C', text: 'C', place: 'desk' },
          { id: 'luz', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Luz', color: 'yellow', text: 'Luz', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'garaje',
    level: 2,
    title: 'Puerta de garaje',
    description: 'Secuencia con temporización y seguridad: la fotocélula vuelve a abrir la puerta si hay un obstáculo.',
    tags: ['Divergencia en O', 'Temporización', 'Seguridad', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Abrir · Cerrada', 200, 100),
        step('s1', '1', 200, 170, ['Subir', 'Luz']),
        trans('t2', 'Abierta', 200, 270),
        step('s2', '2', 200, 340, ['Luz']),
        trans('t3', '5s/X2 · !Foto', 200, 440),
        step('s3', '3', 200, 510, ['Bajar', 'Luz']),
        // Elección excluyente: terminar de cerrar o, con obstáculo, volver a abrir.
        trans('t4', 'Cerrada · !Foto', 200, 610),
        trans('t5', 'Foto', 440, 610),
        note(
          'nota',
          640,
          0,
          '# Puerta de garaje\n**Nivel 2.** Abre con **Abrir**, espera 5 s abierta y cierra. Si la **fotocélula** ve un obstáculo mientras cierra, vuelve a abrir (seguridad).\n\n- La puerta es un cilindro vertical: sube (`Subir`) y baja (`Bajar`), con `Abierta` y `Cerrada` como finales de carrera.\n- Entradas: `Abrir`, `Abierta`, `Cerrada`, `Foto` · Salidas: `Subir`, `Bajar`, `Luz`\n\nPruébalo: **Simular**, pulsa Abrir y, mientras baja, pulsa el alimentador para poner un coche en la puerta.',
          { width: 330, height: 340 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's3'],
        ['s3', 't4'],
        ['s3', 't5'],
        ['t4', 's0'],
        ['t5', 's1'],
      ])
      const scene = {
        elements: [
          { id: 'puerta', type: 'cylinder', x: 300, y: 260, rot: 270, extend: 'Subir', retract: 'Bajar', retracted: 'Cerrada', extended: 'Abierta', stroke: 120, time: 2, text: 'Puerta' },
          { id: 'coche', type: 'feeder', x: 300, y: 300, rot: 0, trigger: '', auto: false, spacing: 0, sizes: 'large', material: 'metal', color: 'amber' },
          { id: 'foto', type: 'sensor', x: 200, y: 300, rot: 0, variable: 'Foto', contact: 'NO', range: 200, kind: 'optical', color: 'amber' },
          { id: 'abrir', type: 'button', x: 0, y: 0, rot: 0, variable: 'Abrir', contact: 'NO', color: 'green', text: 'Abrir', place: 'desk' },
          { id: 'luz', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Luz', color: 'yellow', text: 'Luz de aviso', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'taladradora',
    level: 2,
    title: 'Taladradora',
    description: 'Secuencia lineal con temporización: bajar taladrando, repasar 2 s y subir.',
    tags: ['Lineal', 'Temporización', 'Bucle', 'Planta'],
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
        note(
          'nota',
          520,
          0,
          '# Taladradora\nCon pieza y **Marcha**, la broca baja girando hasta su final de carrera, repasa 2 s y sube.\n\n- Entradas: `Marcha`, `Pieza`, `Fc_abajo`, `Fc_arriba`\n- Salidas: `Motor_broca`, `Bajar`, `Subir`\n\nPruébalo: **Simular**, activa «Pieza colocada» y pulsa Marcha.',
          { width: 300, height: 250 },
        ),
      )
      // Planta virtual: mandos, el motor de la broca y la broca como un cilindro vertical.
      const scene = {
        elements: [
          { id: 'marcha', type: 'button', x: 80, y: 80, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha' },
          { id: 'pieza', type: 'switch', x: 80, y: 180, rot: 0, variable: 'Pieza', contact: 'NO', text: 'Pieza colocada' },
          { id: 'motor', type: 'motor', x: 300, y: 50, rot: 0, variable: 'Motor_broca', reverse: '', text: 'Motor broca' },
          { id: 'broca', type: 'cylinder', x: 300, y: 100, rot: 90, extend: 'Bajar', retract: 'Subir', retracted: 'Fc_arriba', extended: 'Fc_abajo', stroke: 120, time: 1.5, text: 'Broca' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'cilindros',
    level: 2,
    title: 'Cilindros A+ B+ A− B−',
    description: 'Secuencia neumática clásica con finales de carrera a0/a1 y b0/b1.',
    tags: ['Lineal', 'Neumática', 'Planta'],
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
      nodes.push(
        note(
          'nota',
          520,
          0,
          '# Secuencia A+ B+ A− B−\nCada movimiento empieza cuando el anterior llega a su final de carrera (detectores `a0`, `a1`, `b0`, `b1`).\n\n- Entradas: `Marcha` y los cuatro detectores\n- Salidas: `A+`, `A-`, `B+`, `B-` (cilindros de doble efecto)\n\nPruébalo: **Simular** y pulsa Marcha en la planta.',
          { width: 300, height: 250 },
        ),
      )
      const cylinder = (n, x, y, rot) => ({
        id: n,
        type: 'cylinder',
        x,
        y,
        rot,
        text: n,
        extend: `${n}+`,
        retract: `${n}-`,
        retracted: `${n.toLowerCase()}0`,
        extended: `${n.toLowerCase()}1`,
        stroke: 100,
        time: 1,
      })
      const scene = {
        elements: [
          { id: 'marcha', type: 'button', x: 80, y: 100, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha' },
          cylinder('A', 200, 100, 0),
          cylinder('B', 520, 60, 90),
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'pickplace',
    level: 2,
    title: 'Pick & place',
    description: 'Dos cilindros (X horizontal, Z vertical montado en su vástago) y una ventosa: coger una pieza y dejarla en otro sitio.',
    tags: ['Lineal', 'Neumática', 'Planta'],
    build() {
      const { nodes, edges } = cycle([
        { actions: [] },
        'Marcha · x0 · z0',
        { actions: ['Z+', 'V'] },
        'Cogida',
        { actions: ['Z-', 'V'] },
        'z0',
        { actions: ['X+', 'V'] },
        'x1',
        { actions: ['Z+', 'V'] },
        'z1',
        { actions: [] },
        '!Cogida',
        { actions: ['Z-'] },
        'z0',
        { actions: ['X-'] },
        'x0',
      ])
      nodes.push(
        note(
          'nota',
          520,
          0,
          '# Pick & place\nZ baja con vacío (`V`) hasta coger la pieza (`Cogida`), sube, X la lleva, Z baja y la suelta (sin vacío), sube y X vuelve.\n\n- Entradas: `Marcha`, `x0`, `x1`, `z0`, `z1`, `Cogida`\n- Salidas: `X+`, `X-`, `Z+`, `Z-`, `V`\n\nPruébalo: **Simular** y pulsa Marcha en el pupitre.',
          { width: 300, height: 250 },
        ),
      )
      const scene = {
        elements: [
          { id: 'marcha', type: 'button', x: 60, y: 60, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'X', type: 'cylinder', x: 100, y: 100, rot: 0, extend: 'X+', retract: 'X-', retracted: 'x0', extended: 'x1', stroke: 160, time: 1, text: 'X' },
          { id: 'Z', type: 'cylinder', x: 188, y: 100, rot: 90, extend: 'Z+', retract: 'Z-', retracted: 'z0', extended: 'z1', vacuum: 'V', holding: 'Cogida', mountedOn: 'X', stroke: 80, time: 0.5, text: 'Z' },
          { id: 'almacen', type: 'feeder', x: 188, y: 276, rot: 0, trigger: '', auto: true, sizes: 'small', material: 'plastic', color: 'amber' },
          { id: 'destino', type: 'sink', x: 348, y: 276, rot: 0, text: 'Destino' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'clasificadora',
    level: 3,
    title: 'Clasificadora por material',
    description: 'Cinta, detector inductivo y desviador: el metal sale a un lado y el plástico sigue hasta el final.',
    tags: ['Divergencia en O', 'Temporización', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        step('s1', '1', 200, 170, ['M']),
        // Elección excluyente: una pieza de metal (con la cinta en marcha) o parar.
        trans('t2', '↑Metal · Marcha', 200, 270),
        trans('t4', '!Marcha', 440, 270),
        step('s2', '2', 200, 340, ['M', 'D']),
        trans('t3', '1.5s/X2', 200, 440),
        note(
          'nota',
          560,
          0,
          '# Clasificadora por material\nCon **Marcha** la cinta lleva las piezas; el detector inductivo (`Metal`) solo ve las de metal y el desviador (`D`) las saca a su recogida. Las de plástico siguen hasta el final.\n\n- Entradas: `Marcha` (interruptor), `Metal`\n- Salidas: `M` (cinta), `D` (desviador)\n\nPruébalo: **Simular** y activa Marcha en el pupitre.',
          { width: 300, height: 280 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['s1', 't4'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's1'],
        ['t4', 's0'],
      ])
      const scene = {
        elements: [
          { id: 'cinta', type: 'conveyor', x: 40, y: 200, rot: 0, motor: 'M', length: 520, time: 5, text: 'Cinta' },
          { id: 'alimentador', type: 'feeder', x: 70, y: 200, rot: 0, trigger: '', auto: true, spacing: 200, sizes: 'small', material: 'mixed', color: 'amber' },
          { id: 'inductivo', type: 'sensor', x: 250, y: 230, rot: 270, variable: 'Metal', contact: 'NO', kind: 'inductive', range: 20, color: 'amber' },
          { id: 'desviador', type: 'diverter', x: 330, y: 200, rot: 90, gate: 'D', length: 80, time: 0.5, text: 'Desviador' },
          { id: 'rampa', type: 'ramp', x: 330, y: 280, rot: 90, length: 80, time: 0.6, text: '' },
          { id: 'metal', type: 'sink', x: 330, y: 390, rot: 0, text: 'Metal' },
          { id: 'plastico', type: 'sink', x: 590, y: 200, rot: 0, text: 'Plástico' },
          { id: 'marcha', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', text: 'Marcha', place: 'desk' },
          { id: 'luz', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'M', color: 'green', text: 'Cinta en marcha', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'semaforo',
    level: 1,
    title: 'Semáforo',
    description: 'Ciclo cerrado solo con temporizaciones: rojo 10 s, verde 8 s, ámbar 3 s.',
    tags: ['Temporización', 'Bucle', 'Planta'],
    build() {
      const { nodes, edges } = cycle([{ actions: ['Rojo'] }, '10s/X0', { actions: ['Verde'] }, '8s/X1', { actions: ['Ámbar'] }, '3s/X2'])
      nodes.push(
        note(
          'nota',
          520,
          0,
          '# Semáforo\nCada etapa enciende una luz; la temporización de la etapa activa pasa a la siguiente.\n\n- Salidas: `Rojo`, `Verde`, `Ámbar`\n\nPruébalo: **Simular** y mira la planta.',
          { width: 300, height: 250 },
        ),
      )
      const lamp = (id, variable, color, y) => ({ id, type: 'lamp', x: 160, y, rot: 0, variable, color, text: variable })
      const scene = { elements: [lamp('rojo', 'Rojo', 'red', 80), lamp('ambar', 'Ámbar', 'yellow', 140), lamp('verde', 'Verde', 'green', 200)] }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'mezcladora',
    level: 3,
    title: 'Mezcladora',
    description: 'Divergencia en O (producción o limpieza) y en Y (llenado simultáneo de dos depósitos).',
    // La rama de limpieza va a la izquierda: su bucle vuelve por la izquierda sin cruzar las demás.
    tags: ['Divergencia en O', 'Divergencia en Y', 'Temporización', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        // Elección excluyente (IEC 60848): la limpieza solo si no se pide producir a la vez.
        trans('t7', 'Limpieza · !Marcha', -40, 100),
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
          '# Mezcladora\nEn 0 se elige (divergencia en O): **Marcha** para producir o **Limpieza** para lavar.\n\nAl producir, A y B se llenan a la vez (divergencia en Y) y se mezcla cuando ambos están llenos (convergencia en Y).\n\n- Entradas: `Marcha`, `Limpieza`, `Nivel_A`, `Nivel_B`, `Vacio`, `Fin_lavado`\n- Salidas: `Llenar_A`, `Llenar_B`, `Mezclar`, `Vaciar`, `Lavar`\n\nPruébalo: **Simular** (sube la velocidad: la mezcla dura 30 s).',
          { width: 320, height: 340 },
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
      const tank = (id, x, fill, high, extra = {}) => ({
        id,
        type: 'tank',
        x,
        y: 60,
        rot: 0,
        fill,
        drain: 'Vaciar',
        low: '',
        high,
        empty: '',
        level: '',
        fillTime: 4,
        drainTime: 3,
        initial: 0,
        text: id === 'A' ? 'Depósito A' : 'Depósito B',
        ...extra,
      })
      const scene = {
        elements: [
          tank('A', 60, 'Llenar_A', 'Nivel_A', { empty: 'Vacio' }),
          tank('B', 240, 'Llenar_B', 'Nivel_B', { fillTime: 6 }),
          { id: 'agitador', type: 'motor', x: 200, y: 290, rot: 0, variable: 'Mezclar', reverse: '', text: 'Agitador' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'limpieza', type: 'button', x: 0, y: 0, rot: 0, variable: 'Limpieza', contact: 'NO', color: 'blue', text: 'Limpieza', place: 'desk' },
          { id: 'lavar', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Lavar', color: 'blue', text: 'Lavando', place: 'desk' },
          { id: 'fin', type: 'button', x: 0, y: 0, rot: 0, variable: 'Fin_lavado', contact: 'NO', color: 'black', text: 'Fin lavado', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'emergencia',
    level: 4,
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
    level: 4,
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
