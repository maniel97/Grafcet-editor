// Ejemplos de grafcet listos para abrir (diálogo Abrir > Ejemplos). Todos son conformes a
// IEC 60848 y simulables; las pruebas (tests/unit/examples.test.js) lo comprueban.
// Coordenadas en la cuadrícula del editor: etapa -> transición +100 px, transición -> etapa +70 px.

import { NOTE_SIZE } from './notes'
import { EMPTY_PLC, autoAssign } from './addressing'
import { projectVariables } from './symbols'
import { EXAMPLE_COMMENTS } from './exampleComments'
import { buildPlcModel } from './plcModel'
import { generatePlcWiring } from './elec/generate'
import { pneumaticCircuit } from './elec/pneumaticCircuit'
import { powerPart } from './elec/templates'
import { terminalAddress } from './elec/catalog'

export const step = (id, label, x, y, actions = [], extra = {}) => ({ id, type: 'step', position: { x, y }, data: { label, actions, ...extra } })
export const trans = (id, condition, x, y) => ({ id, type: 'transition', position: { x, y }, data: { condition } })
const note = (id, x, y, text, size = {}) => ({ id, type: 'note', position: { x, y }, data: { text, color: 'yellow' }, ...NOTE_SIZE, height: 150, ...size })
const frame = (id, name, kind, x, y, width, height) => ({ id, type: 'frame', position: { x, y }, width, height, zIndex: -1, data: { name, kind } })
export const links = (pairs) => pairs.map(([source, target]) => ({ id: `${source}-${target}`, source, target, type: 'grafcet' }))

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
    id: 'electroneumatica',
    level: 5,
    comments: 'cilindros',
    title: 'Electroneumática A+ B+ A− B− con autómata',
    description: 'El mismo ciclo de cilindros, montado de verdad: autómata, electroválvulas biestables, cilindros neumáticos y sus detectores en el esquema eléctrico y neumático.',
    tags: ['Lineal', 'Neumática', 'Esquema eléctrico', 'Autómata', 'Planta'],
    build() {
      const project = EXAMPLES.find((e) => e.id === 'cilindros').rawBuild()
      const text =
        '# Electroneumática con autómata\n**Nivel 5.** El grafcet de la secuencia A+ B+ A− B− manda de verdad: abre el **Esquema eléctrico**.\n\n- Las salidas `Q` del autómata dan tensión a las electroválvulas `-Y1`…`-Y4`, que pilotan las 5/2 **biestables** 1V1 y 2V1.\n- Los cilindros A y B (con su regulador de caudal) mueven los de la planta.\n- Sus detectores `a0`…`b1` cierran los finales de carrera `-B`, que llegan a las entradas `I`.\n\nPruébalo: **Simular** y pulsa Marcha. Corta un tubo o una bobina con **Averías** y busca el fallo.'
      return { ...project, nodes: project.nodes.map((n) => (n.id === 'nota' ? { ...n, data: { ...n.data, text }, height: 330 } : n)) }
    },
    // Esquema: el cableado del autómata (como «Conexiones del autómata») y, a su derecha, la parte
    // neumática; las electroválvulas mueven las válvulas y los cilindros neumáticos, la planta.
    after(project) {
      const vars = buildPlcModel(project.nodes, project.edges, project.plc).variables
      const wiring = generatePlcWiring(vars, project.plc.scene)
      const valveOf = (name) => wiring.components.find((c) => c.type === 'valve' && c.signal === name)?.tag ?? ''
      const right = Math.max(...wiring.components.map((c) => c.x + (c.type === 'rail' ? Number(c.length) : 160))) + 260
      const top = Math.min(...wiring.components.map((c) => c.y))
      const air = pneumaticCircuit(
        ['A', 'B'].map((tag) => ({ tag, sol14: valveOf(`${tag}+`), sol12: valveOf(`${tag}-`), signal: `${tag}+`, reverse: `${tag}-`, throttle: 1 })),
        right,
        top,
        'air',
      )
      const components = [...wiring.components.map((c) => (c.type === 'valve' ? { ...c, signal: '' } : c)), ...air.components]
      return { ...project, plc: { ...project.plc, electrical: { enabled: true, components, wires: [...wiring.wires, ...air.wires] } } }
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
    id: 'cargador-gravedad',
    level: 3,
    title: 'Cargador por gravedad con expulsor (vista de frente)',
    description: 'Las piezas se apilan en un tubo vertical; el expulsor saca la de abajo a la cinta y la de encima baja sola. Lotes de 5 con un contador.',
    tags: ['Vista de frente', 'Gravedad', 'Contador', 'Divergencia en O', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [{ text: 'C:=0', kind: 'stored-on' }], { initial: true }),
        trans('t1', '↑Marcha · Hay_pieza · a0', 200, 100),
        step('s1', '1', 200, 170, ['A+', 'Cinta']),
        trans('t2', 'a1', 200, 270),
        step('s2', '2', 200, 340, ['A-', 'Cinta', { text: 'C:=C+1', kind: 'stored-on' }]),
        trans('t3', 'a0 · [C < 5] · Hay_pieza', 200, 440),
        trans('t4', 'a0 · [C >= 5]', 520, 440),
        step('s3', '3', 520, 510, ['Lote_listo', 'Cinta']),
        trans('t5', 'Marcha', 520, 610),
        note(
          'nota',
          820,
          0,
          '# Cargador por gravedad\n**Nivel 3.** Planta **de frente**, con gravedad: las piezas se apilan en el tubo del cargador.\n\n- El expulsor `A` saca la pieza de abajo a la cinta; mientras está fuera, su corredera sostiene la pila y, al recogerse, la pieza de encima **cae a su sitio**.\n- `Hay_pieza` (detector bajo el tubo) evita expulsar en vacío: si se acaba, espera a que repongas.\n- Cada expulsión suma 1 a `C`; con `[C >= 5]` el lote está listo (las condiciones numéricas van entre corchetes, como en la norma).\n\nPruébalo: **Simular**, pulsa **Reponer** varias veces para llenar el cargador y después **Marcha**.',
          { width: 340, height: 400 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['s2', 't4'],
        ['t3', 's1'],
        ['t4', 's3'],
        ['s3', 't5'],
        ['t5', 's0'],
      ])
      // Medidas comprobadas en la simulación (tests/unit/exampleRuns.test.js): tubo de 32 px para
      // piezas de 28, expulsor a la altura de la pieza de abajo.
      const scene = {
        gravity: true,
        elements: [
          { id: 'pared_i', type: 'platform', x: 210, y: 180, rot: 90, length: 192, text: '' },
          { id: 'pared_d', type: 'platform', x: 256, y: 180, rot: 90, length: 160, text: '' },
          { id: 'base', type: 'platform', x: 200, y: 400, rot: 0, length: 60, text: '' },
          { id: 'expulsor', type: 'cylinder', x: 110, y: 386, rot: 0, extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1', stroke: 80, time: 1, text: 'A' },
          { id: 'cinta', type: 'conveyor', x: 260, y: 415, rot: 0, motor: 'Cinta', length: 300, time: 3, text: 'Cinta' },
          { id: 'alimentador', type: 'feeder', x: 228, y: 110, rot: 0, trigger: 'Reponer', auto: false, spacing: 0, sizes: 'small', material: 'plastic', color: 'amber' },
          { id: 'hay', type: 'sensor', x: 228, y: 450, rot: 270, variable: 'Hay_pieza', contact: 'NO', kind: 'optical', range: 70, color: 'amber' },
          { id: 'recogida', type: 'sink', x: 640, y: 560, rot: 0, text: 'Recogida' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'reponer', type: 'button', x: 0, y: 0, rot: 0, variable: 'Reponer', contact: 'NO', color: 'blue', text: 'Reponer', place: 'desk' },
          { id: 'lote', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Lote_listo', color: 'green', text: 'Lote listo', place: 'desk' },
          { id: 'contador', type: 'display', x: 0, y: 0, rot: 0, variable: 'C', text: 'Piezas', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'apilador-trampilla',
    level: 4,
    title: 'Apilador con trampilla (vista de frente)',
    description: 'Las cajas caen de la cinta contra un tope y se apilan sobre una trampilla; con 3 en la pila se abre y la pila cae a la recogida. «1s/Pila» descarta las cajas que cruzan el haz al caer.',
    tags: ['Vista de frente', 'Gravedad', 'Temporización', 'Contador', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        step('s1', '1', 200, 170, ['Cinta']),
        trans('t2', '1s/Pila · Marcha', 200, 270),
        trans('t5', '!Marcha', 440, 270),
        step('s2', '2', 200, 340, ['Abrir', { text: 'C:=C+1', kind: 'stored-on' }]),
        trans('t3', 'b1', 200, 440),
        step('s3', '3', 200, 510, []),
        trans('t4', 'b0 · !Pila', 200, 610),
        note(
          'nota',
          760,
          0,
          '# Apilador con trampilla\n**Nivel 4.** Planta **de frente**, con gravedad.\n\n- Las cajas salen de la cinta, chocan con el tope y **caen** unas sobre otras encima de la trampilla.\n- `Pila` ve la tercera caja. Pero una caja que cae también cruza el haz un instante: por eso la receptividad es `1s/Pila` (Pila mantenida 1 s, temporización de la norma sobre cualquier variable).\n- Al abrirse la trampilla (`Abrir`) la pila **cae** a la recogida; se cierra sola por su peso y la cinta sigue. `C` cuenta las pilas.\n\nPruébalo: **Simular** y activa Marcha.',
          { width: 340, height: 380 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['s1', 't5'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['t3', 's3'],
        ['s3', 't4'],
        ['t4', 's1'],
        ['t5', 's0'],
      ])
      // Medidas comprobadas en la simulación (tests/unit/exampleRuns.test.js): las cajas tocan el
      // tope y caen rectas sobre la trampilla; el haz de Pila pasa justo por debajo del tope.
      const scene = {
        gravity: true,
        elements: [
          { id: 'alimentador', type: 'feeder', x: 90, y: 200, rot: 0, auto: true, spacing: 150, sizes: 'small', material: 'plastic', color: 'amber' },
          { id: 'cinta', type: 'conveyor', x: 60, y: 300, rot: 0, motor: 'Cinta', length: 280, time: 2.8, text: 'Cinta' },
          { id: 'tope', type: 'platform', x: 414, y: 250, rot: 90, length: 110, text: '' },
          { id: 'trampilla', type: 'barrier', x: 356, y: 460, rot: 0, open: 'Abrir', close: '', opened: 'b1', closed: 'b0', length: 60, time: 0.6, text: 'Trampilla' },
          { id: 'pila', type: 'sensor', x: 470, y: 368, rot: 180, variable: 'Pila', contact: 'NO', kind: 'optical', range: 80, color: 'amber' },
          { id: 'recogida', type: 'sink', x: 386, y: 600, rot: 0, text: 'Recogida' },
          { id: 'marcha', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', text: 'Marcha', place: 'desk' },
          { id: 'contador', type: 'display', x: 0, y: 0, rot: 0, variable: 'C', text: 'Pilas', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'clasificacion-frente',
    level: 3,
    title: 'Clasificación por tamaño con cinta reversible (vista de frente)',
    description: 'Cada pieza cae sobre la cinta; una barrera óptica a media altura distingue las altas, y la cinta las lleva a un extremo o al otro, por donde caen a su recogida.',
    tags: ['Vista de frente', 'Gravedad', 'Divergencia en O', 'Temporización', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        step('s1', '1', 200, 170, ['Soltar']),
        trans('t2', 'Pieza', 200, 270),
        step('s2', '2', 200, 340),
        // Se espera a que la pieza se asiente para mirar su altura; elección excluyente.
        trans('t3', '0.5s/X2 · Alta', 80, 440),
        trans('t4', '0.5s/X2 · !Alta', 320, 440),
        step('s3', '3', 80, 510, ['Atras']),
        step('s4', '4', 320, 510, ['Adelante']),
        trans('t5', '3s/X3', 80, 610),
        trans('t6', '3s/X4', 320, 610),
        note(
          'nota',
          600,
          0,
          '# Clasificación por tamaño\n**Nivel 3.** Planta **de frente**, con gravedad.\n\n- `Soltar` deja caer una pieza sobre el centro de la cinta (pequeñas y grandes, alternas).\n- `Pieza` (debajo de la cinta) ve que ha llegado; `Alta` es una barrera a media altura: solo la corta una pieza grande.\n- Grandes a la izquierda (`Atras`), pequeñas a la derecha (`Adelante`): la cinta las lleva al extremo y **caen** a su recogida.\n- Elección excluyente: `Alta` / `!Alta`, tras 0,5 s para que la pieza se asiente.\n\nPruébalo: **Simular** y activa Marcha.',
          { width: 330, height: 360 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['s2', 't4'],
        ['t3', 's3'],
        ['t4', 's4'],
        ['s3', 't5'],
        ['s4', 't6'],
        ['t5', 's0'],
        ['t6', 's0'],
      ])
      // Medidas comprobadas en la simulación (tests/unit/exampleRuns.test.js): la pieza cae al
      // centro de la cinta, Alta solo corta las grandes y cada extremo cae en su recogida.
      const scene = {
        gravity: true,
        elements: [
          { id: 'alimentador', type: 'feeder', x: 300, y: 180, rot: 0, trigger: 'Soltar', auto: false, spacing: 0, sizes: 'mixed', material: 'plastic', color: 'amber' },
          { id: 'cinta', type: 'conveyor', x: 100, y: 300, rot: 0, motor: 'Adelante', reverse: 'Atras', length: 400, time: 4, text: 'Cinta' },
          { id: 'pieza', type: 'sensor', x: 300, y: 345, rot: 270, variable: 'Pieza', contact: 'NO', kind: 'optical', range: 70, color: 'amber' },
          { id: 'alta', type: 'sensor', x: 240, y: 249, rot: 0, variable: 'Alta', contact: 'NO', kind: 'optical', range: 120, color: 'amber' },
          { id: 'grandes', type: 'sink', x: 70, y: 430, rot: 0, text: 'Grandes' },
          { id: 'pequenas', type: 'sink', x: 530, y: 430, rot: 0, text: 'Pequeñas' },
          { id: 'marcha', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', text: 'Marcha', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'elevador-frente',
    level: 5,
    title: 'Estación de elevación (vista de frente)',
    description: 'Planta vista de frente, con gravedad: la pieza cae a la cinta, sube en un elevador y pasa a otra cinta; vigilancia de tiempo contra atascos.',
    tags: ['Vista de frente', 'Gravedad', 'Vigilancia de tiempo', 'Divergencia en O', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha · b0 · c0', 200, 100),
        step('s1', '1', 200, 170, ['Soltar', 'M1', 'M2']),
        trans('t2', 'S1', 200, 270),
        step('s2', '2', 200, 340, ['B', 'M2']),
        // Vigilancia: si el vástago no llega a tiempo, algo lo atasca.
        trans('t3', 'b1', 200, 440),
        trans('t6', '3s/X2 · !b1', 440, 440),
        step('s3', '3', 200, 510, ['B', 'C', 'M2']),
        trans('t4', 'c1', 200, 610),
        trans('t7', '3s/X3 · !c1', 680, 610),
        step('s4', '4', 200, 680, ['M2']),
        trans('t5', 'b0 · c0', 200, 780),
        step('s5', '5', 440, 510, ['Alarma']),
        trans('t8', 'Rearme', 440, 610),
        step('s6', '6', 680, 680, ['Alarma']),
        trans('t9', 'Rearme', 680, 780),
        note(
          'nota',
          920,
          0,
          '# Estación de elevación\n**Nivel 5.** La planta se ve **de frente**, con **gravedad** (botón «Gravedad» de la planta): las piezas caen y se apoyan en lo que tienen debajo.\n\n- Cada ciclo suelta una pieza (`Soltar`), que cae a la cinta `M1`; al final sale despedida, choca con el tope y cae al **elevador** (`S1` la ve).\n- El elevador `B` la sube, el empujador `C` la pasa a la cinta `M2` y la pieza acaba en la recogida.\n- **Vigilancia de tiempo:** si un vástago no llega a su final en 3 s (`3s/X2 · !b1`), hay un atasco: alarma hasta pulsar `Rearme`.\n\nPruébalo: **Simular** y Marcha. Para provocar un atasco, en **Averías** atasca el elevador, o en **Editar** pon un «Tope / pared» delante del empujador.',
          { width: 360, height: 470 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's2'],
        ['s2', 't3'],
        ['s2', 't6'],
        ['t3', 's3'],
        ['s3', 't4'],
        ['s3', 't7'],
        ['t4', 's4'],
        ['s4', 't5'],
        ['t5', 's0'],
        ['t6', 's5'],
        ['s5', 't8'],
        ['t8', 's0'],
        ['t7', 's6'],
        ['s6', 't9'],
        ['t9', 's0'],
      ])
      // Medidas comprobadas en la simulación: la pieza sale de la cinta a 100 px/s, choca con el
      // tope y cae justo sobre el plato del elevador (pruebas: tests/unit/exampleRuns.test.js).
      const scene = {
        gravity: true,
        elements: [
          { id: 'alimentador', type: 'feeder', x: 140, y: 200, rot: 0, trigger: 'Soltar', auto: false, spacing: 0, sizes: 'small', material: 'plastic', color: 'amber' },
          { id: 'cinta1', type: 'conveyor', x: 60, y: 300, rot: 0, motor: 'M1', length: 320, time: 3.2, text: 'Cinta 1' },
          { id: 'tope', type: 'platform', x: 438, y: 250, rot: 90, length: 75, text: 'Tope' },
          { id: 'elevador', type: 'cylinder', x: 410, y: 413, rot: 270, extend: 'B', retract: '', retracted: 'b0', extended: 'b1', stroke: 160, time: 1.5, text: 'Elevador' },
          { id: 'llegada', type: 'sensor', x: 500, y: 311, rot: 180, variable: 'S1', contact: 'NO', kind: 'optical', range: 80, color: 'amber' },
          { id: 'empujador', type: 'cylinder', x: 300, y: 151, rot: 0, extend: 'C', retract: '', retracted: 'c0', extended: 'c1', stroke: 60, time: 0.8, text: 'Empujador' },
          { id: 'cinta2', type: 'conveyor', x: 424, y: 180, rot: 0, motor: 'M2', length: 260, time: 2.6, text: 'Cinta 2' },
          { id: 'recogida', type: 'sink', x: 800, y: 560, rot: 0, text: 'Recogida' },
          { id: 'marcha', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', text: 'Marcha', place: 'desk' },
          { id: 'rearme', type: 'button', x: 0, y: 0, rot: 0, variable: 'Rearme', contact: 'NO', color: 'blue', text: 'Rearme', place: 'desk' },
          { id: 'alarma', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Alarma', color: 'red', text: 'Atasco', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
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
  {
    id: 'encapsulacion',
    level: 5,
    title: 'Paro inmediato con encapsulación',
    description: 'La etapa 1 encapsula el ciclo del cilindro (G1): al activarse empieza por la etapa 11 (*); con Paro sale de 1 y todo lo encapsulado se desactiva, esté donde esté.',
    tags: ['Encapsulación', 'Neumática', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 0, 0, [], { initial: true }),
        trans('t1', 'Marcha', 0, 100),
        step('s1', '1', 0, 170, ['En_marcha'], { encapsulating: true }),
        trans('t2', 'Paro', 0, 270),
        { ...frame('fg1', 'G1', 'encapsulation', 340, -40, 300, 400), data: { kind: 'encapsulation', step: '1', name: 'G1' } },
        step('s11', '11', 400, 20, ['A+'], { activationLink: true }),
        trans('t11', 'a1', 400, 120),
        step('s12', '12', 400, 190, ['A-']),
        trans('t12', 'a0', 400, 290),
        note(
          'nota',
          700,
          0,
          '# Encapsulación (IEC 60848)\n**Nivel 5.** La etapa **1** es **encapsulante** (esquinas cortadas): mientras está activa, lo está su grafcet encapsulado **G1**.\n\n- Al activarse 1 se activa la etapa marcada con un asterisco (enlace de activación), la 11.\n- Con `Paro` se desactiva 1 y, con ella, **todo** lo encapsulado: el ciclo se corta en el acto, esté donde esté.\n- Entradas: `Marcha`, `Paro`, `a0`, `a1` · Salidas: `En_marcha`, `A+`, `A-`\n\nPruébalo: **Simular**, pulsa Marcha y, a mitad de ciclo, Paro.',
          { width: 320, height: 330 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's0'],
        ['s11', 't11'],
        ['t11', 's12'],
        ['s12', 't12'],
        ['t12', 's11'],
      ])
      const scene = {
        elements: [
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'paro', type: 'button', x: 0, y: 0, rot: 0, variable: 'Paro', contact: 'NO', color: 'red', text: 'Paro', place: 'desk' },
          { id: 'piloto', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'En_marcha', color: 'green', text: 'En marcha', place: 'desk' },
          { id: 'A', type: 'cylinder', x: 200, y: 100, rot: 0, text: 'A', extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1', stroke: 100, time: 1.5 },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'luz-pulsador',
    level: 1,
    title: 'Luz con un solo pulsador',
    description: 'Encender y apagar con el mismo pulsador: el flanco ↑P evita que la luz parpadee mientras se mantiene pulsado.',
    tags: ['Flancos', 'Lineal', 'Planta'],
    build() {
      const { nodes, edges } = cycle([{ actions: [] }, '↑P', { actions: ['Luz'] }, '↑P'])
      nodes.push(
        note(
          'nota',
          520,
          0,
          '# Luz con un solo pulsador\n**Nivel 1.** El mismo pulsador `P` enciende y apaga (como un telerruptor).\n\n- Las dos transiciones son **flancos** `↑P`: se cumplen solo en el instante de pulsar.\n- Sin flanco (`P` a secas), mientras se mantiene pulsado se cumplirían las dos seguidas y la luz cambiaría una y otra vez: el grafcet no sería estable.\n- Entrada: `P` · Salida: `Luz`\n\nPruébalo: **Simular** y pulsa P (y mantenlo pulsado: no cambia hasta la siguiente pulsación).',
          { width: 320, height: 330 },
        ),
      )
      const scene = {
        elements: [
          { id: 'luz', type: 'lamp', x: 200, y: 120, rot: 0, variable: 'Luz', color: 'yellow', text: 'Luz' },
          { id: 'p', type: 'button', x: 0, y: 0, rot: 0, variable: 'P', contact: 'NO', color: 'black', text: 'P', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'estrella-triangulo-plc',
    level: 2,
    title: 'Arranque estrella-triángulo con autómata',
    description: 'Secuencia temporizada: línea y estrella 5 s, una pausa sin estrella ni triángulo y después triángulo. Con su esquema de potencia.',
    tags: ['Temporización', 'Lineal', 'Esquema eléctrico', 'Autómata', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha · Paro', 200, 100),
        step('s1', '1', 200, 170, ['Linea', 'Estrella']),
        trans('t2', '5s/X1 · Paro', 200, 270),
        trans('t5', '!Paro', 440, 270),
        step('s2', '2', 200, 340, ['Linea']),
        trans('t3', '0.5s/X2', 200, 440),
        step('s3', '3', 200, 510, ['Linea', 'Triangulo']),
        trans('t4', '!Paro', 200, 610),
        note(
          'nota',
          660,
          0,
          '# Estrella-triángulo con autómata\n**Nivel 2.** El motor arranca en **estrella** (menos corriente) y a los 5 s pasa a **triángulo**.\n\n- La etapa 2 es una **pausa de 0,5 s** sin estrella ni triángulo: si entraran a la vez, sería un cortocircuito entre fases.\n- `Paro` es NC: `!Paro` para el motor (también durante el arranque).\n- Salidas: `Linea` (KM1), `Triangulo` (KM2), `Estrella` (KM3). Abre el **Esquema eléctrico**: el autómata manda las bobinas y la potencia lleva el motor de seis puntas.\n\nPruébalo: **Simular**, Marcha y mira el motor del esquema: estrella y luego triángulo.',
          { width: 340, height: 430 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['s1', 't5'],
        ['t2', 's2'],
        ['t5', 's0'],
        ['s2', 't3'],
        ['t3', 's3'],
        ['s3', 't4'],
        ['t4', 's0'],
      ])
      const scene = {
        elements: [
          { id: 'motor', type: 'motor', x: 220, y: 120, rot: 0, variable: 'Linea', reverse: '', pulses: '', text: 'Motor' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'paro', type: 'button', x: 0, y: 0, rot: 0, variable: 'Paro', contact: 'NC', color: 'red', text: 'Paro', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
    after: (project) =>
      withPower(project, {
        template: 'estrella-triangulo',
        maxX: 330,
        coils: { Linea: ['KM1', 'Línea'], Triangulo: ['KM2', 'Triángulo'], Estrella: ['KM3', 'Estrella'] },
        interlocks: [['KM2', 'KM3']],
        motor: { signal: 'Linea' },
      }),
  },
  {
    id: 'cinta-reversible',
    level: 3,
    title: 'Cinta reversible',
    description: 'Selección de secuencia: hacia la derecha o hacia la izquierda (elección excluyente), hasta el detector del final. Inversión de giro con enclavamiento.',
    tags: ['Divergencia en O', 'Esquema eléctrico', 'Autómata', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        // Elección excluyente (IEC 60848): no puede pedirse a la vez derecha e izquierda.
        trans('t1', 'Derecha · !Izquierda · !Fin_dcha · Paro', 200, 100),
        trans('t3', 'Izquierda · !Derecha · !Fin_izq · Paro', 520, 100),
        step('s1', '1', 200, 170, ['Adelante']),
        step('s2', '2', 520, 170, ['Atras']),
        trans('t2', 'Fin_dcha + !Paro', 200, 270),
        trans('t4', 'Fin_izq + !Paro', 520, 270),
        note(
          'nota',
          820,
          0,
          '# Cinta reversible\n**Nivel 3.** Desde el reposo se **elige** un sentido: `Derecha` o `Izquierda` (receptividades excluyentes, como pide IEC 60848). La cinta para al llegar la pieza al detector de ese extremo (o con `Paro`, NC).\n\n- Salidas: `Adelante` (KM1) y `Atras` (KM2). En el **Esquema eléctrico**, KM2 cruza dos fases para invertir el giro; KM1 y KM2 están **enclavados** (nunca a la vez).\n- Entradas: `Derecha`, `Izquierda`, `Paro`, `Fin_dcha`, `Fin_izq`, `Poner`\n\nPruébalo: **Simular**, Poner pieza y llévala de un extremo a otro.',
          { width: 340, height: 400 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['s0', 't3'],
        ['t1', 's1'],
        ['t3', 's2'],
        ['s1', 't2'],
        ['s2', 't4'],
        ['t2', 's0'],
        ['t4', 's0'],
      ])
      const scene = {
        elements: [
          { id: 'cinta', type: 'conveyor', x: 40, y: 200, rot: 0, motor: 'Adelante', reverse: 'Atras', length: 440, time: 4, text: 'Cinta' },
          { id: 'alimentador', type: 'feeder', x: 140, y: 200, rot: 0, trigger: 'Poner', auto: false, spacing: 0, sizes: 'small', material: 'plastic', color: 'amber' },
          { id: 'fin_izq', type: 'sensor', x: 70, y: 230, rot: 270, variable: 'Fin_izq', contact: 'NO', range: 20, kind: 'optical', color: 'amber' },
          { id: 'fin_dcha', type: 'sensor', x: 450, y: 230, rot: 270, variable: 'Fin_dcha', contact: 'NO', range: 20, kind: 'optical', color: 'amber' },
          { id: 'derecha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Derecha', contact: 'NO', color: 'green', text: 'Derecha', place: 'desk' },
          { id: 'izquierda', type: 'button', x: 0, y: 0, rot: 0, variable: 'Izquierda', contact: 'NO', color: 'green', text: 'Izquierda', place: 'desk' },
          { id: 'paro', type: 'button', x: 0, y: 0, rot: 0, variable: 'Paro', contact: 'NC', color: 'red', text: 'Paro', place: 'desk' },
          { id: 'poner', type: 'button', x: 0, y: 0, rot: 0, variable: 'Poner', contact: 'NO', color: 'yellow', text: 'Poner pieza', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
    after: (project) =>
      withPower(project, {
        template: 'inversion',
        maxX: 310,
        coils: { Adelante: ['KM1', 'Adelante'], Atras: ['KM2', 'Atrás'] },
        interlocks: [['KM1', 'KM2']],
        motor: { signal: 'Adelante', reverse: 'Atras' },
      }),
  },
  {
    id: 'dahlander-plc',
    level: 4,
    title: 'Motor de dos velocidades con paro de emergencia',
    description: 'Dahlander: arranca en lenta, pasa a rápida y, al pedir el paro, frena pasando por lenta. Un grafcet de seguridad fuerza la producción con la seta de emergencia.',
    tags: ['Grafcets parciales', 'Forzado', 'Temporización', 'Esquema eléctrico', 'Autómata', 'Planta'],
    build() {
      const nodes = [
        frame('gs', 'GS', 'grafcet', -40, -40, 400, 560),
        step('s10', '10', 0, 0, [], { initial: true }),
        trans('t10', '!Seta', 0, 100),
        step('s11', '11', 0, 170, ['F/GP{}', 'Alarma']),
        trans('t11', 'Rearme · Seta', 0, 270),
        step('s12', '12', 0, 340, ['F/GP{INIT}']),
        trans('t12', '1', 0, 440),
        frame('gp', 'GP', 'grafcet', 420, -40, 360, 760),
        step('s0', '0', 460, 0, [], { initial: true }),
        trans('t1', 'Marcha', 460, 100),
        step('s1', '1', 460, 170, ['Lenta']),
        trans('t2', '4s/X1', 460, 270),
        step('s2', '2', 460, 340, ['Rapida', 'Puente']),
        trans('t3', 'Paro_ciclo', 460, 440),
        step('s3', '3', 460, 510, ['Lenta']),
        trans('t4', '3s/X3', 460, 610),
        note(
          'nota',
          820,
          0,
          '# Dos velocidades con emergencia\n**Nivel 4.** Dos grafcets parciales:\n\n- **GP** (producción): lenta 4 s, rápida (`Rapida` + `Puente`: doble estrella) hasta `Paro_ciclo`, y 3 s en lenta para frenar.\n- **GS** (seguridad): la seta (`Seta`, NC) **fuerza** GP sin etapas (**F/GP{}**: todo parado) y enciende la `Alarma`; con `Rearme`, GP vuelve a su inicio (**F/GP{INIT}**).\n- **Esquema eléctrico**: KM1 lenta (triángulo), KM2 rápida y KM3 el puente de la doble estrella; KM1 y KM2 enclavados.\n\nPruébalo: **Simular**, Marcha, espera la rápida y pulsa la seta.',
          { width: 340, height: 430 },
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
        ['t3', 's3'],
        ['s3', 't4'],
        ['t4', 's0'],
      ])
      const scene = {
        elements: [
          { id: 'motor', type: 'motor', x: 220, y: 120, rot: 0, variable: 'Lenta', reverse: '', pulses: '', text: 'Motor' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'paro', type: 'button', x: 0, y: 0, rot: 0, variable: 'Paro_ciclo', contact: 'NO', color: 'black', text: 'Paro de ciclo', place: 'desk' },
          { id: 'seta', type: 'emergency', x: 0, y: 0, rot: 0, variable: 'Seta', text: 'Emergencia', place: 'desk' },
          { id: 'rearme', type: 'button', x: 0, y: 0, rot: 0, variable: 'Rearme', contact: 'NO', color: 'blue', text: 'Rearme', place: 'desk' },
          { id: 'alarma', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Alarma', color: 'red', text: 'Emergencia', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
    after: (project) =>
      withPower(project, {
        template: 'dahlander',
        maxX: 540,
        coils: { Lenta: ['KM1', 'Lenta'], Rapida: ['KM2', 'Rápida'], Puente: ['KM3', 'Puente estrella'] },
        interlocks: [['KM1', 'KM2']],
        motor: { signal: 'Lenta' },
      }),
  },
  {
    id: 'cinta-variador',
    level: 5,
    title: 'Cinta con variador y consigna analógica',
    description: 'El grafcet calcula la velocidad: rápida en vacío y lenta mientras hay pieza en la zona de carga. Salida analógica (AQW) a la entrada AI1 del variador.',
    tags: ['Analógicas', 'Acciones memorizadas', 'Esquema eléctrico', 'Autómata', 'Planta'],
    build() {
      const stored = (text) => ({ text, kind: 'stored-on' })
      const nodes = [
        step('s0', '0', 200, 0, [stored('Velocidad:=0')], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        step('s1', '1', 200, 170, ['Avance', stored('Velocidad:=50')]),
        trans('t2', 'Pieza · Marcha', 200, 270),
        trans('t4', '!Marcha', 440, 270),
        step('s2', '2', 200, 340, ['Avance', stored('Velocidad:=15')]),
        trans('t3', '!Pieza · Marcha', 200, 440),
        trans('t5', '!Marcha', 440, 440),
        note(
          'nota',
          660,
          0,
          '# Cinta con variador\n**Nivel 5.** La velocidad la decide el grafcet: `Velocidad` es una **salida analógica** (0–50 Hz → 0–10 V) que va a la entrada **AI1** del variador.\n\n- Etapa 1: cinta rápida (`Velocidad:=50`). Mientras el detector `Pieza` ve una pieza en la zona de carga, etapa 2: lenta (`Velocidad:=15`).\n- `Avance` da la orden de marcha (entrada DI1 del variador).\n- **Esquema eléctrico**: autómata, variador -T1 y motor -M1. Mira los hercios en el variador al simular.\n\nPruébalo: **Simular** y Marcha.',
          { width: 340, height: 400 },
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
      ])
      const scene = {
        elements: [
          { id: 'cinta', type: 'conveyor', x: 40, y: 200, rot: 0, motor: 'Avance', reverse: '', length: 560, time: 4, text: 'Cinta' },
          { id: 'alimentador', type: 'feeder', x: 70, y: 200, rot: 0, trigger: '', auto: true, spacing: 260, sizes: 'small', material: 'plastic', color: 'amber' },
          { id: 'pieza', type: 'sensor', x: 260, y: 230, rot: 270, variable: 'Pieza', contact: 'NO', range: 20, kind: 'optical', color: 'amber' },
          { id: 'salida', type: 'sink', x: 620, y: 200, rot: 0, text: 'Salida' },
          { id: 'marcha', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', text: 'Marcha', place: 'desk' },
          { id: 'hz', type: 'display', x: 0, y: 0, rot: 0, variable: 'Velocidad', text: 'Consigna (Hz)', place: 'desk' },
        ],
      }
      const variables = { Velocidad: { type: 'analogOut', signal: '0-10V', min: 0, max: 50, unit: 'Hz' } }
      return { nodes, edges, plc: { scene, variables } }
    },
    after: (project) => withDrive(project),
  },
  {
    id: 'semaforo-peatones',
    level: 1,
    title: 'Semáforo con pulsador de peatones',
    description: 'Los coches tienen verde hasta que un peatón pide paso; un segundo grafcet recuerda la petición mientras dura el ciclo.',
    tags: ['Temporización', 'Memoria', 'Planta'],
    build() {
      const nodes = [
        step('s0', '0', 200, 0, ['VerdeC', 'RojoP'], { initial: true }),
        trans('t1', '10s/X0 · X11', 200, 100),
        step('s1', '1', 200, 170, ['AmbarC', 'RojoP']),
        trans('t2', '3s/X1', 200, 270),
        step('s2', '2', 200, 340, ['RojoC', 'RojoP']),
        trans('t3', '1s/X2', 200, 440),
        step('s3', '3', 200, 510, ['RojoC', 'VerdeP']),
        trans('t4', '8s/X3', 200, 610),
        // Memoria de la petición: se pide con el pulsador y se borra al dar verde a los peatones.
        step('s10', '10', 560, 0, [], { initial: true }),
        trans('t10', '↑Pulsador', 560, 100),
        step('s11', '11', 560, 170, ['Espere']),
        trans('t11', 'X3', 560, 270),
        note(
          'nota',
          820,
          0,
          '# Semáforo con pulsador de peatones\n**Nivel 1.** Los coches tienen verde (al menos 10 s) hasta que un peatón pulsa.\n\n- El grafcet de la derecha **recuerda la petición** (etapa 11, piloto `Espere`) aunque se suelte el pulsador, y la borra cuando los peatones tienen verde (`X3`).\n- La receptividad `10s/X0 · X11` combina el tiempo mínimo de verde con la petición.\n- Entrada: `Pulsador` · Salidas: `VerdeC`, `AmbarC`, `RojoC`, `VerdeP`, `RojoP`, `Espere`\n\nPruébalo: **Simular** y pulsa el pulsador de peatones.',
          { width: 340, height: 400 },
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
        ['t4', 's0'],
        ['s10', 't10'],
        ['t10', 's11'],
        ['s11', 't11'],
        ['t11', 's10'],
      ])
      const scene = {
        elements: [
          { id: 'coches', type: 'trafficlight', x: 200, y: 120, rot: 0, red: 'RojoC', amber: 'AmbarC', green: 'VerdeC', text: 'Coches' },
          { id: 'peatones', type: 'trafficlight', x: 360, y: 120, rot: 0, red: 'RojoP', amber: '', green: 'VerdeP', text: 'Peatones' },
          { id: 'pulsador', type: 'button', x: 0, y: 0, rot: 0, variable: 'Pulsador', contact: 'NO', color: 'yellow', text: 'Peatones', place: 'desk' },
          { id: 'espere', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Espere', color: 'amber', text: 'Espere', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'aparcamiento',
    level: 2,
    title: 'Aparcamiento con contador de plazas',
    description: 'Contaje hacia arriba y hacia abajo con dos detectores; comparaciones para los pilotos de Libre y Completo.',
    tags: ['Contadores', 'Flancos', 'Comparaciones', 'Acción condicionada', 'Planta'],
    build() {
      const cond = (text, condition) => ({ text, kind: 'conditional', condition })
      const stored = (text) => ({ text, kind: 'stored-on' })
      const nodes = [
        step('s0', '0', 200, 0, [cond('Libre', 'C < 5'), cond('Completo', 'C >= 5')], { initial: true }),
        trans('t1', '↑Entra · !Sale · C < 5', 200, 100),
        step('s1', '1', 200, 170, [stored('C:=C+1')]),
        trans('t2', '1', 200, 270),
        trans('t3', '↑Sale · !Entra · C > 0', 560, 100),
        step('s2', '2', 560, 170, [stored('C:=C-1')]),
        trans('t4', '1', 560, 270),
        note(
          'nota',
          860,
          0,
          '# Aparcamiento\n**Nivel 2.** `C` cuenta los coches que hay dentro (5 plazas).\n\n- Cada **flanco** `↑Entra` suma 1 y cada `↑Sale` resta 1 (acciones memorizadas en las etapas 1 y 2, que duran un instante).\n- No se cuenta una entrada con el aparcamiento lleno (`C < 5`) ni una salida con él vacío (`C > 0`); las dos receptividades son excluyentes.\n- Los pilotos son **acciones condicionadas** de la etapa 0: `Libre` si `C < 5`, `Completo` si `C >= 5`.\n\nPruébalo: **Simular** y pulsa «Coche entra» seis veces.',
          { width: 340, height: 430 },
        ),
      ]
      const edges = links([
        ['s0', 't1'],
        ['t1', 's1'],
        ['s1', 't2'],
        ['t2', 's0'],
        ['s0', 't3'],
        ['t3', 's2'],
        ['s2', 't4'],
        ['t4', 's0'],
      ])
      const scene = {
        elements: [
          { id: 'entra', type: 'button', x: 0, y: 0, rot: 0, variable: 'Entra', contact: 'NO', color: 'green', text: 'Coche entra', place: 'desk' },
          { id: 'sale', type: 'button', x: 0, y: 0, rot: 0, variable: 'Sale', contact: 'NO', color: 'black', text: 'Coche sale', place: 'desk' },
          { id: 'libre', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Libre', color: 'green', text: 'Libre', place: 'desk' },
          { id: 'completo', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Completo', color: 'red', text: 'Completo', place: 'desk' },
          { id: 'c', type: 'display', x: 0, y: 0, rot: 0, variable: 'C', text: 'Coches dentro', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'silo-vibrador',
    level: 2,
    title: 'Silo con vibrador',
    description: 'Acciones retardada y limitada en el tiempo (IEC 60848): aviso solo los 2 primeros segundos de la descarga y vibrador a partir del cuarto.',
    tags: ['Acción condicionada', 'Temporización', 'Lineal', 'Planta'],
    build() {
      const cond = (text, condition) => ({ text, kind: 'conditional', condition })
      const { nodes, edges } = cycle([
        { actions: [] },
        'Marcha · Lleno',
        { actions: ['Descarga', cond('Aviso', '!2s/X1'), cond('Vibrador', '4s/X1')] },
        'Vacio',
        { actions: ['Llenar'] },
        'Lleno',
      ])
      nodes.push(
        note(
          'nota',
          620,
          0,
          '# Silo con vibrador\n**Nivel 2.** Durante la descarga (etapa 1):\n\n- **Acción limitada en el tiempo**: la sirena `Aviso` suena solo los 2 primeros segundos (condición `!2s/X1`).\n- **Acción retardada**: el `Vibrador` arranca a los 4 s (condición `4s/X1`), para ayudar a que el producto no se atasque.\n- Después se rellena el silo (`Llenar`) hasta `Lleno`.\n- Entradas: `Marcha`, `Lleno`, `Vacio` · Salidas: `Descarga`, `Aviso`, `Vibrador`, `Llenar`\n\nPruébalo: **Simular** y Marcha.',
          { width: 340, height: 400 },
        ),
      )
      const scene = {
        elements: [
          { id: 'silo', type: 'tank', x: 220, y: 60, rot: 0, fill: 'Llenar', fillFine: '', drain: 'Descarga', low: '', high: 'Lleno', empty: 'Vacio', level: '', fillTime: 6, drainTime: 8, initial: 1, text: 'Silo' },
          { id: 'vibrador', type: 'motor', x: 380, y: 120, rot: 0, variable: 'Vibrador', reverse: '', pulses: '', text: 'Vibrador' },
          { id: 'aviso', type: 'siren', x: 380, y: 40, rot: 0, variable: 'Aviso', sound: false, text: 'Aviso' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'dos-carros',
    level: 3,
    title: 'Dos carros con un tramo común',
    description: 'Recurso compartido: un carro solo entra en el tramo común si el otro está en reposo (variables de etapa). Si los dos lo piden a la vez, tiene prioridad A.',
    tags: ['Recurso compartido', 'Variables de etapa', 'Grafcets independientes', 'Planta'],
    build() {
      const nodes = [
        step('s10', '10', 0, 0, [], { initial: true }),
        trans('tA1', 'Pide_A · X30', 0, 100),
        step('s11', '11', 0, 170, ['A+']),
        trans('tA2', 'a1', 0, 270),
        step('s12', '12', 0, 340, ['A-']),
        trans('tA3', 'a0', 0, 440),
        step('s30', '30', 360, 0, [], { initial: true }),
        trans('tB1', 'Pide_B · !Pide_A · X10', 360, 100),
        step('s31', '31', 360, 170, ['B+']),
        trans('tB2', 'b1', 360, 270),
        step('s32', '32', 360, 340, ['B-']),
        trans('tB3', 'b0', 360, 440),
        note(
          'nota',
          760,
          0,
          '# Dos carros con un tramo común\n**Nivel 3.** Los carros A y B comparten un tramo de vía: nunca pueden estar los dos en él.\n\n- Cada carro tiene su grafcet. Para entrar, el otro tiene que estar en reposo: lo dicen sus **variables de etapa** (`X30` en la receptividad de A, `X10` en la de B).\n- Si los dos piden a la vez, entra A: `!Pide_A` en la de B da la **prioridad**.\n- Otra forma clásica: una **etapa de recurso** común, que cada carro toma al entrar (convergencia en Y) y devuelve al salir.\n- Entradas: `Pide_A`, `Pide_B`, `a0`, `a1`, `b0`, `b1` · Salidas: `A+`, `A-`, `B+`, `B-`\n\nPruébalo: **Simular** y pide los dos carros a la vez.',
          { width: 340, height: 470 },
        ),
      ]
      const edges = links([
        ['s10', 'tA1'],
        ['tA1', 's11'],
        ['s11', 'tA2'],
        ['tA2', 's12'],
        ['s12', 'tA3'],
        ['tA3', 's10'],
        ['s30', 'tB1'],
        ['tB1', 's31'],
        ['s31', 'tB2'],
        ['tB2', 's32'],
        ['s32', 'tB3'],
        ['tB3', 's30'],
      ])
      const cart = (n, x, rot) => ({
        id: n,
        type: 'cylinder',
        x,
        y: 160,
        rot,
        text: `Carro ${n}`,
        extend: `${n}+`,
        retract: `${n}-`,
        retracted: `${n.toLowerCase()}0`,
        extended: `${n.toLowerCase()}1`,
        stroke: 120,
        time: 1.5,
      })
      const scene = {
        elements: [
          cart('A', 80, 0),
          cart('B', 520, 180),
          { id: 'tramo', type: 'label', x: 300, y: 110, rot: 0, text: 'Tramo común', size: 14 },
          { id: 'pide_a', type: 'button', x: 0, y: 0, rot: 0, variable: 'Pide_A', contact: 'NO', color: 'green', text: 'Pide A', place: 'desk' },
          { id: 'pide_b', type: 'button', x: 0, y: 0, rot: 0, variable: 'Pide_B', contact: 'NO', color: 'blue', text: 'Pide B', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'taladradora-verificacion',
    level: 4,
    title: 'Taladradora con marcha de verificación',
    description: 'Un grafcet de modos (GEMMA): en producción el ciclo es automático; en verificación avanza una transición por cada pulsación de Paso.',
    tags: ['Grafcets parciales', 'GEMMA', 'Modos de marcha', 'Planta'],
    build() {
      const go = (condition) => `${condition} · (X20 + ↑Paso)`
      const nodes = [
        frame('gm', 'GM', 'grafcet', -40, -40, 380, 400),
        step('s20', '20', 0, 0, ['Produccion'], { initial: true }),
        trans('t20', 'Verificacion · X0', 0, 100),
        step('s21', '21', 0, 170, ['Modo_verif']),
        trans('t21', '!Verificacion · X0', 0, 270),
        frame('gp', 'GP', 'grafcet', 420, -40, 420, 760),
        step('s0', '0', 460, 0, [], { initial: true }),
        trans('t1', go('Marcha · Pieza'), 460, 100),
        step('s1', '1', 460, 170, ['Motor_broca', 'Bajar']),
        trans('t2', go('Fc_abajo'), 460, 270),
        step('s2', '2', 460, 340, ['Motor_broca']),
        trans('t3', go('2s/X2'), 460, 440),
        step('s3', '3', 460, 510, ['Subir']),
        trans('t4', go('Fc_arriba'), 460, 610),
        note(
          'nota',
          880,
          0,
          '# Marcha de verificación\n**Nivel 4.** Dos grafcets parciales:\n\n- **GM** (modos, GEMMA): etapa 20 = **producción normal** (A1/F1); etapa 21 = **marcha de verificación en orden** (F5). Solo se cambia de modo con la máquina en reposo (`X0`).\n- **GP** (producción): cada receptividad lleva `(X20 + ↑Paso)`: en producción avanza sola; en verificación, solo con cada pulsación de `Paso` (para comprobar la máquina paso a paso).\n- Entradas: `Marcha`, `Pieza`, `Fc_abajo`, `Fc_arriba`, `Verificacion`, `Paso` · Salidas: `Motor_broca`, `Bajar`, `Subir`, `Produccion`, `Modo_verif`\n\nPruébalo: **Simular**, pasa a Verificación y avanza con Paso.',
          { width: 360, height: 470 },
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
        ['t3', 's3'],
        ['s3', 't4'],
        ['t4', 's0'],
      ])
      const scene = {
        elements: [
          { id: 'motor', type: 'motor', x: 300, y: 50, rot: 0, variable: 'Motor_broca', reverse: '', text: 'Motor broca' },
          { id: 'broca', type: 'cylinder', x: 300, y: 100, rot: 90, extend: 'Bajar', retract: 'Subir', retracted: 'Fc_arriba', extended: 'Fc_abajo', stroke: 120, time: 1.5, text: 'Broca' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'pieza', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Pieza', contact: 'NO', text: 'Pieza colocada', place: 'desk' },
          { id: 'verif', type: 'switch', x: 0, y: 0, rot: 0, variable: 'Verificacion', contact: 'NO', text: 'Verificación', place: 'desk' },
          { id: 'paso', type: 'button', x: 0, y: 0, rot: 0, variable: 'Paso', contact: 'NO', color: 'blue', text: 'Paso', place: 'desk' },
          { id: 'l_prod', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Produccion', color: 'green', text: 'Producción', place: 'desk' },
          { id: 'l_verif', type: 'lamp', x: 0, y: 0, rot: 0, variable: 'Modo_verif', color: 'amber', text: 'Verificación', place: 'desk' },
        ],
      }
      return { nodes, edges, plc: { scene } }
    },
  },
  {
    id: 'dosificacion-peso',
    level: 5,
    title: 'Dosificación por peso',
    description: 'Tolva pesada (4-20 mA): tara al empezar, llenado grueso hasta 8 kg antes de la consigna y fino hasta llegar, estabilización y descarga.',
    tags: ['Analógicas', 'Comparaciones', 'Acciones memorizadas', 'Planta'],
    build() {
      const stored = (text) => ({ text, kind: 'stored-on' })
      const nodes = [
        step('s0', '0', 200, 0, [], { initial: true }),
        trans('t1', 'Marcha', 200, 100),
        step('s1', '1', 200, 170, ['Gruesa', stored('Tara:=Peso'), stored('Corte:=Peso+Consigna-8'), stored('Meta:=Peso+Consigna'), stored('Fin:=Peso+1')]),
        trans('t2', 'Peso >= Corte', 200, 270),
        step('s2', '2', 200, 340, ['Fina']),
        trans('t3', 'Peso >= Meta', 200, 440),
        step('s3', '3', 200, 510),
        trans('t4', '2s/X3', 200, 610),
        step('s4', '4', 200, 680, ['Descarga']),
        trans('t5', 'Peso <= Fin', 200, 780),
        note(
          'nota',
          700,
          0,
          '# Dosificación por peso\n**Nivel 5.** La tolva está sobre una báscula: `Peso` (4-20 mA, 0–100 kg). `Consigna` (potenciómetro, 0–60 kg) es lo que hay que añadir.\n\n- Al empezar se toma la **tara** (`Tara:=Peso`: lo que ya había) y se calculan los umbrales con **acciones memorizadas**.\n- **Llenado grueso** (`Gruesa`, rápido) hasta 8 kg antes; **fino** (`Fina`, cinco veces más lento) hasta la consigna: así no se pasa.\n- 2 s de **estabilización** y **descarga** hasta volver a la tara.\n\nPruébalo: **Simular** (sube la velocidad), elige la consigna y pulsa Marcha.',
          { width: 360, height: 450 },
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
        ['t4', 's4'],
        ['s4', 't5'],
        ['t5', 's0'],
      ])
      const scene = {
        elements: [
          { id: 'tolva', type: 'tank', x: 220, y: 60, rot: 0, fill: 'Gruesa', fillFine: 'Fina', drain: 'Descarga', low: '', high: '', empty: '', level: 'Peso', fillTime: 20, drainTime: 10, initial: 0.1, text: 'Tolva' },
          { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
          { id: 'consigna', type: 'potentiometer', x: 0, y: 0, rot: 0, variable: 'Consigna', initial: 0.5, text: 'Consigna', place: 'desk' },
          { id: 'v_peso', type: 'display', x: 0, y: 0, rot: 0, variable: 'Peso', text: 'Peso (kg)', place: 'desk' },
          { id: 'v_cons', type: 'display', x: 0, y: 0, rot: 0, variable: 'Consigna', text: 'Consigna (kg)', place: 'desk' },
          { id: 'v_tara', type: 'display', x: 0, y: 0, rot: 0, variable: 'Tara', text: 'Tara (kg)', place: 'desk' },
        ],
      }
      const variables = {
        Peso: { type: 'analogIn', signal: '4-20mA', min: 0, max: 100, unit: 'kg' },
        Consigna: { type: 'analogIn', signal: '0-10V', min: 0, max: 60, unit: 'kg' },
      }
      return { nodes, edges, plc: { scene, variables } }
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
  example.rawBuild = build
  // after: lo que necesita las direcciones ya asignadas (p. ej. el esquema eléctrico).
  example.build = () => {
    const project = documented(build(), EXAMPLE_COMMENTS[example.comments ?? example.id])
    return withSchematic(example.after ? example.after(project) : project)
  }
}

// Todos los ejemplos traen su esquema eléctrico: el cableado del autómata con sus direcciones
// (como «Conexiones del autómata»). Conectado si hay planta (los mandos y detectores llegan por
// los cables); sin planta, sin conectar, para seguir accionando las entradas desde el panel.
export function withSchematic(project) {
  if (project.plc.electrical?.components?.length) return project
  const wiring = generatePlcWiring(buildPlcModel(project.nodes, project.edges, project.plc).variables, project.plc.scene)
  if (!wiring.devices) return project
  const enabled = (project.plc.scene?.elements?.length ?? 0) > 0
  return { ...project, plc: { ...project.plc, electrical: { enabled, components: wiring.components, wires: wiring.wires } } }
}

// Esquema con potencia (ejemplos de motores): el cableado del autómata y, a su derecha, la potencia
// de un montaje (lib/elec/templates.js: powerPart). Las bobinas de las salidas pasan a ser los
// contactores de ese montaje (coils: { salida: [identificador, descripción] }), con sus
// enclavamientos mecánicos; el motor del esquema mueve el de la planta.
function withPower(project, { template, maxX, coils, interlocks = [], motor }) {
  const wiring = generatePlcWiring(buildPlcModel(project.nodes, project.edges, project.plc).variables, project.plc.scene)
  const pair = new Map(interlocks.flatMap(([a, b]) => [[a, b], [b, a]]))
  const components = wiring.components.map((c) => {
    if (c.type !== 'coil' || !coils[c.signal]) return c
    const [tag, text] = coils[c.signal]
    return { ...c, tag, kind: 'contactor', text, signal: '', ...(pair.has(tag) ? { interlock: pair.get(tag) } : {}) }
  })
  const rails = components.filter((c) => c.type === 'rail')
  const right = Math.max(...rails.map((c) => c.x + Number(c.length)))
  const top = Math.min(...components.map((c) => c.y))
  const power = powerPart(template, maxX, right + 160, top, `${project.plc.name ?? 'ej'}-pot`)
  const parts = power.components.map((c) => (['motor3', 'motor6', 'dahlander', 'motor2w', 'motor1'].includes(c.type) ? { ...c, ...motor } : c))
  // El contacto 95-96 de cada relé térmico, en serie con la alimentación de las salidas del
  // autómata (L+ → 95-96 → 1L, donde iba el puente): al dispararse, los contactores caen. Sin él,
  // el térmico de la potencia no cortaba nada (sus polos principales siempre conducen).
  const plc = components.find((c) => c.type === 'plc')
  const thermals = parts.filter((c) => c.type === 'thermal')
  let wires = [...wiring.wires, ...power.wires]
  if (plc && thermals.length) {
    const bridge = wires.find((w) => w.from.c === plc.id && w.from.t === 'L+' && w.to.c === plc.id && w.to.t === '1L')
    wires = wires.filter((w) => w !== bridge)
    let from = { c: plc.id, t: 'L+' }
    thermals.forEach((th, i) => {
      const contact = { id: `${th.id}-95`, type: 'contact', ref: th.tag, contact: 'NC', x: plc.x - 100 - 60 * i, y: plc.y + 20, text: '' }
      components.push(contact)
      wires.push({ id: `w-${contact.id}-a`, from, to: { c: contact.id, t: 'a' }, bend: 10 })
      from = { c: contact.id, t: 'b' }
    })
    wires.push({ id: `w-${plc.id}-1L`, from, to: { c: plc.id, t: '1L' }, bend: 10 })
  }
  return { ...project, plc: { ...project.plc, electrical: { enabled: true, components: [...components, ...parts], wires } } }
}

// Cinta con variador: el autómata manda la marcha (su salida de Avance a DI1) y la velocidad (su
// salida analógica a AI1) del variador; el motor del variador mueve la cinta de la planta.
function withDrive(project) {
  const vars = buildPlcModel(project.nodes, project.edges, project.plc).variables
  const wiring = generatePlcWiring(
    vars.filter((v) => v.name !== 'Avance'),
    project.plc.scene,
  )
  const plc = wiring.components.find((c) => c.type === 'plc')
  const rails = wiring.components.filter((c) => c.type === 'rail')
  const right = Math.max(...rails.map((c) => c.x + Number(c.length)))
  // El variador, con sus bornes de mando 60 px por debajo de los del autómata.
  const power = powerPart('variador', 300, right + 160, plc.y + 120 + 60 - 520, 'variador')
  const vfd = power.components.find((c) => c.type === 'vfd')
  const parts = power.components.map((c) => (c.type === 'motor3' ? { ...c, signal: 'Avance', text: 'Motor de la cinta' } : c))
  const address = (name) => terminalAddress(vars.find((v) => v.name === name).address)
  const wires = [
    { id: `w-${plc.id}-avance`, from: { c: plc.id, t: address('Avance') }, to: { c: vfd.id, t: 'DI1' }, bend: 20 },
    { id: `w-${plc.id}-velocidad`, from: { c: plc.id, t: address('Velocidad') }, to: { c: vfd.id, t: 'AI1' }, bend: 40 },
  ]
  return { ...project, plc: { ...project.plc, electrical: { enabled: true, components: [...wiring.components, ...parts], wires: [...wiring.wires, ...power.wires, ...wires] } } }
}
