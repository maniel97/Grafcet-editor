// Ejercicios de ejemplo (Abrir > Ejercicios): cada uno parte de un ejemplo, que es su solución de
// referencia, con su enunciado y sus comprobaciones (lib/exercise.js). Al abrirlo se recibe la
// versión del alumnado, sin la solución. tests/unit/exercise.test.js comprueba que la solución
// de cada uno pasa todas sus comprobaciones.
import { EXAMPLES } from './examples'
import { normalizeProject } from './projectFile'
import { DEFAULT_EXERCISE, studentProject } from './exercise'
import { buildPneumatic, parseSequence } from './pneumatic'

const fromExample = (id) => normalizeProject(EXAMPLES.find((e) => e.id === id).build())
// Escenario de prueba: pulsar Marcha medio segundo y dejar que la máquina haga un ciclo.
const pressMarcha = (duration) => ({ id: 'prueba', name: 'Pulsar Marcha', duration, events: [{ t: 0.1, name: 'Marcha', value: 1 }, { t: 0.6, name: 'Marcha', value: 0 }] })

// Marcha a los 0,5 s y Paro (NC: pulsarlo es ponerlo a 0) a los 3 s.
const marchaParo = { id: 'marcha-paro', name: 'Marcha y Paro', duration: 5, events: [{ t: 0.5, name: 'Marcha', value: 1 }, { t: 1, name: 'Marcha', value: 0 }, { t: 3, name: 'Paro', value: 0 }, { t: 3.5, name: 'Paro', value: 1 }] }
const behaviour = (...scenarios) => ({ scenarios, outputs: [], tolerance: 0.5, counts: true })

const prepare = (project, exercise, scenarios = []) => ({
  ...project,
  plc: { ...project.plc, scenarios: [...(project.plc.scenarios ?? []), ...scenarios], exercise: { ...DEFAULT_EXERCISE, ...exercise } },
})

export const EXERCISES = [
  {
    id: 'ej-marcha-paro',
    level: 1,
    title: 'Marcha y paro de un motor',
    description: 'El primer grafcet: dos etapas, dos transiciones y una acción.',
    teacher: () =>
      prepare(fromExample('marcha-paro'), {
        title: 'Marcha y paro de un motor',
        statement:
          'Un motor se pone en marcha al pulsar **Marcha** y se para al pulsar **Paro**.\n\n- Mientras está en marcha se enciende el **Piloto**.\n- **Paro** es un pulsador normalmente cerrado (NC): sin pulsar da 1.\n- Usa las variables de la tabla.',
        checks: { warnings: false, sequence: '', scenario: '', behaviour: behaviour('marcha-paro'), requirements: [{ id: 'maxSteps', value: 3 }] },
        hints: { enabled: true, items: ['Necesitas dos etapas: una de reposo (la inicial) y otra con el motor en marcha.', 'En la etapa de marcha van dos acciones continuas: `Motor` y `Piloto`.', '**Paro** es NC: sin pulsar da 1. Para que la transición se cumpla al pulsarlo, escribe `!Paro`.'] },
      }, [marchaParo]),
  },
  {
    id: 'ej-cilindros',
    level: 2,
    title: 'Cilindros A+ B+ A− B−',
    description: 'Una secuencia de dos cilindros con sus finales de carrera; se comprueba en la planta.',
    teacher: () =>
      prepare(
        fromExample('cilindros'),
        {
          title: 'Cilindros A+ B+ A− B−',
          statement:
            'Dos cilindros de doble efecto, A y B, con sus finales de carrera (a0, a1, b0, b1). Al pulsar **Marcha**, con los dos dentro, hacen la secuencia **A+ B+ A− B−**: cada movimiento empieza cuando el anterior llega a su final de carrera.\n\n- La planta y la tabla de variables están hechas: no se pueden cambiar.\n- Pruébalo en la simulación antes de comprobar.',
          checks: { warnings: false, sequence: 'A+ B+ A- B-', scenario: 'prueba', behaviour: behaviour('prueba') },
          hints: { enabled: true, items: ['Una etapa por movimiento (A+, B+, A−, B−) y la inicial de reposo.', 'Cada transición espera el final de carrera del movimiento anterior: a1, b1, a0 y b0.', 'La primera transición es `Marcha · a0 · b0`: solo arranca con los dos cilindros dentro.'] },
        },
        [pressMarcha(8)],
      ),
  },
  {
    id: 'ej-secuencia-abba',
    level: 2,
    title: 'Secuencia A+ B+ B− A−',
    description: 'La secuencia «en sándwich»: B sale y entra mientras A está fuera.',
    teacher: () => {
      const project = normalizeProject(buildPneumatic(parseSequence('A+ B+ B- A-').groups))
      return prepare(
        { ...project, name: 'Secuencia A+ B+ B− A−' },
        {
          title: 'Secuencia A+ B+ B− A−',
          statement:
            'Dos cilindros de doble efecto, A y B, con sus finales de carrera. Al pulsar **Marcha**, con los dos dentro, hacen **A+ B+ B− A−**.\n\n- Una etapa por movimiento; cada transición espera al final de carrera del movimiento anterior.\n- Al acabar, el grafcet vuelve a su etapa inicial.',
          checks: { warnings: false, sequence: 'A+ B+ B- A-', scenario: 'prueba', behaviour: behaviour('prueba') },
          hints: { enabled: true, items: ['Una etapa por movimiento y la inicial de reposo: cinco etapas en total.', 'El orden de los finales de carrera es a1, b1, b0 y a0.'] },
        },
        [pressMarcha(8)],
      )
    },
  },
]

// Lo que recibe el alumnado al abrir un ejercicio de ejemplo.
export const exerciseForStudent = (exercise) => studentProject(exercise.teacher())
