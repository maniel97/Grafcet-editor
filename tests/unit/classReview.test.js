import { describe, expect, it } from 'vitest'
import { classCsv, reviewSubmission, similarPairs, studentName, teacherSealed } from '../../src/lib/classReview'
import { seal, studentProject } from '../../src/lib/exercise'
import { EXERCISES } from '../../src/lib/exercises'

const exercise = EXERCISES.find((e) => e.id === 'ej-marcha-paro')
const teacher = exercise.teacher()
const sealed = teacherSealed(teacher)
const grafcet = teacher.nodes.filter((n) => n.type === 'step' || n.type === 'transition')

// Entrega de un alumno: su versión del ejercicio con un grafcet dibujado.
function submission(name, nodes = grafcet, edges = teacher.edges, extra = {}) {
  const base = studentProject(teacher)
  return { ...base, nodes: [...base.nodes, ...nodes], edges, plc: { ...base.plc, dossier: { cover: { student: name } }, exercise: { ...base.plc.exercise, ...extra } } }
}
// La misma solución, dibujada por otra persona (otras posiciones).
const moved = grafcet.map((n, i) => ({ ...n, position: { x: n.position.x + 37 + i * 3, y: n.position.y * 1.3 + 11 } }))

describe('corregir las entregas de una clase', () => {
  it('nombre del alumno: portada del dossier, cajetín o archivo', () => {
    expect(studentName({ plc: { dossier: { cover: { student: 'Ana Pérez' } } } })).toBe('Ana Pérez')
    expect(studentName({ plc: { titleBlock: { author: 'Luis' } } })).toBe('Luis')
    expect(studentName({ plc: {} }, 'marta_gil.pdf')).toBe('marta gil')
  })

  it('una entrega correcta, y otra vacía', () => {
    const ok = reviewSubmission(submission('Ana'), 'ana.pdf', sealed)
    expect(ok).toMatchObject({ name: 'Ana', passed: ok.total, ownChecks: false })
    const empty = reviewSubmission(submission('Luis', [], []), 'luis.pdf', sealed)
    expect(empty.passed).toBe(0)
  })

  it('se corrige con las comprobaciones del profesor aunque el alumno haya cambiado las suyas', () => {
    // Un alumno «arregla» su archivo: comprobaciones vacías y un grafcet que no funciona.
    const broken = grafcet.map((n) => (n.data?.condition === '!Paro' ? { ...n, data: { ...n.data, condition: 'Paro' } } : n))
    const tampered = submission('Pepe', broken, teacher.edges, { sealed: seal({ warnings: false, sequence: '', scenario: null, tableNames: null, behaviour: [] }) })
    expect(reviewSubmission(tampered, 'pepe.pdf', null).passed).toBe(reviewSubmission(tampered, 'pepe.pdf', null).total) // con las suyas, «todo bien»
    const r = reviewSubmission(tampered, 'pepe.pdf', sealed)
    expect(r.passed).toBeLessThan(r.total) // con las del profesor, no
  })

  it('parecidos: avisa del mismo dibujo, no de dos soluciones correctas hechas por separado', () => {
    const rows = [
      reviewSubmission(submission('Ana'), 'ana.pdf', sealed),
      reviewSubmission(submission('Copia de Ana'), 'copia.pdf', sealed),
      reviewSubmission(submission('Luis', moved), 'luis.pdf', sealed),
    ]
    const pairs = similarPairs(rows)
    expect(pairs.map((p) => [rows[p.a].name, rows[p.b].name])).toEqual([['Ana', 'Copia de Ana']])
  })

  it('CSV para la hoja de cálculo: punto y coma, criterios, pistas, nota y parecidos', () => {
    const rows = [reviewSubmission(submission('Ana', grafcet, teacher.edges, { hintsShown: 2 }), 'ana.pdf', { ...sealed, grade: { enabled: true, max: 10, hintPenalty: 0.5 } }), reviewSubmission(submission('Copia; "Ana"'), 'copia.pdf', sealed)]
    const csv = classCsv(rows, similarPairs(rows))
    const [head, ana, copy] = csv.replace('﻿', '').trim().split('\r\n')
    expect(head.startsWith('Alumno/a;Archivo;Correctas;Total;Hay un grafcet;')).toBe(true)
    expect(head).toContain(';Pistas vistas;Nota;Parecido a;Avisos')
    expect(ana).toContain(';sí;')
    expect(ana).toMatch(/;2;9(,\d)?;/) // 2 pistas: 10 − 2 × 0,5
    expect(copy.startsWith('"Copia; ""Ana"""')).toBe(true)
    expect(ana).toContain(';"Copia; ""Ana""";') // «parecido a», bien entrecomillado
  })
})
