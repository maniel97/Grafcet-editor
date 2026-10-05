// Guiones de prácticas: varias prácticas en un único PDF (lib/exerciseSheet.js buildGuide), con
// normas generales, cabecera y pie en cada página y cada práctica adjunta. Este es un ejemplo
// completo, modelado sobre un guion real de prácticas de autómatas S7-200 de un ciclo de
// Mecatrónica (enunciados redactados de nuevo): la práctica 1 es guiada (sale con su solución) y
// las demás son ejercicios con autocorrección. tests/unit/practiceGuides.test.js comprueba que la
// solución de cada práctica pasa sus comprobaciones.
import { DEFAULT_EXERCISE } from './exercise'
import { EMPTY_PLC } from './addressing'
import { documented, links, step, trans, withSchematic } from './examples'
import { normalizeProject } from './projectFile'

const desk = (type, variable, text, extra = {}) => ({ id: variable.toLowerCase(), type, x: 0, y: 0, rot: 0, variable, text, place: 'desk', ...extra })
// Cilindro de simple efecto (válvula 3/2 monoestable): solo la salida de avance; vuelve por muelle.
const singleActing = (id, out, x, y, rot, sensors = {}) => ({ id, type: 'cylinder', x, y, rot, text: id, extend: out, retract: '', retracted: sensors.retracted ?? '', extended: sensors.extended ?? '', stroke: 100, time: 1 })
const scenario = (id, name, duration, events) => ({ id, name, duration, events: events.map(([t, name, value]) => ({ t, name, value })) })
const behaviour = (...scenarios) => ({ scenarios, outputs: [], tolerance: 0.5, counts: true })

// Proyecto del profesor: grafcet + planta + comentarios de la tabla + esquema, y el ejercicio.
function practice({ name, nodes, edges, scene, comments, steps, scenarios, exercise }) {
  const project = withSchematic(documented({ name, nodes, edges, plc: { ...EMPTY_PLC, scene } }, { variables: comments, steps }))
  return normalizeProject({
    ...project,
    name,
    plc: { ...project.plc, scenarios, exercise: { ...DEFAULT_EXERCISE, ...exercise, checks: { ...DEFAULT_EXERCISE.checks, ...exercise.checks } } },
  })
}

const TASK = '\n\na) Haz el programa con el método que prefieras e indica la tabla de símbolos, el GRAFCET, el diagrama de contactos y las anotaciones que consideres necesarias.'

// --- Práctica 1 (guiada): posicionador de cajas -------------------------------------------------
function boxPositioner() {
  const nodes = [
    step('s0', '0', 200, 0, [], { initial: true }),
    trans('t1', 'S1', 200, 100),
    step('s1', '1', 200, 170),
    // Elección excluyente por el tamaño de la caja.
    trans('t2', 'CP · !CG', 80, 270),
    trans('t3', 'CG · !CP', 320, 270),
    step('s2', '2', 80, 340, ['P1']),
    step('s3', '3', 320, 340, ['P1']),
    trans('t4', 'S2', 80, 440),
    trans('t5', 'S3', 320, 440),
    // P1 vuelve (simple efecto): se espera a que esté dentro antes de mover la caja.
    step('s4', '4', 80, 510),
    step('s5', '5', 320, 510),
    trans('t6', '2s/X4', 80, 610),
    trans('t7', '3s/X5', 320, 610),
    step('s6', '6', 80, 680, ['P2']),
    step('s7', '7', 320, 680, ['P3']),
    trans('t8', '!S2', 80, 780),
    trans('t9', '!S3', 320, 780),
  ]
  const edges = links([
    ['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['s1', 't3'], ['t2', 's2'], ['t3', 's3'], ['s2', 't4'], ['s3', 't5'],
    ['t4', 's4'], ['t5', 's5'], ['s4', 't6'], ['s5', 't7'], ['t6', 's6'], ['t7', 's7'], ['s6', 't8'], ['s7', 't9'], ['t8', 's0'], ['t9', 's0'],
  ])
  // Como en un simulador de autómatas: interruptores para los sensores y los tres posicionadores.
  const scene = {
    elements: [
      desk('switch', 'S1', 'Sensor A', { contact: 'NO' }),
      desk('switch', 'S2', 'Sensor B', { contact: 'NO' }),
      desk('switch', 'S3', 'Sensor C', { contact: 'NO' }),
      desk('switch', 'CP', 'Caja pequeña', { contact: 'NO' }),
      desk('switch', 'CG', 'Caja grande', { contact: 'NO' }),
      singleActing('P1', 'P1', 120, 80, 0),
      singleActing('P2', 'P2', 120, 200, 0),
      singleActing('P3', 'P3', 120, 320, 0),
    ],
  }
  // Una caja pequeña y luego una grande, accionando los sensores como lo haría la máquina.
  const run = scenario('cajas', 'Caja pequeña y caja grande', 15, [
    [0.5, 'S1', 1], [0.6, 'CP', 1], [1.5, 'S1', 0], [1.6, 'CP', 0], [2, 'S2', 1], [5, 'S2', 0],
    [7, 'S1', 1], [7.1, 'CG', 1], [8, 'S1', 0], [8.1, 'CG', 0], [8.5, 'S3', 1], [12.5, 'S3', 0],
  ])
  return practice({
    name: 'Posicionador de cajas',
    nodes,
    edges,
    scene,
    comments: { S1: 'Sensor de presencia, plataforma A', S2: 'Sensor de presencia, plataforma B', S3: 'Sensor de presencia, plataforma C', CP: 'Caja pequeña (báscula)', CG: 'Caja grande (báscula)', P1: 'Posicionador 1', P2: 'Posicionador 2', P3: 'Posicionador 3' },
    steps: { 0: 'Esperando caja', 1: 'Clasificar por tamaño', 2: 'P1 lleva la caja pequeña a B', 3: 'P1 lleva la caja grande a C', 4: 'P1 vuelve (2 s)', 5: 'P1 vuelve (3 s)', 6: 'P2 empuja a la cinta B', 7: 'P3 empuja a la cinta C' },
    scenarios: [run],
    exercise: {
      title: 'Práctica 1 (guiada). Posicionador de cajas',
      statement:
        'Un dispositivo separa cajas de dos tamaños. Tiene una plataforma A por donde llegan las cajas, tres posicionadores de simple efecto (P1, P2 y P3), tres sensores ópticos de presencia (S1, S2 y S3), dos plataformas de evacuación (B y C) y una báscula bajo la plataforma A que indica si la caja es pequeña (CP) o grande (CG). Las cintas giran siempre: no las controla el autómata.\n\n- Cuando llega una caja al final de A se activa **S1** y la báscula la clasifica.\n- **Caja pequeña:** P1 la lleva al principio de la plataforma B (se activa **S2**). P1 retrocede; se considera que tarda **2 s** en volver. Después P2 empuja la caja a la cinta B y retrocede cuando la caja ha entrado (S2 desactivado).\n- **Caja grande:** igual, hacia la plataforma C (**S3**, **3 s**, P3).\n- Tras dejar la caja en su cinta, el sistema queda listo para la siguiente.',
      parts: { plant: 'given', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('cajas'), requirements: [{ id: 'timer' }, { id: 'or' }] },
      hints: { enabled: true, items: ['Tras S1, elige por el tamaño: dos transiciones excluyentes que salen de la misma etapa (divergencia en O).', 'P1 es de simple efecto: vuelve en cuanto su etapa deja de estar activa. La espera es una etapa sin acción con la transición `2s/X4` (o `3s/X5`).', 'Cada rama vuelve a la etapa inicial cuando el sensor de su plataforma se desactiva: `!S2` o `!S3`.'] },
    },
  })
}

// --- Práctica 2: pulsador y bombilla ------------------------------------------------------------
function buttonLamp() {
  const nodes = [step('s0', '0', 200, 0, [], { initial: true }), trans('t1', 'P', 200, 100), step('s1', '1', 200, 170, ['B']), trans('t2', '!P', 200, 270)]
  const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']])
  const scene = { elements: [desk('button', 'P', 'Pulsador P', { contact: 'NO', color: 'green' }), desk('lamp', 'B', 'Bombilla', { color: 'yellow' })] }
  return practice({
    name: 'Pulsador y bombilla',
    nodes,
    edges,
    scene,
    comments: { P: 'Pulsador (NA)', B: 'Bombilla' },
    steps: { 0: 'Bombilla apagada', 1: 'Bombilla encendida' },
    scenarios: [scenario('pulsar', 'Pulsar dos veces', 6, [[0.5, 'P', 1], [2, 'P', 0], [3.5, 'P', 1], [4, 'P', 0]])],
    exercise: {
      title: 'Práctica 2. Pulsador y bombilla',
      statement: `Al accionar un pulsador (**P**) se enciende una bombilla (**B**). Si el pulsador no está accionado, la bombilla está apagada.${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('pulsar'), requirements: [{ id: 'maxSteps', value: 2 }] },
      hints: { enabled: true, items: ['Dos etapas: bombilla apagada (la inicial) y bombilla encendida.', 'Se vuelve al reposo al soltar el pulsador: `!P`.'] },
    },
  })
}

// --- Práctica 3: cilindro de simple efecto con un interruptor ------------------------------------
function singleCylinder() {
  const nodes = [
    step('s0', '0', 200, 0, [], { initial: true }),
    trans('t1', 'I · a0', 200, 100),
    step('s1', '1', 200, 170, ['A+']),
    trans('t2', 'a1', 200, 270),
    step('s2', '2', 200, 340),
    // Al volver dentro: otro ciclo si el interruptor sigue encendido; si no, reposo.
    trans('t3', 'a0 · I', 80, 440),
    trans('t4', 'a0 · !I', 320, 440),
  ]
  const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['s2', 't4'], ['t3', 's1'], ['t4', 's0']])
  const scene = { elements: [desk('switch', 'I', 'Interruptor I', { contact: 'NO' }), singleActing('A', 'A+', 200, 120, 0, { retracted: 'a0', extended: 'a1' })] }
  return practice({
    name: 'Cilindro de simple efecto',
    nodes,
    edges,
    scene,
    comments: { I: 'Interruptor de marcha', a0: 'Final de carrera: A dentro', a1: 'Final de carrera: A fuera', 'A+': 'Electroválvula 3/2 monoestable: sacar A' },
    steps: { 0: 'Reposo', 1: 'A sale', 2: 'A entra (muelle)' },
    scenarios: [scenario('interruptor', 'Encender y apagar el interruptor', 9, [[0.5, 'I', 1], [4.2, 'I', 0]])],
    exercise: {
      title: 'Práctica 3. Cilindro de simple efecto',
      statement: `Al encender un interruptor (**I**), un cilindro de simple efecto gobernado por una válvula monoestable empieza a salir y entrar continuamente. Al apagar el interruptor, el cilindro termina el ciclo y se para en su posición inicial.${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('interruptor'), requirements: [{ id: 'or' }] },
      hints: { enabled: true, items: ['Simple efecto: la salida `A+` solo en la etapa en que sale; al desactivarla, el muelle lo devuelve.', 'Al llegar dentro (a0), elige: si I sigue encendido, otro ciclo; si no, reposo. Dos transiciones: `a0 · I` y `a0 · !I`.'] },
    },
  })
}

// --- Práctica 4: cinta transportadora con setas de emergencia -----------------------------------
function conveyorEmergency() {
  const nodes = [
    step('s0', '0', 200, 0, [], { initial: true }),
    trans('t1', 'S1 · Seta1 · Seta2', 200, 100),
    // Acción condicionada: la cinta se para al momento con cualquier seta y sigue al rearmarla.
    step('s1', '1', 200, 170, [{ text: 'M', kind: 'conditional', condition: 'Seta1 · Seta2' }]),
    trans('t2', 'S2', 200, 270),
  ]
  const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']])
  // Con gravedad: la caja se deja caer sobre la cinta y, al final, cae por el extremo; S2 la ve caer.
  // Medidas comprobadas en la simulación (tests/unit/practiceGuides.test.js).
  const scene = {
    gravity: true,
    elements: [
      { id: 'cinta', type: 'conveyor', x: 40, y: 300, rot: 0, motor: 'M', reverse: '', length: 420, time: 5, text: 'Cinta' },
      { id: 'caja', type: 'feeder', x: 80, y: 200, rot: 0, trigger: 'Caja', auto: false, spacing: 0, sizes: 'large', material: 'plastic', color: 'amber' },
      { id: 's1', type: 'sensor', x: 80, y: 345, rot: 270, variable: 'S1', contact: 'NO', range: 70, kind: 'capacitive', color: 'amber' },
      { id: 's2', type: 'sensor', x: 440, y: 380, rot: 0, variable: 'S2', contact: 'NO', range: 80, kind: 'capacitive', color: 'amber' },
      { id: 'salida', type: 'sink', x: 500, y: 450, rot: 0, text: 'Salida' },
      desk('button', 'Caja', 'Dejar caja', { contact: 'NO', color: 'yellow' }),
      desk('emergency', 'Seta1', 'Seta 1'),
      desk('emergency', 'Seta2', 'Seta 2'),
      desk('lamp', 'M', 'Cinta en marcha', { color: 'green' }),
    ],
  }
  return practice({
    name: 'Cinta con setas de emergencia',
    nodes,
    edges,
    scene,
    comments: { S1: 'Sensor capacitivo: caja en el extremo de entrada', S2: 'Sensor capacitivo: caja en el extremo de salida', Seta1: 'Seta de emergencia 1 (NC)', Seta2: 'Seta de emergencia 2 (NC)', M: 'Motor de la cinta' },
    steps: { 0: 'Esperando caja', 1: 'Llevar la caja al otro extremo' },
    scenarios: [scenario('caja', 'Una caja con parada de emergencia', 12, [[0.5, 'Caja', 1], [0.8, 'Caja', 0], [3, 'Seta1', 0], [4, 'Seta1', 1]])],
    exercise: {
      title: 'Práctica 4. Cinta transportadora con setas de emergencia',
      statement: `Una cinta transportadora se pone en marcha cuando un sensor capacitivo (**S1**) detecta una caja colocada a mano en un extremo. La cinta lleva la caja hasta el otro extremo, por donde cae, y se para cuando la detecta otro sensor capacitivo (**S2**).\n\n- En cada extremo hay una seta de emergencia normalmente cerrada (**Seta1**, **Seta2**). Si se pulsa cualquiera, la cinta se para al momento y no sigue hasta que la seta vuelve a su posición de reposo.${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('caja'), requirements: [{ id: 'conditional' }] },
      hints: { enabled: true, items: ['Una etapa de espera y otra con la cinta en marcha.', 'Para que las setas paren al momento sin cambiar de etapa, la cinta es una acción condicionada: `M` si `Seta1 · Seta2`.'] },
    },
  })
}

// --- Práctica 5: trece ciclos de un cilindro, con paro al final del ciclo ------------------------
function thirteenCycles() {
  const nodes = [
    step('s0', '0', 200, 0, [{ text: 'C:=0', kind: 'stored-on' }], { initial: true }),
    trans('t1', 'Pm · a0', 200, 100),
    step('s1', '1', 200, 170, ['A+']),
    trans('t2', 'a1', 200, 270),
    step('s2', '2', 200, 340, [{ text: 'C:=C+1', kind: 'stored-on' }]),
    trans('t3', 'a0 · C < 13 · !X11', 80, 440),
    trans('t4', 'a0 · (C >= 13 + X11)', 320, 440),
    // Grafcet parcial: recuerda que se ha pulsado Pp hasta que el ciclo vuelve al reposo.
    step('s10', '10', 600, 0, [], { initial: true }),
    trans('t10', '↑Pp', 600, 100),
    step('s11', '11', 600, 170),
    trans('t11', 'X0', 600, 270),
  ]
  const edges = links([
    ['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['s2', 't4'], ['t3', 's1'], ['t4', 's0'],
    ['s10', 't10'], ['t10', 's11'], ['s11', 't11'], ['t11', 's10'],
  ])
  const scene = {
    elements: [
      desk('button', 'Pm', 'Marcha (Pm)', { contact: 'NO', color: 'green' }),
      desk('button', 'Pp', 'Paro (Pp)', { contact: 'NO', color: 'red' }),
      desk('display', 'C', 'Ciclos'),
      singleActing('A', 'A+', 200, 120, 0, { retracted: 'a0', extended: 'a1' }),
    ],
  }
  return practice({
    name: 'Trece ciclos de un cilindro',
    nodes,
    edges,
    scene,
    comments: { Pm: 'Pulsador de marcha', Pp: 'Pulsador de paro', a0: 'Final de carrera: A dentro', a1: 'Final de carrera: A fuera', 'A+': 'Electroválvula 3/2 monoestable: sacar A', C: 'Contador de ciclos' },
    steps: { 0: 'Reposo', 1: 'A sale', 2: 'A entra y cuenta', 10: 'Sin orden de paro', 11: 'Paro pedido' },
    scenarios: [
      scenario('trece', 'Trece ciclos', 32, [[0.5, 'Pm', 1], [1, 'Pm', 0]]),
      scenario('paro', 'Paro a mitad de ciclo', 12, [[0.5, 'Pm', 1], [1, 'Pm', 0], [5.2, 'Pp', 1], [5.5, 'Pp', 0]]),
    ],
    exercise: {
      title: 'Práctica 5. Trece ciclos de un cilindro',
      statement: `Al pulsar la marcha (**Pm**), un cilindro (**A**) gobernado por una electroválvula 3/2 monoestable sale y entra **13 veces**.\n\n- Si durante el funcionamiento se pulsa el paro (**Pp**), la secuencia termina cuando el cilindro llega a su posición inicial (**a0**).${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('trece', 'paro'), requirements: [{ id: 'counter' }, { id: 'edge' }] },
      hints: { enabled: true, items: ['Cuenta los ciclos con una acción memorizada `C:=C+1` y ponlo a 0 en la etapa inicial con `C:=0`.', 'Para no perder una pulsación corta de Pp a mitad de ciclo, guárdala en un grafcet parcial de dos etapas: pasa a la segunda con `↑Pp` y vuelve con `X0`.', 'Al volver dentro (a0), sigue si `C < 13` y no se ha pedido el paro; si no, vuelve al reposo.'] },
    },
  })
}

export const PRACTICE_GUIDES = [
  {
    id: 'guion-automatas',
    title: 'Prácticas de programación de autómatas',
    description: 'Un guion completo: normas generales, una práctica guiada con su solución y cuatro prácticas con autocorrección.',
    sheet: { subject: 'Integración de Sistemas', course: 'Curso 2026-2027', cycle: 'Mecatrónica Industrial', center: '', teacher: '' },
    rules:
      'A continuación tienes una serie de prácticas obligatorias de programación de autómatas. El primer paso es **adaptar el enunciado a un caso real** del mundo industrial con una dificultad parecida.\n\n- Las prácticas se simulan en el editor (planta virtual) y, si se puede, en el autómata real.\n- Cada práctica es **individual**, aunque durante el aprendizaje hayas tenido ayuda del profesor o de los compañeros. Los archivos copiados se consideran no presentados.\n- La entrega fuera de plazo se penaliza progresivamente.\n- Se valoran la ejecución y la presentación (formato, ortografía, limpieza): **30 %** la entrega y **70 %** la calidad.\n- Se entregan en **un único PDF con portada**: Exportar > Dossier lo genera con tu proyecto dentro.\n\n# Cada práctica debe incluir\n- Enunciado\n- Breve contenido teórico, si procede\n- GRAFCET\n- Conexionado de los elementos\n- Programa (ladder y AWL)\n- Tabla de variables\n- Simulación\n- Posibles mejoras o aportaciones, si procede\n- Problemas encontrados y cómo se han resuelto, si procede',
    practices: [
      { id: 'p1', guided: true, teacher: boxPositioner },
      { id: 'p2', teacher: buttonLamp },
      { id: 'p3', teacher: singleCylinder },
      { id: 'p4', teacher: conveyorEmergency },
      { id: 'p5', teacher: thirteenCycles },
    ],
  },
]
