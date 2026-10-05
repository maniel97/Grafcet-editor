import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { normalizeProject } from '../../src/lib/projectFile'
import { DEFAULT_EXERCISE, isLocked, runChecks, seal, studentProject, unseal } from '../../src/lib/exercise'

const example = (id) => normalizeProject(EXAMPLES.find((e) => e.id === id).build())
const marcha = { id: 'prueba', name: 'Un ciclo', duration: 6, events: [{ t: 0.1, name: 'Marcha', value: 1 }, { t: 0.6, name: 'Marcha', value: 0 }] }

// El profesor prepara el ejemplo «Cilindros A+ B+ A− B−» como ejercicio.
function teacherCylinders() {
  const p = example('cilindros')
  return {
    ...p,
    plc: {
      ...p.plc,
      scenarios: [marcha],
      exercise: { ...DEFAULT_EXERCISE, title: 'Cilindros', statement: 'Haz la secuencia A+ B+ A− B−.', checks: { warnings: false, sequence: 'A+ B+ A- B-', scenario: 'prueba' } },
    },
  }
}
const ids = (results) => Object.fromEntries(results.map((r) => [r.id, r.ok]))

describe('ejercicios: preparar y corregir', () => {
  it('el sellado se lee de vuelta y no se ve a simple vista', () => {
    const data = { sequence: 'A+ B+', tableNames: ['Marcha'] }
    const text = seal(data)
    expect(text).not.toContain('Marcha')
    expect(unseal(text)).toEqual(data)
    expect(unseal('basura')).toBeNull()
  })

  it('la solución del profesor pasa todas sus comprobaciones', () => {
    expect(ids(runChecks(teacherCylinders()))).toEqual({ grafcet: true, norma: true, variables: true, secuencia: true })
  })

  it('el alumnado recibe el ejercicio sin la solución', () => {
    const student = studentProject(teacherCylinders())
    expect(student.nodes.some((n) => n.type === 'step' || n.type === 'transition' || n.type === 'note')).toBe(false)
    expect(student.edges).toEqual([])
    expect(student.plc.scene).toBeTruthy() // la planta se da
    expect(student.plc.exercise.student).toBe(true)
    expect(student.plc.sequence).toBeUndefined()
    expect(JSON.stringify(student)).not.toContain('A+ B+ A- B-') // la secuencia, solo sellada
    expect(isLocked(student.plc, 'plant')).toBe(true)
    // Sin grafcet: la primera comprobación falla y explica qué falta.
    const results = runChecks(student)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ id: 'grafcet', ok: false })
  })

  it('el alumno resuelve: con su grafcet copiado del profesor, todo en verde', () => {
    const teacher = teacherCylinders()
    const student = studentProject(teacher)
    const solved = { ...student, nodes: [...student.nodes, ...teacher.nodes.filter((n) => n.type !== 'note' && n.id !== 'variables-table')], edges: teacher.edges }
    expect(ids(runChecks(solved))).toEqual({ grafcet: true, norma: true, variables: true, secuencia: true })
  })

  it('errores típicos: errata en una variable y orden de la secuencia cambiado', () => {
    const teacher = teacherCylinders()
    const student = studentProject(teacher)
    const grafcet = teacher.nodes.filter((n) => n.type !== 'note' && n.id !== 'variables-table')
    // Errata: «a1» escrito «a11».
    const typo = grafcet.map((n) => (n.type === 'transition' && n.data.condition === 'a1' ? { ...n, data: { ...n.data, condition: 'a11' } } : n))
    const r1 = runChecks({ ...student, nodes: [...student.nodes, ...typo], edges: teacher.edges })
    expect(r1.find((r) => r.id === 'variables')).toMatchObject({ ok: false })
    expect(r1.find((r) => r.id === 'variables').detail).toContain('a11')
    // Secuencia cambiada: A− antes que B+ (se intercambian las acciones de las etapas 2 y 3).
    const steps = grafcet.filter((n) => n.type === 'step')
    const s2 = steps.find((s) => s.data.label === '2')
    const s3 = steps.find((s) => s.data.label === '3')
    const swapped = grafcet.map((n) => (n.id === s2.id ? { ...n, data: { ...n.data, actions: s3.data.actions } } : n.id === s3.id ? { ...n, data: { ...n.data, actions: s2.data.actions } } : n))
    const r2 = runChecks({ ...student, nodes: [...student.nodes, ...swapped], edges: teacher.edges })
    expect(r2.find((r) => r.id === 'secuencia')).toMatchObject({ ok: false })
  })

  it('sin tabla dada no se comprueban las variables', () => {
    const teacher = teacherCylinders()
    teacher.plc.exercise.parts = { ...teacher.plc.exercise.parts, variables: 'none' }
    expect(runChecks(teacher).some((r) => r.id === 'variables')).toBe(false)
    expect(studentProject(teacher).plc.variables).toBeUndefined()
  })
})

describe('ejercicios de ejemplo', async () => {
  const { EXERCISES, exerciseForStudent } = await import('../../src/lib/exercises')
  for (const ex of EXERCISES) {
    it(`${ex.id}: la solución pasa todo y el alumno empieza sin grafcet`, () => {
      const teacher = ex.teacher()
      const results = runChecks(teacher)
      expect(results.filter((r) => !r.ok).map((r) => `${r.id}: ${r.detail}`)).toEqual([])
      const student = exerciseForStudent(ex)
      expect(student.nodes.some((n) => n.type === 'step')).toBe(false)
      expect(runChecks(student)[0]).toMatchObject({ id: 'grafcet', ok: false })
    })
  }
})
