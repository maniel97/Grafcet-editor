import { describe, expect, it } from 'vitest'
import { checkGemma, generateConduction, TYPICAL_GEMMA } from '../../src/lib/gemma'
import { validateGrafcet } from '../../src/lib/validation'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { EMPTY_PLC } from '../../src/lib/addressing'

describe('GEMMA', () => {
  it('la configuración típica es correcta', () => expect(checkGemma(TYPICAL_GEMMA)).toEqual([]))
  it('avisa de lo que falta', () => {
    const problems = checkGemma({ production: 'G1', states: { F1: '' }, transitions: [] })
    expect(problems.join('\n')).toMatch(/Falta A1/)
    expect(problems.join('\n')).toMatch(/Del estado F1 no se sale nunca/)
  })
  it('genera un grafcet de conducción conforme, con A1 inicial y las órdenes de forzado', () => {
    const { nodes, edges, comments } = generateConduction(TYPICAL_GEMMA)
    expect(comments['gemma-D1']).toBe('D1: Parada de emergencia')
    const steps = nodes.filter((n) => n.type === 'step')
    expect(steps).toHaveLength(6)
    expect(steps.find((s) => s.data.initial).data.label).toBe('A1')
    expect(steps.find((s) => s.data.label === 'D1').data.actions).toEqual(['F/G1{}'])
    expect(steps.find((s) => s.data.label === 'A6').data.actions).toEqual(['F/G1{INIT}'])
    expect(steps.find((s) => s.data.label === 'F1').data.actions).toEqual([])
    // Conforme a la norma salvo el forzado a un G1 que aquí no existe.
    const errors = validateGrafcet(nodes, edges).filter((i) => i.severity === 'error' && !/F\/G1/.test(i.message))
    expect(errors).toEqual([])
  })
  it('se simula: marcha, emergencia, rearme y vuelta a A1', () => {
    const { nodes, edges } = generateConduction(TYPICAL_GEMMA)
    const c = compile(buildPlcModel(nodes, edges, EMPTY_PLC))
    const state = (s) => c.steps.filter((x) => s.active.has(x.id)).map((x) => x.label).join(',')
    let s = evolve(c, initialState(c), {}, 0).state
    expect(state(s)).toBe('A1')
    s = evolve(c, s, { Marcha: 1 }, 1).state
    expect(state(s)).toBe('F1')
    s = evolve(c, s, { Marcha: 0, Emergencia: 1 }, 2).state
    expect(state(s)).toBe('D1')
    s = evolve(c, s, { Emergencia: 0 }, 3).state
    expect(state(s)).toBe('A5')
    s = evolve(c, s, { Rearme: 1 }, 4).state
    expect(state(s)).toBe('A6')
    s = evolve(c, s, { Rearme: 0, Inicio_ok: 1 }, 5).state
    expect(state(s)).toBe('A1')
  })
})
