// Ejemplos de grafcet listos para abrir (diálogo Abrir > Ejemplos). Todos son conformes a
// IEC 60848 y simulables; las pruebas (tests/unit/examples.test.js) lo comprueban.
// Coordenadas en la cuadrícula del editor: etapa -> transición +100 px, transición -> etapa +70 px.

import { NOTE_SIZE } from './notes'
import { EMPTY_PLC, autoAssign } from './addressing'
import { projectVariables } from './symbols'
import { EXAMPLE_COMMENTS } from './exampleComments'

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
          '# Marcha y paro de un motor\n**Nivel 1.** Lo más básico: una etapa de reposo (0) y una de trabajo (1) con acciones continuas.\n\n- **Paro** es un pulsador **NC** (normalmente cerrado), como en los cuadros reales: sin pulsar da 1, así que la transición es `!Paro` (se cumple al pulsarlo).\n- Entradas: `Marcha` (NA), `Paro` (NC)\n- Salidas: `Motor`, `Piloto`\n\nPruébalo: **Simular** y usa los pulsadores del panel.',
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
          '# Puerta de garaje\n**Nivel 2.** Abre con **Abrir**, espera 5 s abierta y cierra. Si la **fotocélula** ve un obstáculo mientras cierra, vuelve a abrir (seguridad).\n\n- La puerta es un cilindro vertical: sube (`Subir`) y baja (`Bajar`), con `Abierta` y `Cerrada` como finales de carrera.\n- Entradas: `Abrir`, `Abierta`, `Cerrada`, `Foto` · Salidas: `Subir`, `Bajar`, `Luz`\n\nPruébalo: **Simular**, pulsa Abrir y, mientras baja, pulsa **Poner coche** en el panel de control.',
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
          { id: 'coche', type: 'feeder', x: 300, y: 300, rot: 0, trigger: 'Poner_coche', auto: false, spacing: 0, sizes: 'large', material: 'metal', color: 'amber' },
          { id: 'foto', type: 'sensor', x: 200, y: 300, rot: 0, variable: 'Foto', contact: 'NO', range: 200, kind: 'optical', color: 'amber' },
          { id: 'abrir', type: 'button', x: 0, y: 0, rot: 0, variable: 'Abrir', contact: 'NO', color: 'green', text: 'Abrir', place: 'desk' },
          { id: 'luz', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Luz', color: 'yellow', text: 'Luz de aviso', place: 'desk' },
          // Solo para la planta: suelta un coche delante de la puerta (no lo usa el grafcet).
          { id: 'poner', type: 'button', x: 0, y: 0, rot: 0, variable: 'Poner_coche', contact: 'NO', color: 'yellow', text: 'Poner coche', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene, variables: { Poner_coche: { type: 'input', comment: 'Planta virtual: poner un coche en la puerta' } } } }
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
          '# Pick & place\nZ baja con vacío (`V`) hasta coger la pieza (`Cogida`), sube, X la lleva, Z baja y la suelta (sin vacío), sube y X vuelve.\n\n- Entradas: `Marcha`, `x0`, `x1`, `z0`, `z1`, `Cogida`\n- Salidas: `X+`, `X-`, `Z+`, `Z-`, `V`\n\nPruébalo: **Simular** y pulsa Marcha en el panel.',
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
          '# Clasificadora por material\nCon **Marcha** la cinta lleva las piezas; el detector inductivo (`Metal`) solo ve las de metal y el desviador (`D`) las saca a su recogida. Las de plástico siguen hasta el final.\n\n- Entradas: `Marcha` (interruptor), `Metal`\n- Salidas: `M` (cinta), `D` (desviador)\n\nPruébalo: **Simular** y activa Marcha en el panel.',
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
    id: 'clasificadora-tamano',
    level: 3,
    title: 'Clasificadora por tamaño y material',
    description: 'Tres caminos: el metal se rechaza, el plástico grande sale por un segundo desviador y el pequeño sigue hasta el final.',
    tags: ['Divergencia en O', 'Temporización', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        step('s1', '1', 200, 170, ['M']),
        // Elección excluyente entre tres caminos (el metal tiene prioridad sobre el tamaño).
        trans('t2', '↑Metal · Marcha', 200, 270),
        trans('t4', '↑Grande · !Metal · Marcha', 440, 270),
        trans('t6', '!Marcha', 680, 270),
        step('s2', '2', 200, 340, ['M', 'D1']),
        trans('t3', '1.5s/X2', 200, 440),
        step('s3', '3', 440, 340, ['M', 'D2']),
        trans('t5', '1.5s/X3', 440, 440),
        note(
          'nota',
          880,
          0,
          '# Clasificadora por tamaño y material\n**Nivel 3.** Una divergencia en O con tres caminos excluyentes: rechazar el metal (`D1`), sacar el plástico grande (`D2`) o parar.\n\n- **Metal**: detector inductivo. **Grande**: detector óptico alto, que solo alcanza a las piezas grandes.\n- El metal tiene prioridad: el segundo camino lleva `!Metal` para que las dos elecciones no puedan cumplirse a la vez.\n- Mientras se desvía una pieza (etapas 2 o 3) no se atiende otra: por eso las piezas vienen separadas. Prueba a juntarlas (alimentador, «Hueco») y verás piezas mal clasificadas.\n- Entradas: `Marcha`, `Metal`, `Grande` · Salidas: `M`, `D1`, `D2`\n\nPruébalo: **Simular**, Marcha y mira cómo se reparten.',
          { width: 340, height: 430 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['s1', 't4'],
        ['s1', 't6'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's1'],
        ['t4', 's3'],
        ['s3', 't5'],
        ['t5', 's1'],
        ['t6', 's0'],
      ])
      const sink = (id, x, y, text) => ({ id, type: 'sink', x, y, rot: 0, text })
      const scene = {
        elements: [
          { id: 'cinta', type: 'conveyor', x: 40, y: 200, rot: 0, motor: 'M', length: 720, time: 7.2, text: 'Cinta' },
          { id: 'alimentador', type: 'feeder', x: 70, y: 200, rot: 0, trigger: '', auto: true, spacing: 400, sizes: 'mixed', material: 'mixed', color: 'blue' },
          { id: 'inductivo', type: 'sensor', x: 250, y: 230, rot: 270, variable: 'Metal', contact: 'NO', kind: 'inductive', range: 20, color: 'amber' },
          { id: 'd1', type: 'diverter', x: 330, y: 200, rot: 90, gate: 'D1', length: 80, time: 0.5, text: 'D1' },
          { id: 'r1', type: 'ramp', x: 330, y: 280, rot: 90, length: 80, time: 0.6, text: '' },
          sink('rechazo', 330, 390, 'Rechazo (metal)'),
          // Detector alto: su haz pasa por encima de las piezas pequeñas.
          { id: 'altura', type: 'sensor', x: 420, y: 180, rot: 0, variable: 'Grande', contact: 'NO', kind: 'optical', range: 30, color: 'amber' },
          { id: 'd2', type: 'diverter', x: 510, y: 200, rot: 90, gate: 'D2', length: 80, time: 0.5, text: 'D2' },
          { id: 'r2', type: 'ramp', x: 510, y: 280, rot: 90, length: 80, time: 0.6, text: '' },
          sink('grandes', 510, 390, 'Grandes'),
          sink('pequenas', 790, 200, 'Pequeñas'),
          { id: 'marcha', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', text: 'Marcha', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'ascensor',
    level: 3,
    title: 'Ascensor de 3 plantas',
    description: 'Elegir el movimiento según la llamada y la planta en la que está la cabina.',
    tags: ['Divergencia en O', 'Prioridades', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 440, 0, [], { initial: true }),
        // Prioridades para que las elecciones sean excluyentes: L0, luego L2, luego L1.
        trans('t1', 'L0 · !P0', 200, 100),
        trans('t3', 'L2 · !P2 · !L0', 440, 100),
        trans('t5', 'L1 · P0 · !L0 · !L2', 680, 100),
        trans('t7', 'L1 · P2 · !P0 · !L0 · !L2', 920, 100),
        step('s1', '1', 200, 170, ['Bajar']),
        trans('t2', 'P0', 200, 270),
        step('s3', '3', 440, 170, ['Subir']),
        trans('t4', 'P2', 440, 270),
        step('s2', '2', 680, 170, ['Subir']),
        trans('t6', 'P1', 680, 270),
        step('s4', '4', 920, 170, ['Bajar']),
        trans('t8', 'P1', 920, 270),
        note(
          'nota',
          1120,
          0,
          '# Ascensor de 3 plantas\n**Nivel 3.** Desde el reposo se elige un movimiento según la llamada (`L0`, `L1`, `L2`) y la planta donde está la cabina (`P0`, `P1`, `P2`).\n\n- Si se llama a la vez desde dos plantas, **prioridades**: planta 0, luego 2, luego 1 (las receptividades llevan `!L0`, `!L2` para ser excluyentes).\n- La cabina es un cilindro vertical; los finales de carrera de cada planta los pisa al pasar.\n- Entradas: `L0`, `L1`, `L2`, `P0`, `P1`, `P2` · Salidas: `Subir`, `Bajar`\n\nPruébalo: **Simular** y llama desde el panel.',
          { width: 340, height: 380 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['s0', 't3'],
        ['s0', 't5'],
        ['s0', 't7'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's0'],
        ['t3', 's3'],
        ['s3', 't4'],
        ['t4', 's0'],
        ['t5', 's2'],
        ['s2', 't6'],
        ['t6', 's0'],
        ['t7', 's4'],
        ['s4', 't8'],
        ['t8', 's0'],
      ])
      // Cabina: cilindro vertical (carrera 200: planta 0 abajo, 1 en medio, 2 arriba). Los finales
      // de carrera están a la altura de la cabina en cada planta.
      const floor = (id, variable, y) => ({ id, type: 'limit', x: 300, y, rot: 0, variable, contact: 'NO', text: '' })
      const call = (id, variable, color) => ({ id, type: 'button', x: 0, y: 0, rot: 0, variable, contact: 'NO', color, text: `Llamar ${variable.slice(1)}`, place: 'desk' })
      const scene = {
        elements: [
          { id: 'cabina', type: 'cylinder', x: 300, y: 420, rot: 270, extend: 'Subir', retract: 'Bajar', retracted: '', extended: '', stroke: 200, time: 4, text: 'Cabina' },
          floor('p0', 'P0', 352),
          floor('p1', 'P1', 252),
          floor('p2', 'P2', 152),
          call('l0', 'L0', 'green'),
          call('l1', 'L1', 'green'),
          call('l2', 'L2', 'green'),
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'doble-puesto',
    level: 3,
    title: 'Estación de doble puesto',
    description: 'Taladrar y marcar a la vez (divergencia en Y) y seguir cuando los dos han terminado (convergencia en Y).',
    tags: ['Divergencia en Y', 'Neumática', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha · t0 · k0', 320, 100),
        step('s1', '1', 200, 170, ['T+', 'Broca']),
        trans('t2', 't1', 200, 270),
        step('s2', '2', 200, 340, ['T-']),
        trans('t3', 't0', 200, 440),
        step('s3', '3', 200, 510),
        step('s4', '4', 440, 170, ['K+']),
        trans('t4', 'k1', 440, 270),
        step('s5', '5', 440, 340, ['K-']),
        trans('t5', 'k0', 440, 440),
        step('s6', '6', 440, 510),
        trans('t6', '1', 320, 610),
        note(
          'nota',
          640,
          0,
          '# Estación de doble puesto\n**Nivel 3.** Al dar **Marcha** empiezan a la vez dos secuencias (divergencia en **Y**): taladrar (`T`) y marcar (`K`). Cada una termina en una etapa de espera (3 y 6); cuando las dos han acabado, la convergencia en **Y** vuelve al reposo.\n\n- Entradas: `Marcha`, `t0`, `t1`, `k0`, `k1` · Salidas: `T+`, `T-`, `Broca`, `K+`, `K-`\n- El marcado es más rápido: espera en la etapa 6 a que termine el taladro.\n\nPruébalo: **Simular** y pulsa Marcha.',
          { width: 330, height: 340 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['t1', 's4'],
        ['s1', 't2'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's3'],
        ['s4', 't4'],
        ['t4', 's5'],
        ['s5', 't5'],
        ['t5', 's6'],
        ['s3', 't6'],
        ['s6', 't6'],
        ['t6', 's0'],
      ])
      const scene = {
        elements: [
          { id: 'broca', type: 'motor', x: 160, y: 40, rot: 0, variable: 'Broca', reverse: '', pulses: '', text: 'Broca' },
          { id: 'T', type: 'cylinder', x: 160, y: 80, rot: 90, extend: 'T+', retract: 'T-', retracted: 't0', extended: 't1', stroke: 100, time: 2, text: 'Taladro' },
          { id: 'K', type: 'cylinder', x: 360, y: 80, rot: 90, extend: 'K+', retract: 'K-', retracted: 'k0', extended: 'k1', stroke: 100, time: 0.8, text: 'Marcado' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
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
    tags: ['Grafcets parciales', 'Forzado', 'Planta'],
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
          '# Paro de emergencia\n**Nivel 4.** G1 vigila la seguridad. Con `Emergencia`, la etapa 11 ordena **F/G2{}**: la producción (G2) se queda sin etapas activas y no evoluciona.\n\nCon `Rearme` (y sin emergencia), la etapa 12 ordena **F/G2{INIT}**: G2 vuelve a su situación inicial.\n\n- Entradas: `Marcha`, `Emergencia`, `Rearme`, `Fc_delante`, `Fc_detras`\n- Salidas: `Avanzar`, `Retroceder`, `Alarma`\n\nPruébalo: **Simular**, Marcha y pulsa Emergencia a mitad de ciclo.',
          { width: 330, height: 380 },
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
      const scene = {
        elements: [
          { id: 'carro', type: 'cylinder', x: 120, y: 140, rot: 0, extend: 'Avanzar', retract: 'Retroceder', retracted: 'Fc_detras', extended: 'Fc_delante', stroke: 160, time: 2, text: 'Carro' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'emergencia', type: 'button', x: 0, y: 0, rot: 0, variable: 'Emergencia', contact: 'NO', color: 'red', text: 'Emergencia', place: 'desk' },
          { id: 'rearme', type: 'button', x: 0, y: 0, rot: 0, variable: 'Rearme', contact: 'NO', color: 'blue', text: 'Rearme', place: 'desk' },
          { id: 'alarma', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Alarma', color: 'red', text: 'Alarma', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'manual-auto',
    level: 4,
    title: 'Manual / Automático',
    description: 'Un grafcet de conducción elige el modo: en manual mueve el cilindro con pulsadores y mantiene la producción en su inicio.',
    tags: ['Grafcets parciales', 'Forzado', 'Acción condicionada', 'Planta'],
    build() {
      const cond = (text, condition) => ({ text, kind: 'conditional', condition })
      const nodes = [
        frame('gc', 'GC', 'grafcet', -40, -40, 380, 460),
        step('s20', '20', 0, 0, ['F/GP{INIT}', cond('A+', 'Avanzar · !a1'), cond('A-', 'Retroceder · !a0')], { initial: true }),
        trans('t20', 'Auto · a0', 0, 100),
        step('s21', '21', 0, 170, ['Luz_auto']),
        // Al volver a manual, solo con la producción en reposo (fin de ciclo).
        trans('t21', '!Auto · X0', 0, 270),
        frame('gp', 'GP', 'grafcet', 420, -40, 320, 560),
        step('s0', '0', 460, 0, [], { initial: true }),
        trans('t1', 'Ciclo · a0', 460, 100),
        step('s1', '1', 460, 170, ['A+']),
        trans('t2', 'a1', 460, 270),
        step('s2', '2', 460, 340, ['A-']),
        trans('t3', 'a0', 460, 440),
        note(
          'nota',
          800,
          0,
          '# Manual / Automático\n**Nivel 4.** Dos grafcets parciales: **GC** (conducción) y **GP** (producción).\n\n- **Manual** (etapa 20): GC fuerza a GP a su inicio (**F/GP{INIT}**) y mueve el cilindro con **acciones condicionadas**: `A+` si `Avanzar`, `A-` si `Retroceder`.\n- **Automático** (etapa 21): GP hace un ciclo con cada `Ciclo`.\n- Se vuelve a manual solo con GP en reposo (`X0`): nunca a mitad de ciclo.\n- Entradas: `Auto`, `Ciclo`, `Avanzar`, `Retroceder`, `a0`, `a1` · Salidas: `A+`, `A-`, `Luz_auto`\n\nPruébalo: **Simular**; en manual, mueve el cilindro; pasa a Auto y pulsa Ciclo.',
          { width: 340, height: 420 },
        ),
      ]
      const edges = links([
        ['s20', 't20'],
        ['t20', 's21'],
        ['s21', 't21'],
        ['t21', 's20'],
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's0'],
      ])
      const desk = (id, type, variable, color, text) => ({ id, type, x: 0, y: 0, rot: 0, variable, contact: 'NO', color, text, place: 'desk' })
      const scene = {
        elements: [
          { id: 'A', type: 'cylinder', x: 120, y: 140, rot: 0, extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1', stroke: 140, time: 1.5, text: 'A' },
          desk('auto', 'switch', 'Auto', 'green', 'Manual / Auto'),
          desk('ciclo', 'button', 'Ciclo', 'green', 'Ciclo'),
          desk('avanzar', 'button', 'Avanzar', 'black', 'Avanzar'),
          desk('retroceder', 'button', 'Retroceder', 'black', 'Retroceder'),
          desk('luz', 'lamp', 'Luz_auto', 'green', 'Automático'),
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'gemma-linea',
    level: 4,
    title: 'Línea con GEMMA',
    description: 'Conducción según la guía GEMMA: marcha, paro a fin de ciclo, emergencia con defecto y rearme a la posición inicial.',
    tags: ['GEMMA', 'Grafcets parciales', 'Forzado', 'Planta'],
    build() {
      const nodes = [
        frame('gc', 'GC', 'grafcet', -40, -40, 680, 880),
        step('s20', '20', 0, 0, [], { initial: true }),
        trans('t20', 'Marcha · Seta_ok', 0, 100),
        step('s21', '21', 0, 170, ['Luz_marcha']),
        trans('t21', 'Paro · Seta_ok', 0, 270),
        trans('t22', '!Seta_ok', 240, 270),
        step('s22', '22', 0, 340, ['Luz_marcha']),
        trans('t23', 'X0 · Seta_ok', 0, 440),
        trans('t24', '!Seta_ok', 360, 440),
        step('s23', '23', 360, 510, ['F/GP{}', 'Alarma']),
        trans('t25', 'Seta_ok · Rearme', 360, 610),
        step('s24', '24', 360, 680, ['F/GP{INIT}', 'A-']),
        trans('t26', 'a0', 360, 780),
        frame('gp', 'GP', 'grafcet', 680, -40, 320, 560),
        step('s0', '0', 720, 0, [], { initial: true }),
        trans('t1', 'X21 · a0', 720, 100),
        step('s1', '1', 720, 170, ['A+']),
        trans('t2', 'a1', 720, 270),
        step('s2', '2', 720, 340, ['A-']),
        trans('t3', 'a0', 720, 440),
        note(
          'nota',
          1040,
          0,
          '# Línea con GEMMA\n**Nivel 4.** El grafcet de conducción **GC** sigue los estados de la guía GEMMA y gobierna al de producción **GP**:\n\n- **20 · A1** parada en el estado inicial → `Marcha`\n- **21 · F1** producción normal: GP hace ciclos (`X21` en su primera transición) → `Paro`\n- **22 · A2** parada a fin de ciclo: GP acaba el ciclo y vuelve a 20 al llegar a `X0`\n- **23 · D1** parada de emergencia: **F/GP{}** y `Alarma` (seta)\n- **24 · A6** puesta en el estado inicial: **F/GP{INIT}** y el cilindro vuelve (`A-`)\n\nLa seta es **NC**: `Seta_ok` vale 1 mientras no está pulsada.\n\nPruébalo: **Simular**, Marcha, y prueba Paro o la seta.',
          { width: 360, height: 470 },
        ),
      ]
      const edges = links([
        ['s20', 't20'],
        ['t20', 's21'],
        ['s21', 't21'],
        ['s21', 't22'],
        ['t21', 's22'],
        ['t22', 's23'],
        ['s22', 't23'],
        ['s22', 't24'],
        ['t23', 's20'],
        ['t24', 's23'],
        ['s23', 't25'],
        ['t25', 's24'],
        ['s24', 't26'],
        ['t26', 's20'],
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's0'],
      ])
      const desk = (id, type, variable, color, text) => ({ id, type, x: 0, y: 0, rot: 0, variable, contact: 'NO', color, text, place: 'desk' })
      const scene = {
        elements: [
          { id: 'A', type: 'cylinder', x: 120, y: 140, rot: 0, extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1', stroke: 140, time: 1.5, text: 'A' },
          desk('marcha', 'button', 'Marcha', 'green', 'Marcha'),
          desk('paro', 'button', 'Paro', 'black', 'Paro (fin de ciclo)'),
          desk('rearme', 'button', 'Rearme', 'blue', 'Rearme'),
          { id: 'seta', type: 'emergency', x: 0, y: 0, rot: 0, variable: 'Seta_ok', text: 'Emergencia', place: 'desk' },
          desk('luz', 'lamp', 'Luz_marcha', 'green', 'En marcha'),
          desk('alarma', 'lamp', 'Alarma', 'red', 'Alarma'),
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'horno',
    level: 5,
    title: 'Horno con consigna',
    description: 'Regulación todo/nada con histéresis a partir de una consigna analógica, y alarma de sobretemperatura.',
    tags: ['Analógicas', 'Comparaciones', 'Acciones memorizadas', 'Planta'],
    build() {
      const stored = (text) => ({ text, kind: 'stored-on' })
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        // Al entrar en cada etapa se calcula el umbral con la consigna de ese momento.
        step('s1', '1', 200, 170, ['R', stored('Alto:=Consigna+5')]),
        trans('t2', 'Temp >= Alto · Marcha', 200, 270),
        trans('t4', '!Marcha', 440, 270),
        step('s2', '2', 200, 340, [stored('Bajo:=Consigna-5')]),
        trans('t3', 'Temp <= Bajo · Marcha', 200, 440),
        trans('t5', '!Marcha', 440, 440),
        // Alarma: grafcet aparte, siempre vigilando.
        step('s10', '10', 700, 0, [], { initial: true }),
        trans('t10', 'Temp >= 180', 700, 100),
        step('s11', '11', 700, 170, ['Alarma']),
        trans('t11', 'Temp <= 170', 700, 270),
        note(
          'nota',
          900,
          0,
          '# Horno con consigna\n**Nivel 5.** Regulación **todo/nada con histéresis**: la resistencia `R` calienta hasta `Consigna + 5 °C` y se apaga hasta bajar a `Consigna − 5 °C`.\n\n- Las receptividades comparan analógicas (`Temp >= Alto`). Los umbrales se calculan con **acciones memorizadas** al entrar en cada etapa (`Alto:=Consigna+5`), con la consigna de ese momento.\n- Un segundo grafcet vigila la **sobretemperatura** (alarma a 180 °C, se quita a 170 °C).\n- Entradas: `Marcha`, `Consigna` (potenciómetro, 0–200 °C), `Temp` (sonda, 0–300 °C) · Salidas: `R`, `Alarma`\n\nPruébalo: **Simular** (sube la velocidad), Marcha y mueve la consigna.',
          { width: 360, height: 470 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['s1', 't4'],
        ['t2', 's2'],
        ['t4', 's0'],
        ['s2', 't3'],
        ['s2', 't5'],
        ['t3', 's1'],
        ['t5', 's0'],
        ['s10', 't10'],
        ['t10', 's11'],
        ['s11', 't11'],
        ['t11', 's10'],
      ])
      const scene = {
        elements: [
          { id: 'horno', type: 'heater', x: 220, y: 140, rot: 0, heat: 'R', temperature: 'Temp', thermostat: '', setpoint: 60, ambient: 20, maxTemp: 250, tau: 15, text: 'Horno' },
          { id: 'marcha', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', text: 'Marcha', place: 'desk' },
          { id: 'consigna', type: 'potentiometer', x: 0, y: 0, rot: 0, variable: 'Consigna', initial: 0.5, text: 'Consigna', place: 'desk' },
          { id: 'vc', type: 'display', x: 0, y: 0, rot: 0, variable: 'Consigna', text: 'Consigna °C', place: 'desk' },
          { id: 'vt', type: 'display', x: 0, y: 0, rot: 0, variable: 'Temp', text: 'Temperatura °C', place: 'desk' },
          { id: 'alarma', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Alarma', color: 'red', text: 'Sobretemperatura', place: 'desk' },
        ],
      }
      const variables = {
        Consigna: { type: 'analogIn', signal: '0-10V', min: 0, max: 200, unit: '°C' },
        Temp: { type: 'analogIn', signal: '4-20mA', min: 0, max: 300, unit: '°C' },
      }
      return { nodes, edges, plc: { scene, variables } }
    },
  },
  {
    id: 'deposito-nivel',
    level: 5,
    title: 'Depósito con regulación de nivel',
    description: 'Nivel analógico 4–20 mA: la bomba arranca y para por umbrales, con alarmas de nivel alto y bajo.',
    tags: ['Analógicas', 'Comparaciones', 'Grafcets independientes', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        step('s1', '1', 200, 170),
        trans('t2', 'Nivel <= 30 · Marcha', 200, 270),
        trans('t4', '!Marcha', 440, 270),
        step('s2', '2', 200, 340, ['Bomba']),
        trans('t3', 'Nivel >= 80 · Marcha', 200, 440),
        trans('t5', '!Marcha', 440, 440),
        // Consumo (lo abre el usuario) y alarmas: grafcets independientes.
        step('s10', '10', 680, 0, [], { initial: true }),
        trans('t10', 'Consumir', 680, 100),
        step('s11', '11', 680, 170, ['Salida']),
        trans('t11', '!Consumir', 680, 270),
        step('s20', '20', 900, 0, [], { initial: true }),
        trans('t20', 'Nivel >= 95', 900, 100),
        step('s21', '21', 900, 170, ['Alarma_alta']),
        trans('t21', 'Nivel <= 90', 900, 270),
        step('s30', '30', 1120, 0, [], { initial: true }),
        trans('t30', 'Nivel <= 5', 1120, 100),
        step('s31', '31', 1120, 170, ['Alarma_baja']),
        trans('t31', 'Nivel >= 10', 1120, 270),
        note(
          'nota',
          1320,
          0,
          '# Depósito con regulación de nivel\n**Nivel 5.** El nivel llega como analógica de **4–20 mA** (`Nivel`, 0–100 %). La bomba arranca por debajo del 30 % y para al llegar al 80 %: la diferencia entre umbrales evita arranques continuos.\n\n- Tres grafcets **independientes** más: el consumo (`Consumir` abre la `Salida`) y dos alarmas con su propia histéresis (alta 95/90 %, baja 5/10 %).\n- Entradas: `Marcha`, `Consumir`, `Nivel` · Salidas: `Bomba`, `Salida`, `Alarma_alta`, `Alarma_baja`\n\nPruébalo: **Simular**, Marcha y abre el consumo.',
          { width: 360, height: 400 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['s1', 't4'],
        ['t2', 's2'],
        ['t4', 's0'],
        ['s2', 't3'],
        ['s2', 't5'],
        ['t3', 's1'],
        ['t5', 's0'],
        ['s10', 't10'],
        ['t10', 's11'],
        ['s11', 't11'],
        ['t11', 's10'],
        ['s20', 't20'],
        ['t20', 's21'],
        ['s21', 't21'],
        ['t21', 's20'],
        ['s30', 't30'],
        ['t30', 's31'],
        ['s31', 't31'],
        ['t31', 's30'],
      ])
      const scene = {
        elements: [
          { id: 'deposito', type: 'tank', x: 200, y: 80, rot: 0, fill: 'Bomba', drain: 'Salida', low: '', high: '', empty: '', level: 'Nivel', fillTime: 10, drainTime: 16, initial: 0.5, text: 'Depósito' },
          { id: 'marcha', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', text: 'Marcha', place: 'desk' },
          { id: 'consumir', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Consumir', contact: 'NO', text: 'Consumo', place: 'desk' },
          { id: 'vn', type: 'display', x: 0, y: 0, rot: 0, variable: 'Nivel', text: 'Nivel %', place: 'desk' },
          { id: 'alta', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Alarma_alta', color: 'red', text: 'Nivel alto', place: 'desk' },
          { id: 'baja', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Alarma_baja', color: 'yellow', text: 'Nivel bajo', place: 'desk' },
        ],
      }
      const variables = { Nivel: { type: 'analogIn', signal: '4-20mA', min: 0, max: 100, unit: '%' } }
      return { nodes, edges, plc: { scene, variables } }
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

// Tabla de variables dibujada en el lienzo (nodes/VariablesTableNode.jsx).
const TABLE_ID = 'variables-table'
const TABLE_GAP = 520 // de la tabla al grafcet (la tabla, con sus comentarios, ronda 460 px)

// Todos los ejemplos, documentados: cada variable y cada etapa con su comentario
// (lib/exampleComments.js), direcciones como con «Rellenar vacías» y la tabla de variables en el
// lienzo, a la izquierda del grafcet.
export function documented(project, comments = {}) {
  const plc = { ...EMPTY_PLC, ...project.plc }
  const variables = { ...plc.variables }
  for (const [name, comment] of Object.entries(comments.variables ?? {})) variables[name] = { ...variables[name], comment }
  const steps = { ...plc.steps }
  const stepNodes = project.nodes.filter((n) => n.type === 'step')
  for (const n of stepNodes) {
    const comment = comments.steps?.[n.data.label]
    if (comment) steps[n.id] = { ...steps[n.id], comment }
  }
  const filled = autoAssign({ ...plc, variables, steps }, stepNodes, projectVariables(project.nodes, variables))
  const drawing = project.nodes.filter((n) => ['step', 'transition', 'frame'].includes(n.type))
  const left = Math.min(...drawing.map((n) => n.position.x))
  const top = Math.min(...drawing.map((n) => n.position.y))
  // Posición provisional: al abrirse, el editor separa las columnas si algún texto pisa a su vecina
  // y coloca la tabla según su ancho real (autoPlace).
  const table = { id: TABLE_ID, type: 'variables', position: { x: left - TABLE_GAP, y: top }, data: { showComments: true, autoPlace: 'spread' }, deletable: false }
  return { ...project, nodes: [...project.nodes, table], plc: filled }
}

for (const example of EXAMPLES) {
  const build = example.build
  example.build = () => documented(build(), EXAMPLE_COMMENTS[example.id])
}
