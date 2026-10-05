import { describe, expect, it } from 'vitest'
import { checkRequirements, gradeOf } from '../../src/lib/requirements'
import { PRACTICE_GUIDES } from '../../src/lib/practiceGuides'
import { EXAMPLES } from '../../src/lib/examples'

const practice = (id) => PRACTICE_GUIDES[0].practices.find((p) => p.id === id).teacher()
const example = (id) => EXAMPLES.find((e) => e.id === id).build()
const all = ['timer', 'counter', 'edge', 'or', 'and', 'conditional', 'stored'].map((id) => ({ id }))
const passed = (project) => checkRequirements(project.nodes, project.edges, all).filter((r) => r.ok).map((r) => r.id.replace('requisito-', ''))

describe('requisitos del ejercicio', () => {
  it('se reconocen en los grafcets de las prácticas', () => {
    expect(passed(practice('p1'))).toEqual(['timer', 'or']) // posicionador: temporizaciones y elección por tamaño
    expect(passed(practice('p2'))).toEqual([]) // pulsador y bombilla: lo más sencillo
    expect(passed(practice('p4'))).toEqual(['conditional']) // la cinta con las setas
    expect(passed(practice('p5'))).toEqual(['counter', 'edge', 'or', 'stored']) // trece ciclos
  })

  it('secuencias simultáneas (divergencia en Y)', () => {
    const withAnd = EXAMPLES.map((e) => e.build()).find((p) => passed(p).includes('and'))
    expect(withAnd).toBeTruthy()
  })

  it('máximo de etapas, con lo que hay', () => {
    const p = example('marcha-paro')
    expect(checkRequirements(p.nodes, p.edges, [{ id: 'maxSteps', value: 2 }])[0]).toMatchObject({ ok: true, title: 'Como mucho 2 etapas' })
    expect(checkRequirements(p.nodes, p.edges, [{ id: 'maxSteps', value: 1 }])[0]).toMatchObject({ ok: false, detail: 'Tu grafcet tiene 2 etapas.' })
  })

  it('un requisito desconocido se ignora', () => {
    expect(checkRequirements([], [], [{ id: 'inventado' }])).toEqual([])
  })
})

describe('nota', () => {
  const results = [{ ok: true }, { ok: true }, { ok: false }, { ok: true }]
  it('proporcional a los criterios cumplidos', () => {
    expect(gradeOf(results, { max: 10 })).toBe(7.5)
    expect(gradeOf(results, { max: 5 })).toBe(3.8)
  })
  it('las pistas restan lo que diga el profesor, sin bajar de 0', () => {
    expect(gradeOf(results, { max: 10, hintPenalty: 0.5 }, 2)).toBe(6.5)
    expect(gradeOf([{ ok: false }], { max: 10, hintPenalty: 1 }, 3)).toBe(0)
  })
})

describe('temporización sobre una variable', () => {
  it('1s/Pila también es una temporización (no solo 2s/X2)', () => {
    const nodes = [{ id: 't', type: 'transition', data: { condition: '1s/Pila · Marcha' } }]
    expect(checkRequirements(nodes, [], [{ id: 'timer' }])[0].ok).toBe(true)
  })
})
