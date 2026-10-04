import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { normalizeProject } from '../../src/lib/projectFile'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { sceneAction } from '../../src/lib/sim/scene'
import { advanceWorld, makeWorld } from '../../src/lib/sim/world'
import { buildSpacePhase, cylindersOf, motionSample, pushMotion } from '../../src/lib/sim/spacePhase'

// Un ejemplo con su planta, como en el editor, anotando el registro de movimientos.
function record(id, seconds, { actions = {}, byPhase = true, release = ['marcha'], dt = 0.05 } = {}) {
  const project = normalizeProject(EXAMPLES.find((e) => e.id === id).build())
  const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
  const scene = project.plc.scene
  const cylinders = cylindersOf(scene)
  const world = makeWorld(scene)
  let w = world.init()
  for (const [elementId, action] of Object.entries(actions)) w = sceneAction(scene, w, elementId, action)
  let inputs = world.inputs(w)
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  const phase = (s) => (byPhase ? [...s.active].sort().join(',') : null)
  let trace = pushMotion([], motionSample(0, w, cylinders, phase(state)))
  for (let t = dt; t <= seconds + 1e-9; t += dt) {
    // Marcha es un pulsador: se suelta al medio segundo.
    if (t >= 0.5 && t - dt < 0.5) for (const elementId of release) w = sceneAction(scene, w, elementId, 'release')
    const r = advanceWorld(compiled, { state, inputs, world: w }, t, { world })
    ;({ state, inputs } = r)
    w = r.world
    trace = pushMotion(trace, motionSample(t, w, cylinders, phase(state)))
  }
  return { diagram: buildSpacePhase(trace, cylinders), trace }
}

const levels = (diagram) => Object.fromEntries(diagram.rows.map((r) => [r.name, r.levels.map((v) => Math.round(v))]))

describe('diagrama espacio-fase', () => {
  it('A+ B+ A− B−: el diagrama de libro, fase a fase', () => {
    const { diagram } = record('cilindros', 8, { actions: { marcha: 'press' } })
    expect(diagram.phases).toHaveLength(4)
    expect(levels(diagram)).toEqual({ A: [0, 1, 1, 0, 0], B: [0, 0, 1, 1, 0] })
    // Las fases van seguidas y crecen en el tiempo.
    for (let i = 1; i < diagram.phases.length; i++) expect(diagram.phases[i].start).toBeCloseTo(diagram.phases[i - 1].end, 5)
  })

  it('con saltos grandes (simulación rápida) sale el mismo diagrama', () => {
    const { diagram } = record('cilindros', 8, { actions: { marcha: 'press' }, dt: 0.25 })
    expect(levels(diagram)).toEqual({ A: [0, 1, 1, 0, 0], B: [0, 0, 1, 1, 0] })
  })

  it('sin etapas (autómata): las fases se cortan por los movimientos y salen las mismas', () => {
    const { diagram } = record('cilindros', 8, { actions: { marcha: 'press' }, byPhase: false })
    expect(levels(diagram)).toEqual({ A: [0, 1, 1, 0, 0], B: [0, 0, 1, 1, 0] })
  })

  it('una espera entre movimientos es una fase (taladradora: baja, repasa 2 s, sube)', () => {
    const { diagram } = record('taladradora', 10, { actions: { pieza: 'toggle', marcha: 'press' } })
    expect(levels(diagram)).toEqual({ Broca: [0, 1, 1, 0] })
    expect(diagram.phases[1].end - diagram.phases[1].start).toBeCloseTo(2, 1)
  })

  it('sin movimiento no hay diagrama; el registro no crece si nada cambia', () => {
    const { diagram, trace } = record('cilindros', 3)
    expect(diagram).toBeNull()
    expect(trace).toHaveLength(1)
    expect(buildSpacePhase([], [{ id: 'A', name: 'A' }])).toBeNull()
  })
})

describe('cilindros que aparecen a mitad de la simulación', () => {
  it('cuentan como dentro (0) en las muestras de antes, sin NaN', () => {
    const cylinders = [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }]
    const trace = [
      { t: 0, pos: { A: 0 }, phase: 's1' },
      { t: 1, pos: { A: 1 }, phase: 's1' },
      { t: 2, pos: { A: 1, B: 0.5 }, phase: 's2' },
    ]
    const diagram = buildSpacePhase(trace, cylinders)
    for (const r of diagram.rows) for (const v of r.levels) expect(Number.isFinite(v)).toBe(true)
    expect(diagram.rows[1].levels[0]).toBe(0)
  })
})
