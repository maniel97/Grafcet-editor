import { describe, expect, it } from 'vitest'
import { buildExerciseSheet, fingerprint, sheetCriteria, sheetScenarios } from '../../src/lib/exerciseSheet'
import { studentProject, unseal } from '../../src/lib/exercise'
import { EXERCISES } from '../../src/lib/exercises'

// Medida aproximada (Helvetica ~0,5 em por carácter): basta para maquetar en los tests.
const measure = (text, size) => String(text).length * size * 0.3528 * 0.5

const sealedChecks = (id) => unseal(studentProject(EXERCISES.find((e) => e.id === id).teacher()).plc.exercise.sealed)

describe('hoja de prácticas del ejercicio', () => {
  it('huella estable y corta', () => {
    expect(fingerprint('abc')).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/)
    expect(fingerprint('abc')).toBe(fingerprint('abc'))
    expect(fingerprint('abc')).not.toBe(fingerprint('abd'))
  })

  it('criterios en palabras, a partir de las comprobaciones selladas', () => {
    const criteria = sheetCriteria(sealedChecks('ej-cilindros'))
    expect(criteria).toContain('Usa solo las variables de la tabla que se da.')
    expect(criteria.some((c) => c.includes('los cilindros hacen la secuencia A+ B+ A- B-'))).toBe(true)
    expect(criteria.some((c) => c.includes('responde como la solución del profesor') && c.includes('±0,5 s'))).toBe(true)
  })

  it('el escenario de prueba sale una vez aunque lo usen dos criterios', () => {
    expect(sheetScenarios(sealedChecks('ej-cilindros')).map((s) => s.name)).toEqual(['Pulsar Marcha'])
  })

  it('maqueta: cabecera para rellenar, secciones, escenario en tabla, huella en el pie y nada fuera de la página', () => {
    const checks = sealedChecks('ej-marcha-paro')
    const { pages } = buildExerciseSheet(
      {
        title: 'Marcha y paro de un motor',
        sheet: { subject: 'Automatismos', course: '1.º', teacher: 'Ana' },
        statement: 'Un motor se pone en marcha al pulsar **Marcha**.',
        parts: { variables: 'locked', plant: 'none', electrical: 'given' },
        variables: [['Marcha', 'Entrada', 'I0.0', 'Pulsador NA']],
        figures: {},
        checks,
        attachment: 'marcha-y-paro.json',
        print: 'abcd-ef01-2345',
      },
      measure,
    )
    const texts = pages.flatMap((p) => p.items.filter((i) => i.t === 'text').map((i) => i.text))
    for (const expected of ['Alumno/a', 'Grupo', 'Fecha', '1. Enunciado', '2. Material que se da', '3. Criterios de evaluación', '4. Cómo se hace', 'Profesor/a: Ana']) {
      expect(texts).toContain(expected)
    }
    expect(texts.join(' ')).toContain('Escenario «Marcha y Paro»')
    expect(texts.join(' ')).toContain('marcha-y-paro.json')
    for (const p of pages) {
      expect(p.items.some((i) => i.t === 'text' && i.text.includes('abcd-ef01-2345'))).toBe(true)
      for (const i of p.items) {
        if (i.t !== 'text') continue
        expect(i.y).toBeLessThanOrEqual(p.h - 5)
        if (i.align !== 'right') expect(i.x + measure(i.text, i.size)).toBeLessThanOrEqual(p.w - 17)
      }
    }
  })
})
