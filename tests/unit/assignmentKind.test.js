import { describe, expect, it } from 'vitest'
import { fixAssignmentKind, isAssignment, misplacedAssignment } from '../../src/lib/actions'
import { normalizeProject } from '../../src/lib/projectFile'
import { validateGrafcet } from '../../src/lib/validation'
import { EXAMPLES } from '../../src/lib/examples'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'

// Una asignación (C:=C+1, A:=1) como acción continua no hacía nada, sin ningún aviso: el error
// típico al empezar (la acción nueva sale continua). Ahora se corrige sola y Verificar lo marca.
const counterWithKind = (kind) => {
  const p = EXAMPLES.find((e) => e.id === 'contador').build()
  const nodes = p.nodes.map((n) =>
    n.type === 'step' ? { ...n, data: { ...n.data, actions: (n.data.actions ?? []).map((a) => (typeof a === 'object' && /C:=C\+1/.test(a.text) ? { ...a, kind } : a)) } } : n,
  )
  return { ...p, nodes }
}
const count = (project) => {
  const c = compile(buildPlcModel(project.nodes, project.edges, project.plc))
  let s = initialState(c)
  let inputs = {}
  let t = 0
  for (const [k, v] of [['Marcha', 1], ['Marcha', 0], ['P', 1], ['P', 0], ['P', 1], ['P', 0]]) {
    inputs = { ...inputs, [k]: v }
    t += 0.2
    s = evolve(c, s, inputs, t).state
  }
  return s.values.C
}

describe('asignaciones en acciones continuas', () => {
  it('se reconocen las asignaciones', () => {
    expect(['A:=1', 'C:=C+1', ' N := 5', 'Nivel.real:=0'].every(isAssignment)).toBe(true)
    expect(['Motor', 'A+', 'F/G2{3}', 'Luz OK', ''].some(isAssignment)).toBe(false)
    expect(misplacedAssignment({ text: 'C:=C+1', kind: 'continuous' })).toBe(true)
    expect(misplacedAssignment({ text: 'C:=C+1', kind: 'conditional', condition: 'a' })).toBe(true)
    expect(misplacedAssignment({ text: 'C:=C+1', kind: 'stored-on' })).toBe(false)
    expect(misplacedAssignment({ text: 'C:=C+1', kind: 'event', condition: '↑a' })).toBe(false)
  })

  it('una continua pasa a memorizada al activar; lo demás no cambia', () => {
    expect(fixAssignmentKind({ text: 'C:=C+1', kind: 'continuous', condition: '' })).toMatchObject({ kind: 'stored-on' })
    const motor = { text: 'Motor', kind: 'continuous', condition: '' }
    expect(fixAssignmentKind(motor)).toBe(motor)
    const conditional = { text: 'A:=1', kind: 'conditional', condition: 'b' }
    expect(fixAssignmentKind(conditional)).toBe(conditional) // la decide quien la escribió (Verificar avisa)
  })

  it('así no contaba; al abrir el proyecto se corrige y vuelve a contar', () => {
    const broken = counterWithKind('continuous')
    expect(count(broken)).toBe(0)
    const fixed = normalizeProject(broken)
    expect(count(fixed)).toBe(2)
  })

  it('Verificar lo marca como error si queda continua o condicionada', () => {
    const broken = counterWithKind('continuous')
    const issues = validateGrafcet(broken.nodes, broken.edges).filter((i) => i.severity === 'error')
    expect(issues.map((i) => i.message).join('\n')).toMatch(/«C:=C\+1» es una asignación y está como continua: así no hace nada/)
    const fine = counterWithKind('stored-on')
    expect(validateGrafcet(fine.nodes, fine.edges).some((i) => /es una asignación/.test(i.message))).toBe(false)
  })
})
