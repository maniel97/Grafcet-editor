// Ejercicios con autocorrección (fase 1). Puro: se prueba sin navegador.
//
// El profesor resuelve el ejercicio y lo prepara (plc.exercise, sin `student`): enunciado, qué
// recibe hecho el alumnado (planta, tabla de variables, esquema; dado o además bloqueado) y qué
// se comprueba. Al exportarlo para el alumnado (studentProject) la solución NO viaja: se quitan el
// grafcet, las notas y lo que no se da; las comprobaciones van selladas (ofuscadas) en `sealed`.
// El alumno pulsa «Comprobar» (runChecks) cuantas veces quiera.
//
// Comprobaciones de esta fase:
//   grafcet    hay un grafcet (etapa inicial y alguna transición)
//   norma      Verificar sin errores (y, si el profesor lo pide, sin avisos)
//   variables  con la tabla dada: solo se usan variables de la tabla (detecta erratas)
//   secuencia  con planta y escenario de prueba: los cilindros hacen la secuencia esperada
//   comportamiento (fase 2) con cada escenario elegido: las salidas cambian cuando en la solución
//              del profesor (con un margen de tiempo) y llegan las mismas piezas a cada recogida
import { N_, t } from './i18n'
import { validateGrafcet } from './validation'
import { buildPlcModel } from './plcModel'
import { extractSymbols } from './symbols'
import { parseSequence } from './pneumatic'
import { compareSpacePhase, theoreticalSpacePhase } from './sim/spacePhase'
import { runScenarioWorld, scenarioMotion } from './sim/scenarioMotion'
import { DEFAULT_TOLERANCE, compareBehaviour, expectedFrom } from './behaviour'

const TABLE_ID = 'variables-table' // nodes/VARIABLES_TABLE_ID
// Partes del proyecto del profesor que no viajan al alumnado: revelan la solución (la secuencia
// esperada, el GEMMA, los escenarios grabados con su solución, un programa del autómata) o son
// la propia preparación del ejercicio.
const SOLUTION_KEYS = ['exercise', 'sequence', 'gemma', 'scenarios', 'cpu']

// Qué recibe hecho el alumnado: 'none' (no se da), 'given' (se da y puede cambiarlo) o 'locked'.
export const PART_MODES = [
  { id: 'none', label: N_('No se da') },
  { id: 'given', label: N_('Se da') },
  { id: 'locked', label: N_('Se da bloqueado') },
]

export const DEFAULT_EXERCISE = {
  title: '',
  statement: '',
  parts: { plant: 'locked', variables: 'locked', electrical: 'given' },
  checks: { warnings: false, sequence: '', scenario: '', behaviour: { scenarios: [], outputs: [], tolerance: DEFAULT_TOLERANCE, counts: true } },
  hints: { enabled: true, items: [] },
  processData: false,
}

export const exerciseConfig = (plc) => (plc?.exercise ? { ...DEFAULT_EXERCISE, ...plc.exercise, parts: { ...DEFAULT_EXERCISE.parts, ...plc.exercise.parts }, checks: { ...DEFAULT_EXERCISE.checks, ...plc.exercise.checks, behaviour: { ...DEFAULT_EXERCISE.checks.behaviour, ...plc.exercise.checks?.behaviour } }, hints: { ...DEFAULT_EXERCISE.hints, ...plc.exercise.hints } } : null)
export const isStudent = (plc) => Boolean(plc?.exercise?.student)
export const partMode = (plc, part) => plc?.exercise?.parts?.[part] ?? (plc?.exercise ? DEFAULT_EXERCISE.parts[part] : 'given')
export const isLocked = (plc, part) => isStudent(plc) && partMode(plc, part) === 'locked'

// --- Sellado: las comprobaciones viajan ofuscadas (disuade de mirarlas; no es seguridad: ver
// el plan, la solución nunca viaja y la tabla de clase vuelve a corregir).
const KEY = 'grafcet-ejercicio'
const xor = (bytes) => bytes.map((b, i) => b ^ KEY.charCodeAt(i % KEY.length))
export function seal(data) {
  const bytes = xor(new TextEncoder().encode(JSON.stringify(data)))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
export function unseal(text) {
  try {
    const bytes = xor(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

// Lo que el corrector necesita, sacado de la solución del profesor (va sellado al alumno).
// Pruebas de comportamiento: la solución del profesor con cada escenario elegido -> lo esperado.
function behaviourFrom(project, behaviour) {
  const scenarios = (project.plc.scenarios ?? []).filter((s) => behaviour?.scenarios?.includes(s.id))
  if (!scenarios.length) return []
  const model = buildPlcModel(project.nodes, project.edges, project.plc)
  const sinks = behaviour.counts ? Object.fromEntries((project.plc.scene?.elements ?? []).filter((e) => e.type === 'sink').map((e) => [e.id, e.text || e.id])) : {}
  return scenarios.map((scenario) => ({
    scenario,
    tolerance: Number(behaviour.tolerance) || DEFAULT_TOLERANCE,
    expected: expectedFrom(runScenarioWorld(project.plc, model, scenario), behaviour.outputs, sinks),
  }))
}

function checksFrom(project, config) {
  const scenario = (project.plc.scenarios ?? []).find((s) => s.id === config.checks.scenario) ?? null
  return {
    warnings: Boolean(config.checks.warnings),
    sequence: config.checks.sequence?.trim() ?? '',
    scenario,
    // La tabla dada, para detectar variables que no están en ella.
    tableNames: config.parts.variables === 'none' ? null : Object.keys(project.plc.variables ?? {}),
    behaviour: behaviourFrom(project, config.checks.behaviour),
  }
}

// Proyecto del profesor (con su solución) -> proyecto para el alumnado (sin solución).
export function studentProject(project) {
  const config = exerciseConfig(project.plc)
  if (!config) throw new Error('El proyecto no tiene ejercicio preparado.')
  const give = (part) => config.parts[part] !== 'none'
  // Todo el proyecto (formato de direcciones, variables de etapa, cajetín…) menos lo que revela la
  // solución y lo que el profesor no da.
  const plc = Object.fromEntries(Object.entries(project.plc).filter(([key]) => !SOLUTION_KEYS.includes(key)))
  if (!give('variables')) delete plc.variables
  if (!give('plant')) delete plc.scene
  if (!give('electrical')) delete plc.electrical
  const out = {
    ...plc,
    exercise: {
      student: true,
      title: config.title,
      statement: config.statement,
      parts: config.parts,
      hints: config.hints,
      processData: config.processData,
      sealed: seal(checksFrom(project, config)),
    },
  }
  // Del lienzo solo se da la tabla de variables (si se da); el grafcet y las notas no.
  // La tabla, a la izquierda y sin colocación automática (no hay grafcet al que acompañar).
  const nodes = give('variables')
    ? project.nodes.filter((n) => n.id === TABLE_ID).map((n) => ({ ...n, position: { x: -480, y: 0 }, data: { ...n.data, autoPlace: undefined } }))
    : []
  return { name: config.title || project.name || '', nodes, edges: [], plc: out }
}

// --- Corrector ----------------------------------------------------------------------------------

const ok = (id, title, detail = '') => ({ id, ok: true, title, detail })
const fail = (id, title, detail) => ({ id, ok: false, title, detail })

// Proyecto (del alumno, o del profesor para probar su ejercicio) -> [{ id, ok, title, detail }].
export function runChecks(project) {
  const { nodes, edges, plc } = project
  const config = exerciseConfig(plc)
  if (!config) return []
  const checks = isStudent(plc) ? unseal(plc.exercise.sealed) : checksFrom(project, config)
  if (!checks) return [fail('sellado', t('El ejercicio está dañado'), t('No se han podido leer sus comprobaciones: vuelve a abrir el archivo que te dieron.'))]
  const results = []

  // 1. Hay un grafcet.
  const steps = nodes.filter((n) => n.type === 'step')
  const transitions = nodes.filter((n) => n.type === 'transition')
  const hasGrafcet = steps.some((s) => s.data.initial) && transitions.length > 0
  results.push(
    hasGrafcet
      ? ok('grafcet', t('Hay un grafcet'))
      : fail('grafcet', t('Hay un grafcet'), steps.length ? t('Falta una etapa inicial o alguna transición.') : t('Aún no has dibujado el grafcet.')),
  )
  if (!hasGrafcet) return results

  // 2. Cumple la norma (Verificar).
  const issues = validateGrafcet(nodes, edges)
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const bad = checks.warnings ? [...errors, ...warnings] : errors
  results.push(
    bad.length
      ? fail('norma', t('Cumple la norma IEC 60848'), t('Verificar encuentra {n} problemas. El primero: {mensaje}', { n: bad.length, mensaje: bad[0].message }))
      : ok('norma', t('Cumple la norma IEC 60848'), checks.warnings ? t('Sin errores ni avisos.') : t('Sin errores.')),
  )

  // 3. Solo variables de la tabla dada.
  if (checks.tableNames) {
    const known = new Set(checks.tableNames)
    const used = [...extractSymbols(nodes)].filter(([name, s]) => s.type !== 'timer' && s.type !== 'step' && !/^[XE]\d+$/.test(name)).map(([name]) => name)
    const unknown = used.filter((name) => !known.has(name))
    results.push(
      unknown.length
        ? fail('variables', t('Usa las variables de la tabla'), t('No están en la tabla: {lista}. ¿Es una errata?', { lista: unknown.join(', ') }))
        : ok('variables', t('Usa las variables de la tabla')),
    )
  }

  // 4. Secuencia de los cilindros con el escenario de prueba.
  if (checks.sequence && checks.scenario) {
    const parsed = parseSequence(checks.sequence)
    const expected = parsed.errors.length ? null : theoreticalSpacePhase(parsed.groups)
    let recorded = null
    try {
      recorded = scenarioMotion(plc, checks.scenario, buildPlcModel(nodes, edges, plc))
    } catch {
      recorded = null
    }
    const title = t('La máquina hace la secuencia {secuencia}', { secuencia: checks.sequence })
    if (!expected) results.push(fail('secuencia', title, t('La secuencia esperada del ejercicio no se puede leer.')))
    else if (!recorded) results.push(fail('secuencia', title, t('Con el escenario de prueba no se ha movido ningún cilindro: ¿falta algo para arrancar?')))
    else {
      const r = compareSpacePhase(recorded, expected)
      results.push(
        r.ok
          ? ok('secuencia', title)
          : fail(
              'secuencia',
              title,
              r.got
                ? t('Fase {fase}: se esperaba {esperado} y se ha hecho {hecho}.', { fase: r.phase, esperado: r.expected.join(' '), hecho: r.got.join(' ') })
                : t('Fase {fase}: se esperaba {esperado} y aún no ha pasado.', { fase: r.phase, esperado: r.expected.join(' ') }),
            ),
      )
    }
  }
  // 5. Comportamiento con cada escenario de prueba.
  if (checks.behaviour?.length) {
    const model = buildPlcModel(nodes, edges, plc)
    checks.behaviour.forEach((test, i) => {
      const title = t('Con «{escenario}», la máquina responde como debe', { escenario: test.scenario.name })
      let result
      try {
        result = compareBehaviour(test.expected, runScenarioWorld(plc, model, test.scenario), test.tolerance)
      } catch {
        result = { ok: false, problems: [{ text: t('El grafcet no se puede simular: revisa lo que marca Verificar.') }] }
      }
      const more = result.problems.length - 1
      results.push({
        ...(result.ok
          ? ok(`comportamiento-${i}`, title)
          : fail(`comportamiento-${i}`, title, more > 0 ? t('{problema} (y {n} diferencias más)', { problema: result.problems[0].text, n: more }) : result.problems[0].text)),
        scenario: test.scenario, // para verlo en la simulación
      })
    })
  }
  return results
}
