import { describe, expect, it } from 'vitest'
import { buildPneumatic, parseSequence } from '../../src/lib/pneumatic'
import { normalizeProject } from '../../src/lib/projectFile'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { sceneAction } from '../../src/lib/sim/scene'
import { advanceWorld, makeWorld } from '../../src/lib/sim/world'
import { validateGrafcet } from '../../src/lib/validation'
import { studentTips } from '../../src/lib/tips'

const text = (groups) => groups.map((g) => g.map((m) => m.cyl + m.dir).join('|')).join(' ')

describe('generador de secuencias neumáticas: interpretar', () => {
  it('movimientos, simultáneos entre paréntesis, guiones y comas', () => {
    const r = parseSequence('a+, B+ (C+ A−) b– C-')
    expect(r.errors).toEqual([])
    expect(text(r.groups)).toBe('A+ B+ C+|A- B- C-')
  })

  it('errores y avisos típicos', () => {
    expect(parseSequence('A+ A+ A-').errors[0]).toMatch(/A\+ dos veces seguidas/)
    expect(parseSequence('A+ (B+ B-)').errors[0]).toMatch(/dos veces en el mismo grupo/)
    expect(parseSequence('A+ x B-').errors[0]).toMatch(/«x» no es un movimiento/)
    expect(parseSequence('A+ (B+').errors).toContain('Falta cerrar un paréntesis.')
    expect(parseSequence('').errors[0]).toMatch(/Escribe una secuencia/)
    expect(parseSequence('A+ B+ A-').warnings).toEqual(['El cilindro B termina fuera y empezó dentro: el ciclo no se puede repetir.'])
  })
})

// Hace funcionar el proyecto generado con su planta; devuelve las etapas que se han activado.
function run(sequence, seconds) {
  const project = normalizeProject(buildPneumatic(parseSequence(sequence).groups))
  const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
  const scene = project.plc.scene
  const world = makeWorld(scene)
  let w = sceneAction(scene, world.init(), 'marcha', 'press')
  let inputs = world.inputs(w)
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  const visited = []
  for (let t = 0.1; t <= seconds + 1e-9; t += 0.1) {
    const r = advanceWorld(compiled, { state, inputs, world: w }, t, { world })
    ;({ state, inputs } = r)
    w = t > 0.3 ? sceneAction(scene, r.world, 'marcha', 'release') : r.world // un solo ciclo
    const label = compiled.steps.filter((s) => state.active.has(s.id)).map((s) => s.label).join()
    if (visited.at(-1) !== label) visited.push(label)
  }
  return { project, visited, world: w }
}

describe('generador de secuencias neumáticas: el resultado funciona', () => {
  it('A+ B+ B− A−: conforme, sin consejos, y un ciclo completo con la planta', () => {
    const { project, visited, world } = run('A+ B+ B- A-', 8)
    expect(validateGrafcet(project.nodes, project.edges)).toEqual([])
    expect(studentTips(project.nodes, project.edges, project.plc)).toEqual([])
    expect(project.nodes.find((n) => n.id === 't1').data.condition).toBe('Marcha · a0 · b0')
    expect(visited).toEqual(['1', '2', '3', '4', '0'])
    expect(world.pos).toMatchObject({ cilA: 0, cilB: 0 })
  })

  it('simultáneos y un cilindro que empieza fuera: A+ (B− C+) B+ (A− C−)', () => {
    const { project, visited } = run('A+ (B- C+) B+ (A- C-)', 8)
    expect(project.nodes.find((n) => n.id === 't1').data.condition).toBe('Marcha · a0 · b1 · c0')
    expect(project.nodes.find((n) => n.id === 's2').data.actions).toEqual(['B-', 'C+'])
    expect(project.nodes.find((n) => n.id === 't3').data.condition).toBe('b0 · c1')
    expect(visited).toEqual(['1', '2', '3', '4', '0'])
  })
})
