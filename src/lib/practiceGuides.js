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
function practice({ name, nodes, edges, scene, comments, steps, scenarios, exercise, variables = {} }) {
  const project = withSchematic(documented({ name, nodes, edges, plc: { ...EMPTY_PLC, scene, variables } }, { variables: comments, steps }))
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

// --- Práctica 6: luces verde, roja y amarilla con un pulsador de marcha --------------------------
function threeLights() {
  const nodes = [
    step('s0', '0', 200, 0, [], { initial: true }),
    // Con flanco: si se vuelve al reposo pulsando Pm, no arranca otra vez mientras siga pulsado.
    trans('t1', '↑Pm', 200, 100),
    step('s1', '1', 200, 170, ['LV', 'LR']),
    trans('t2', '3s/X1', 200, 270),
    step('s2', '2', 200, 340, ['LR', 'LA']),
    trans('t3', '10s/X2 + ↑Pm', 200, 440),
  ]
  const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['t3', 's0']])
  const scene = {
    elements: [
      desk('button', 'Pm', 'Marcha (Pm)', { contact: 'NO', color: 'green' }),
      desk('lamp', 'LV', 'Luz verde', { color: 'green' }),
      desk('lamp', 'LR', 'Luz roja', { color: 'red' }),
      desk('lamp', 'LA', 'Luz amarilla', { color: 'yellow' }),
    ],
  }
  return practice({
    name: 'Luces verde, roja y amarilla',
    nodes,
    edges,
    scene,
    comments: { Pm: 'Pulsador de marcha', LV: 'Luz verde', LR: 'Luz roja', LA: 'Luz amarilla' },
    steps: { 0: 'Luces apagadas', 1: 'Verde y roja (3 s)', 2: 'Roja y amarilla (10 s o Pm)' },
    scenarios: [
      scenario('ciclo', 'Un ciclo completo', 16, [[0.5, 'Pm', 1], [0.8, 'Pm', 0]]),
      scenario('cortar', 'Pm otra vez a mitad', 10, [[0.5, 'Pm', 1], [0.8, 'Pm', 0], [6, 'Pm', 1], [6.3, 'Pm', 0]]),
    ],
    exercise: {
      title: 'Práctica 6. Luces verde, roja y amarilla',
      statement: `Al accionar un pulsador de marcha (**Pm**) se encienden una luz verde (**LV**) y otra roja (**LR**). La luz verde se apaga a los **3 s**, momento en el que se enciende una luz amarilla (**LA**). Las luces roja y amarilla siguen encendidas **10 s** más o hasta que se vuelva a accionar el pulsador de marcha.${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('ciclo', 'cortar'), requirements: [{ id: 'timer' }, { id: 'edge' }] },
      hints: { enabled: true, items: ['Tres etapas: apagadas, verde y roja, roja y amarilla. La roja va en las dos etapas en que está encendida.', 'El paso de la etapa 1 a la 2 es una temporización: `3s/X1`.', 'La etapa 2 termina por tiempo o por el pulsador: `10s/X2 + ↑Pm`. Usa el flanco `↑Pm` (también para arrancar) para que una pulsación larga no vuelva a arrancar el ciclo.'] },
    },
  })
}

// --- Práctica 7: tres leds en secuencia (1 s, 2 s y 1,538 s) con marcha y paro -------------------
function ledSequence() {
  const nodes = [
    step('s0', '0', 200, 0, [], { initial: true }),
    trans('t1', 'PM · !PP', 200, 100),
    step('s1', '1', 200, 170, ['LV']),
    // El paro apaga todo al momento: cada etapa vuelve al reposo con PP (divergencia en O con
    // receptividades excluyentes, para que nunca se franqueen las dos).
    trans('t2', '1s/X1 · !PP', 200, 270),
    trans('t3', 'PP', -20, 270),
    step('s2', '2', 200, 340, ['LR']),
    trans('t4', '2s/X2 · !PP', 200, 440),
    trans('t5', 'PP', -20, 440),
    step('s3', '3', 200, 510, ['LA']),
    trans('t6', '1.538s/X3 + PP', 200, 610),
  ]
  const edges = links([
    ['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['s1', 't3'], ['t2', 's2'], ['t3', 's0'],
    ['s2', 't4'], ['s2', 't5'], ['t4', 's3'], ['t5', 's0'], ['s3', 't6'], ['t6', 's0'],
  ])
  // El panel del enunciado: tres leds y los pulsadores PM (negro) y PP (rojo).
  const scene = {
    elements: [
      desk('button', 'PM', 'Marcha (PM)', { contact: 'NO', color: 'black' }),
      desk('button', 'PP', 'Paro (PP)', { contact: 'NO', color: 'red' }),
      desk('lamp', 'LV', 'Led verde', { color: 'green' }),
      desk('lamp', 'LR', 'Led rojo', { color: 'red' }),
      desk('lamp', 'LA', 'Led amarillo', { color: 'yellow' }),
    ],
  }
  return practice({
    name: 'Tres leds en secuencia',
    nodes,
    edges,
    scene,
    // 1,538 s solo es exacto con un temporizador de 1 ms (T32 o T96 en el S7-200); con uno de
    // 100 ms se quedaría en 1,5 s.
    variables: { '1.538s/X3': { address: 'T32' } },
    comments: { PM: 'Pulsador de marcha', PP: 'Pulsador de paro', LV: 'Led verde', LR: 'Led rojo', LA: 'Led amarillo', '1.538s/X3': 'Temporizador de 1 ms (1,538 s exactos)' },
    steps: { 0: 'Leds apagados', 1: 'Led verde (1 s)', 2: 'Led rojo (2 s)', 3: 'Led amarillo (1,538 s)' },
    scenarios: [
      scenario('secuencia', 'Una secuencia completa', 7, [[0.5, 'PM', 1], [0.8, 'PM', 0]]),
      scenario('paro', 'Paro con el led rojo encendido', 5, [[0.5, 'PM', 1], [0.8, 'PM', 0], [2.2, 'PP', 1], [2.5, 'PP', 0]]),
    ],
    exercise: {
      title: 'Práctica 7. Tres leds en secuencia',
      statement: `Al pulsar **PM** se enciende el led verde **LV** durante **1 s**; a continuación, el led rojo **LR** durante **2 s** y, por último, el led amarillo **LA** durante **1,538 s**.\n\n- El pulsador de paro (**PP**) del panel apaga los leds en cualquier momento y deja el sistema en reposo.${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('secuencia', 'paro'), requirements: [{ id: 'timer' }, { id: 'or' }] },
      hints: { enabled: true, items: ['Una etapa por led, cada una con su temporización: `1s/X1`, `2s/X2` y `1.538s/X3`.', 'Para el paro, cada etapa con un led tiene una segunda salida hacia el reposo con `PP` (divergencia en O). Para que las dos salidas sean excluyentes, la del tiempo lleva `· !PP`.', '1,538 s no se puede contar con un temporizador de 100 ms: en el S7-200 usa uno de 1 ms (T32 o T96).'] },
    },
  })
}

// --- Práctica 8: secuencia A+B+B−A− continua, con seta que para al final del ciclo ---------------
function sequenceSeta() {
  const nodes = [
    step('s0', '0', 200, 0, [], { initial: true }),
    // Arranca con los dos cilindros dentro y la seta sin pulsar. Al rearmar la seta no arranca
    // sola: hay que volver a pulsar PM (EN 60204-1, ISO 13850).
    trans('t1', '↑PM · SE · a0 · b0', 200, 100),
    step('s1', '1', 200, 170, ['A+']),
    trans('t2', 'a1', 200, 270),
    step('s2', '2', 200, 340, ['B+']),
    trans('t3', 'b1', 200, 440),
    step('s3', '3', 200, 510, ['B-']),
    trans('t4', 'b0', 200, 610),
    step('s4', '4', 200, 680, ['A-']),
    // La seta no corta a mitad de la secuencia: al llegar a a0, o sigue, o se para.
    trans('t5', 'a0 · SE', 80, 780),
    trans('t6', 'a0 · !SE', 320, 780),
  ]
  const edges = links([
    ['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['t3', 's3'], ['s3', 't4'], ['t4', 's4'],
    ['s4', 't5'], ['s4', 't6'], ['t5', 's1'], ['t6', 's0'],
  ])
  const scene = {
    elements: [
      desk('button', 'PM', 'Marcha (PM)', { contact: 'NO', color: 'green' }),
      desk('emergency', 'SE', 'Seta (SE)'),
      { id: 'cila', type: 'cylinder', x: 120, y: 100, rot: 0, extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1', stroke: 120, time: 1, text: 'A' },
      { id: 'cilb', type: 'cylinder', x: 120, y: 220, rot: 0, extend: 'B+', retract: 'B-', retracted: 'b0', extended: 'b1', stroke: 120, time: 1, text: 'B' },
    ],
  }
  return practice({
    name: 'Secuencia A+B+B−A− con seta',
    nodes,
    edges,
    scene,
    comments: {
      PM: 'Pulsador de marcha (NA)', SE: 'Seta de emergencia (NC)',
      'A+': 'Electroválvula 4/2 biestable: sacar A', 'A-': 'Electroválvula 4/2 biestable: meter A',
      'B+': 'Electroválvula 4/2 biestable: sacar B', 'B-': 'Electroválvula 4/2 biestable: meter B',
      a0: 'Final de carrera: A dentro', a1: 'Final de carrera: A fuera',
      b0: 'Final de carrera: B dentro', b1: 'Final de carrera: B fuera',
    },
    steps: { 0: 'Reposo', 1: 'A sale', 2: 'B sale', 3: 'B entra', 4: 'A entra' },
    scenarios: [
      scenario('marcha', 'Marcha y varios ciclos', 10, [[0.5, 'PM', 1], [0.8, 'PM', 0]]),
      scenario('seta', 'Seta a mitad de ciclo', 14, [[0.5, 'PM', 1], [0.8, 'PM', 0], [2.5, 'SE', 0], [6.5, 'SE', 1], [8, 'PM', 1], [8.3, 'PM', 0]]),
      scenario('seta-antes', 'Seta antes de la marcha', 9, [[0.3, 'SE', 0], [1, 'PM', 1], [1.3, 'PM', 0], [3, 'SE', 1], [4, 'PM', 1], [4.3, 'PM', 0]]),
    ],
    exercise: {
      title: 'Práctica 8. Secuencia A+B+B−A− con seta de emergencia',
      statement: `Al pulsar la marcha (**PM**), dos cilindros de doble efecto hacen la secuencia **A+ B+ B− A−** de forma continua (salidas **A+**, **B+**, **B-**, **A-**; finales de carrera **a0**, **a1**, **b0**, **b1**).\n\n- Si se pulsa la seta de emergencia (**SE**, normalmente cerrada), los cilindros se paran **al terminar la secuencia en curso**, en reposo.\n- Con la seta pulsada no funciona, ni siquiera pulsando la marcha. Al soltarla no arranca solo: hay que volver a pulsar **PM**.${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('marcha', 'seta', 'seta-antes'), requirements: [{ id: 'or' }, { id: 'edge' }] },
      hints: { enabled: true, items: [
        'Una etapa por movimiento (A+, B+, B−, A−) y la inicial de reposo; al llegar a a0, la última etapa vuelve a la primera.',
        'Para la parada al final del ciclo: desde la última etapa, dos salidas excluyentes — `a0 · SE` sigue y `a0 · !SE` va al reposo.',
        'Para que no arranque con la seta pulsada, ni solo al soltarla: el arranque es el flanco de la marcha con la seta sin pulsar y los cilindros dentro, `↑PM · SE · a0 · b0`.',
      ] },
    },
  })
}

// --- Práctica 9: clasificación manual de piezas de metal y plástico -------------------------------
// Como en el guion: el inductivo SI está en la caída, por encima de la plataforma, y la pieza de
// metal pasa por delante de él antes de llegar al capacitivo SC; Metal queda a la izquierda (la
// empuja B, desde la derecha) y Plástico a la derecha (la empuja A, desde la izquierda).
function manualClassifier() {
  const nodes = [
    step('s0', '0', 200, 0, [], { initial: true }),
    // El metal pasa antes por SI: la pieza que llega a SC sin haber pasado por él es de plástico.
    trans('t1', 'SI', 80, 100),
    trans('t2', 'SC · !SI', 320, 100),
    step('s1', '1', 80, 170),
    trans('t3', 'SC', 80, 270),
    step('s2', '2', 80, 340, ['B+']),
    trans('t4', 'b1', 80, 440),
    step('s3', '3', 80, 510, ['B-']),
    trans('t5', 'b0', 80, 610),
    step('s4', '4', 320, 170, ['A+']),
    trans('t6', 'a1', 320, 270),
    // A es monoestable: sin A+, el muelle lo devuelve; se espera a que llegue a a0.
    step('s5', '5', 320, 340),
    trans('t7', 'a0', 320, 440),
  ]
  const edges = links([
    ['s0', 't1'], ['s0', 't2'], ['t1', 's1'], ['s1', 't3'], ['t3', 's2'], ['s2', 't4'], ['t4', 's3'], ['s3', 't5'], ['t5', 's0'],
    ['t2', 's4'], ['s4', 't6'], ['t6', 's5'], ['s5', 't7'], ['t7', 's0'],
  ])
  // Vista de frente, con gravedad: la pieza cae del almacén, pasa por delante de SI y se para en
  // la plataforma, delante de SC; el cilindro la empuja por el borde hasta su recogida. Medidas
  // comprobadas en la simulación (tests/unit/practiceGuides.test.js): el haz de SC (262–274 px)
  // queda por encima de las placas de los vástagos (275–303 px) — los detectores ven las placas —
  // y la pieza no se sube a la placa (25 px de subida, un px más que el paso que la física permite).
  const scene = {
    gravity: true,
    elements: [
      { id: 'almacen_am', type: 'feeder', x: 308, y: 130, rot: 0, trigger: 'AM', auto: false, spacing: 0, sizes: 'large', material: 'metal', color: 'metal', text: 'AM' },
      { id: 'almacen_ap', type: 'feeder', x: 262, y: 130, rot: 0, trigger: 'AP', auto: false, spacing: 0, sizes: 'large', material: 'plastic', color: 'amber', text: 'AP' },
      // SI, a la derecha de la caída y mirando hacia ella, como en el guion.
      { id: 'si', type: 'sensor', x: 345, y: 200, rot: 180, variable: 'SI', contact: 'NO', kind: 'inductive', range: 100 },
      // 12 px de holgura con la placa de A recogido (220–228 px): con menos, en PC_SIMU la pieza de metal
      // que empuja B no cae por el hueco.
      { id: 'plataforma', type: 'platform', x: 240, y: 300, rot: 0, length: 90, text: '' },
      { id: 'sc', type: 'sensor', x: 220, y: 268, rot: 0, variable: 'SC', contact: 'NO', kind: 'capacitive', range: 100 },
      // A 1 px del paso de 24: con el tope de la placa a 275 px la pieza NO se sube a la placa
      // (25 px de subida) y el haz de SC queda por encima de ella (los detectores ven las placas).
      { id: 'cila', type: 'cylinder', x: 140, y: 289, rot: 0, extend: 'A+', retract: '', retracted: 'a0', extended: 'a1', stroke: 140, time: 1, text: 'A' },
      { id: 'cilb', type: 'cylinder', x: 460, y: 289, rot: 180, extend: 'B+', retract: 'B-', retracted: 'b0', extended: 'b1', stroke: 160, time: 1, text: 'B' },
      { id: 'metal', type: 'sink', x: 210, y: 450, rot: 0, text: 'Metal' },
      { id: 'plastico', type: 'sink', x: 360, y: 450, rot: 0, text: 'Plástico' },
      desk('button', 'AM', 'Sacar de AM', { contact: 'NO', color: 'gray' }),
      desk('button', 'AP', 'Sacar de AP', { contact: 'NO', color: 'blue' }),
    ],
  }
  return practice({
    name: 'Clasificación manual metal/plástico',
    nodes,
    edges,
    scene,
    comments: {
      AM: 'Botón: sacar una pieza del almacén de metal', AP: 'Botón: sacar una pieza del almacén de plástico',
      SI: 'Detector inductivo en la caída: ve el metal', SC: 'Detector capacitivo en la plataforma: ve metal y plástico',
      'A+': 'Electroválvula monoestable: sacar A (el muelle lo devuelve)',
      a0: 'Final de carrera: A dentro', a1: 'Final de carrera: A fuera',
      'B+': 'Electroválvula biestable: sacar B', 'B-': 'Electroválvula biestable: meter B',
      b0: 'Final de carrera: B dentro', b1: 'Final de carrera: B fuera',
    },
    steps: { 0: 'Esperando pieza', 1: 'Ha pasado metal', 2: 'B empuja el metal', 3: 'B vuelve', 4: 'A empuja el plástico', 5: 'A vuelve' },
    scenarios: [
      scenario('metal', 'Una pieza de metal', 6, [[0.5, 'AM', 1], [0.8, 'AM', 0]]),
      scenario('plastico', 'Una pieza de plástico', 6, [[0.5, 'AP', 1], [0.8, 'AP', 0]]),
    ],
    exercise: {
      title: 'Práctica 9. Clasificación manual de piezas',
      statement: `Al sacar a mano una pieza de metal del almacén **AM** o una de plástico del almacén **AP**, el cilindro **A** o el **B** la desplaza hacia el lado adecuado para que quede clasificada en **Metal** o en **Plástico**.\n- Para distinguirlas hay un detector **inductivo (SI)**, en la caída de la pieza, y uno **capacitivo (SC)**, en la plataforma.\n- **A** es monoestable (salida **A+**, finales de carrera **a0**, **a1**) y **B** biestable (salidas **B+** y **B-**, finales de carrera **b0**, **b1**).\n- Fíjate en la planta: Metal queda a la izquierda y Plástico a la derecha.${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: { scenarios: ['metal', 'plastico'], outputs: [], tolerance: 1, counts: true }, requirements: [{ id: 'or' }] },
      hints: { enabled: true, items: [
        'El inductivo (SI) solo ve el metal, y lo ve al caer, antes de que la pieza llegue a la plataforma. El capacitivo (SC) ve las dos: él solo no distingue el material.',
        'Desde el reposo, dos salidas excluyentes: `SI` (ha pasado metal; espera a `SC`) y `SC · !SI` (ha llegado una pieza sin pasar por SI: es de plástico).',
        'B empuja hacia Metal: **B+** hasta `b1` y **B-** hasta `b0`. A empuja hacia Plástico: **A+** hasta `a1`; al quitarla, el muelle lo devuelve: espera a `a0`.',
      ] },
    },
  })
}

// --- Práctica 10: A sale y entra 3 veces y B 5 veces, cada uno a su aire ---------------------------
// Movimientos independientes: divergencia en Y con un contador en cada rama; cada rama acaba en una
// etapa de espera y la convergencia en Y vuelve al reposo cuando han terminado las dos.
function twoCounters() {
  const nodes = [
    step('s0', '0', 420, 0, [{ text: 'CA:=0', kind: 'stored-on' }, { text: 'CB:=0', kind: 'stored-on' }], { initial: true }),
    trans('t1', '↑PM1 · a0 · b0', 420, 100),
    // Las vueltas atrás de cada rama, por fuera (A a la izquierda y B a la derecha), para que no se
    // crucen ni parezca que vuelven a la divergencia.
    step('s1', '1', 200, 240, ['A+']),
    trans('t2', 'a1', 200, 340),
    step('s2', '2', 200, 410, ['A-', { text: 'CA:=CA+1', kind: 'stored-on' }]),
    trans('t3', 'a0 · CA < 3', 80, 510),
    trans('t4', 'a0 · CA >= 3', 320, 510),
    step('s3', '3', 320, 580),
    step('s4', '4', 640, 240, ['B+']),
    trans('t5', 'b1', 640, 340),
    step('s5', '5', 640, 410, ['B-', { text: 'CB:=CB+1', kind: 'stored-on' }]),
    trans('t6', 'b0 · CB < 5', 880, 510),
    trans('t7', 'b0 · CB >= 5', 520, 510),
    step('s6', '6', 520, 580),
    trans('t8', '1', 420, 680),
  ]
  const edges = links([
    ['s0', 't1'], ['t1', 's1'], ['t1', 's4'],
    ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['s2', 't4'], ['t3', 's1'], ['t4', 's3'],
    ['s4', 't5'], ['t5', 's5'], ['s5', 't6'], ['s5', 't7'], ['t6', 's4'], ['t7', 's6'],
    ['s3', 't8'], ['s6', 't8'], ['t8', 's0'],
  ])
  const scene = {
    elements: [
      desk('button', 'PM1', 'Marcha (PM1)', { contact: 'NO', color: 'green' }),
      desk('display', 'CA', 'Ciclos de A'),
      desk('display', 'CB', 'Ciclos de B'),
      { id: 'cila', type: 'cylinder', x: 120, y: 100, rot: 0, extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1', stroke: 120, time: 1, text: 'A' },
      { id: 'cilb', type: 'cylinder', x: 120, y: 220, rot: 0, extend: 'B+', retract: 'B-', retracted: 'b0', extended: 'b1', stroke: 160, time: 1, text: 'B' },
    ],
  }
  return practice({
    name: 'A tres veces y B cinco veces',
    nodes,
    edges,
    scene,
    comments: {
      PM1: 'Pulsador de marcha (NA)',
      'A+': 'Electroválvula 4/2 biestable: sacar A', 'A-': 'Electroválvula 4/2 biestable: meter A',
      'B+': 'Electroválvula 4/2 biestable: sacar B', 'B-': 'Electroválvula 4/2 biestable: meter B',
      a0: 'Final de carrera: A dentro', a1: 'Final de carrera: A fuera',
      b0: 'Final de carrera: B dentro', b1: 'Final de carrera: B fuera',
      CA: 'Contador de ciclos de A', CB: 'Contador de ciclos de B',
    },
    steps: { 0: 'Reposo', 1: 'A sale', 2: 'A entra y cuenta', 3: 'A ha terminado', 4: 'B sale', 5: 'B entra y cuenta', 6: 'B ha terminado' },
    scenarios: [
      scenario('marcha', 'Una marcha', 14, [[0.5, 'PM1', 1], [0.8, 'PM1', 0]]),
      // Pulsar a mitad no hace nada; al terminar, otra marcha vuelve a empezar desde cero.
      scenario('otra', 'Pulsar a mitad y otra marcha al acabar', 26, [[0.5, 'PM1', 1], [0.8, 'PM1', 0], [4, 'PM1', 1], [4.3, 'PM1', 0], [13, 'PM1', 1], [13.3, 'PM1', 0]]),
    ],
    exercise: {
      title: 'Práctica 10. A sale y entra 3 veces y B 5 veces',
      statement: `Al pulsar la marcha (**PM1**), el cilindro **A** sale y entra **3 veces** y el cilindro **B** sale y entra **5 veces**. El movimiento de cada cilindro es **independiente** del otro.\n\n- Los dos son de doble efecto con electroválvula 4/2 biestable (salidas **A+**, **A-**, **B+**, **B-**; finales de carrera **a0**, **a1**, **b0**, **b1**).${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('marcha', 'otra'), requirements: [{ id: 'and' }, { id: 'counter' }, { id: 'edge' }] },
      hints: { enabled: true, items: [
        'Si cada cilindro va a su aire, son dos secuencias a la vez: divergencia en Y al pulsar la marcha.',
        'Un contador por cilindro: `CA:=CA+1` al entrar A y `CB:=CB+1` al entrar B; los dos a 0 en la etapa inicial.',
        'Al volver dentro, cada rama sigue si no ha llegado a sus ciclos (`a0 · CA < 3`) o pasa a una etapa de espera (`a0 · CA >= 3`). Cuando las dos esperan, la convergencia en Y vuelve al reposo.',
      ] },
    },
  })
}

// --- Práctica 11: cinta de ida y vuelta entre dos sensores; un segundo pulsador la para a la derecha
function shuttleConveyor() {
  const nodes = [
    step('s0', '0', 200, 0, [], { initial: true }),
    trans('t1', '↑PV', 200, 100),
    step('s1', '1', 200, 170, ['MD']),
    // Al llegar a la derecha: vuelve si no se ha pedido el paro; si se ha pedido, se para.
    trans('t2', 'S2 · !X11', 200, 270),
    trans('t3', 'S2 · X11', 440, 270),
    step('s2', '2', 200, 340, ['MI']),
    trans('t4', 'S1', 80, 440),
    // Grafcet parcial: recuerda el segundo pulsador, en cualquier momento, hasta volver al reposo.
    // Con !X0, el pulsador que pone la cinta en marcha no cuenta como paro.
    step('s10', '10', 700, 0, [], { initial: true }),
    trans('t10', '↑PV · !X0', 700, 100),
    step('s11', '11', 700, 170),
    trans('t11', 'X0', 700, 270),
  ]
  const edges = links([
    ['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['s1', 't3'], ['t2', 's2'], ['t3', 's0'], ['s2', 't4'], ['t4', 's1'],
    ['s10', 't10'], ['t10', 's11'], ['s11', 't11'], ['t11', 's10'],
  ])
  // Vista de frente, con gravedad, como la práctica 4: la caja se deja a mano entre los dos
  // sensores, que la ven desde arriba. Medidas comprobadas en la simulación
  // (tests/unit/practiceGuides.test.js): la caja da la vuelta sin llegar a caer por los extremos.
  const scene = {
    gravity: true,
    elements: [
      { id: 'cinta', type: 'conveyor', x: 40, y: 300, rot: 0, motor: 'MD', reverse: 'MI', length: 420, time: 5, text: 'Cinta' },
      { id: 'caja', type: 'feeder', x: 200, y: 200, rot: 0, trigger: 'Caja', auto: false, spacing: 0, sizes: 'large', material: 'plastic', color: 'amber' },
      { id: 's1', type: 'sensor', x: 100, y: 230, rot: 90, variable: 'S1', contact: 'NO', range: 60, kind: 'optical', color: 'amber' },
      { id: 's2', type: 'sensor', x: 400, y: 230, rot: 90, variable: 'S2', contact: 'NO', range: 60, kind: 'optical', color: 'amber' },
      desk('button', 'PV', 'Verde (PV)', { contact: 'NO', color: 'green' }),
      desk('button', 'Caja', 'Dejar caja', { contact: 'NO', color: 'yellow' }),
    ],
  }
  return practice({
    name: 'Cinta de ida y vuelta',
    nodes,
    edges,
    scene,
    comments: {
      PV: 'Pulsador verde (NA): marcha y, otra vez, paro a la derecha',
      S1: 'Sensor: caja en el extremo izquierdo', S2: 'Sensor: caja en el extremo derecho',
      MD: 'Motor de la cinta hacia la derecha', MI: 'Motor de la cinta hacia la izquierda',
    },
    steps: { 0: 'Reposo', 1: 'Hacia la derecha', 2: 'Hacia la izquierda', 10: 'Sin orden de paro', 11: 'Paro pedido' },
    scenarios: [
      // Paro pedido yendo a la derecha: no se para al momento, sino al llegar a S2.
      scenario('ida-vuelta', 'Marcha y paro yendo a la derecha', 13, [[0.3, 'Caja', 1], [0.6, 'Caja', 0], [2, 'PV', 1], [2.3, 'PV', 0], [8, 'PV', 1], [8.3, 'PV', 0]]),
      // Paro pedido yendo a la izquierda: no se para en S1; da la vuelta y se para en S2.
      scenario('volviendo', 'Paro yendo a la izquierda', 13, [[0.3, 'Caja', 1], [0.6, 'Caja', 0], [2, 'PV', 1], [2.3, 'PV', 0], [5, 'PV', 1], [5.3, 'PV', 0]]),
    ],
    exercise: {
      title: 'Práctica 11. Cinta de ida y vuelta',
      statement: `Una vez depositada a mano una caja en la cinta, al accionar el pulsador verde (**PV**) la caja se desplaza sobre la cinta hacia la derecha. Cuando llega al sensor (**S2**), se desplaza hacia el lado contrario hasta el otro sensor (**S1**), y así sucesivamente.\n\n- Si se vuelve a accionar el pulsador, **en cualquier momento**, la cinta se para al llegar la caja al sensor derecho.\n- Salidas: **MD** (cinta hacia la derecha) y **MI** (hacia la izquierda). Para dejar la caja, usa el botón **Dejar caja** de la planta.${TASK}`,
      parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
      checks: { warnings: false, sequence: '', scenario: '', behaviour: { scenarios: ['ida-vuelta', 'volviendo'], outputs: [], tolerance: 1, counts: true }, requirements: [{ id: 'edge' }, { id: 'or' }] },
      hints: { enabled: true, items: [
        'Dos etapas de movimiento: hacia la derecha (MD) hasta `S2` y hacia la izquierda (MI) hasta `S1`, que vuelve a la primera.',
        'Una pulsación corta en cualquier momento hay que recordarla: un grafcet parcial de dos etapas que pasa a la segunda con `↑PV · !X0` (el pulsador que arranca no cuenta) y vuelve con `X0`.',
        'Al llegar a `S2`, dos salidas excluyentes: `S2 · !X11` da la vuelta y `S2 · X11` va al reposo.',
      ] },
    },
  })
}

export const PRACTICE_GUIDES = [
  {
    id: 'guion-automatas',
    title: 'Prácticas de programación de autómatas',
    description: 'Un guion completo: normas generales, una práctica guiada con su solución y diez prácticas con autocorrección.',
    sheet: { subject: 'Integración de Sistemas', course: 'Curso 2026-2027', cycle: 'Mecatrónica Industrial', center: '', teacher: '' },
    rules:
      'A continuación tienes una serie de prácticas obligatorias de programación de autómatas. El primer paso es **adaptar el enunciado a un caso real** del mundo industrial con una dificultad parecida.\n\n- Las prácticas se simulan en el editor (planta virtual) y, si se puede, en el autómata real.\n- Cada práctica es **individual**, aunque durante el aprendizaje hayas tenido ayuda del profesor o de los compañeros. Los archivos copiados se consideran no presentados.\n- La entrega fuera de plazo se penaliza progresivamente.\n- Se valoran la ejecución y la presentación (formato, ortografía, limpieza): **30 %** la entrega y **70 %** la calidad.\n- Se entregan en **un único PDF con portada**: Exportar > Dossier lo genera con tu proyecto dentro.\n\n# Cada práctica debe incluir\n- Enunciado\n- Breve contenido teórico, si procede\n- GRAFCET\n- Conexionado de los elementos\n- Programa (ladder y AWL)\n- Tabla de variables\n- Simulación\n- Posibles mejoras o aportaciones, si procede\n- Problemas encontrados y cómo se han resuelto, si procede',
    practices: [
      { id: 'p1', guided: true, teacher: boxPositioner },
      { id: 'p2', teacher: buttonLamp },
      { id: 'p3', teacher: singleCylinder },
      { id: 'p4', teacher: conveyorEmergency },
      { id: 'p5', teacher: thirteenCycles },
      { id: 'p6', teacher: threeLights },
      { id: 'p7', teacher: ledSequence },
      { id: 'p8', teacher: sequenceSeta },
      { id: 'p9', teacher: manualClassifier },
      { id: 'p10', teacher: twoCounters },
      { id: 'p11', teacher: shuttleConveyor },
    ],
  },
]
