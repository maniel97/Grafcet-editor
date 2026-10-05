import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../../src/lib/exercises'
import { runChecks, studentProject, unseal } from '../../src/lib/exercise'
import { buildPlcModel } from '../../src/lib/plcModel'

// El robot del banco de ejercicios: cada ejercicio, de principio a fin.
describe('banco de ejercicios', () => {
  it('hay ejercicios de los cinco niveles, sin ids repetidos', () => {
    expect(new Set(EXERCISES.map((e) => e.level))).toEqual(new Set([1, 2, 3, 4, 5]))
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length)
    expect(EXERCISES.length).toBeGreaterThanOrEqual(18)
  })

  for (const ex of EXERCISES) {
    describe(ex.id, () => {
      const teacher = ex.teacher()
      const config = teacher.plc.exercise

      it('la solución pasa todas sus comprobaciones', () => {
        const failed = runChecks(teacher).filter((r) => !r.ok)
        expect(failed.map((r) => `${r.title}: ${r.detail}`)).toEqual([])
      })

      it('el alumno no recibe el grafcet; las pistas van selladas', () => {
        const student = studentProject(teacher)
        expect(student.nodes.some((n) => n.type === 'step' || n.type === 'transition')).toBe(false)
        for (const hint of config.hints.items) expect(JSON.stringify(student)).not.toContain(hint)
      })

      it('el escenario de prueba hace funcionar la máquina (alguna salida cambia)', () => {
        const checks = unseal(studentProject(teacher).plc.exercise.sealed)
        expect(checks.behaviour.length).toBeGreaterThan(0)
        for (const test of checks.behaviour) {
          const changes = Object.values(test.expected.outputs).reduce((n, o) => n + o.times.length, 0)
          expect(changes, test.scenario.name).toBeGreaterThan(0)
        }
      })

      it('un grafcet estropeado (sin acciones) no pasa', () => {
        const broken = { ...teacher, nodes: teacher.nodes.map((n) => (n.type === 'step' ? { ...n, data: { ...n.data, actions: [] } } : n)) }
        const student = studentProject(teacher)
        const results = runChecks({ ...broken, plc: student.plc })
        expect(results.some((r) => !r.ok)).toBe(true)
      })

      it('el enunciado nombra las salidas y las entradas que acciona el escenario', () => {
        const model = buildPlcModel(teacher.nodes, teacher.edges, teacher.plc)
        const inputs = new Set(model.variables.filter((v) => v.type === 'input').map((v) => v.name))
        const outputs = model.variables.filter((v) => v.type === 'output').map((v) => v.name)
        const used = new Set((teacher.plc.scenarios ?? []).filter((s) => config.checks.behaviour.scenarios.includes(s.id)).flatMap((s) => s.events.map((e) => e.name)))
        const missing = [...outputs, ...[...used].filter((n) => inputs.has(n))].filter((name) => !config.statement.includes(name))
        expect(missing).toEqual([])
      })
    })
  }
})
