import { describe, expect, it } from 'vitest'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { explainTransition, showExpression, waitingFor } from '../../src/lib/sim/explain'
import { parseCondition } from '../../src/lib/sim/expression'
import { buildPlcModel } from '../../src/lib/plcModel'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { links, step, transition } from './helpers'

// 0 -(Marcha · !Paro)-> 1 -(5s/X1)-> 2 -(↑b)-> 0
const build = () => {
  const nodes = [
    step('s0', '0', 0, { initial: true }),
    transition('t1', 'Marcha · !Paro', 80),
    step('s1', '1', 120),
    transition('t2', '5s/X1', 200),
    step('s2', '2', 240),
    transition('t3', '↑b', 320),
  ]
  const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['t3', 's0']])
  return compile(buildPlcModel(nodes, edges, EMPTY_PLC))
}
const start = (c) => {
  const state = initialState(c)
  return { state: evolve(c, state, {}, 0).state, inputs: { Marcha: 0, Paro: 0, b: 0 } }
}

describe('«¿Por qué no avanza?»', () => {
  it('muestra las expresiones con la notación del editor', () => {
    expect(showExpression(parseCondition('a · (b + !c) · ↑d'))).toBe('a · (b + !c) · ↑d')
    expect(showExpression(parseCondition('!(a + b)'))).toBe('!(a + b)')
  })

  it('validada: dice qué término de la receptividad falta y su valor', () => {
    const c = build()
    const sim = start(c)
    const e = explainTransition(c, sim, 't1')
    expect(e.status).toBe('waiting')
    expect(e.summary).toBe('Validada, espera a Marcha (vale 0).')
    expect(e.receptivity.children.map((x) => [x.text, x.ok, x.detail])).toEqual([
      ['Marcha', false, 'vale 0'],
      ['!Paro', true, 'vale 0'],
    ])
    // Una entrada cambiada en pausa ya cuenta (se aplica en el próximo ciclo).
    const ready = explainTransition(c, { ...sim, inputs: { ...sim.inputs, Marcha: 1 } }, 't1')
    expect(ready.status).toBe('ready')
  })

  it('no validada: nombra la etapa anterior que falta', () => {
    const c = build()
    const e = explainTransition(c, start(c), 't2')
    expect(e.status).toBe('not-validated')
    expect(e.summary).toBe('No está validada: X1 no está activa.')
  })

  it('temporización: el tiempo que queda', () => {
    const c = build()
    let { state } = start(c)
    state = evolve(c, state, { Marcha: 1 }, 1).state
    const e = explainTransition(c, { state: { ...state, time: 3 }, inputs: { Marcha: 1 } }, 't2')
    expect(e.receptivity.detail).toBe('quedan 3 s')
    expect(e.status).toBe('waiting')
  })

  it('flanco: explica que hace falta un cambio aunque la variable ya valga 1', () => {
    const c = build()
    let { state } = start(c)
    state = evolve(c, state, { Marcha: 1 }, 1).state
    state = evolve(c, state, { Marcha: 1, b: 1 }, 7).state // X1 -> X2 con b ya a 1
    expect([...state.active]).toEqual(['s2'])
    const e = explainTransition(c, { state, inputs: { Marcha: 1, b: 1 } }, 't3')
    expect(e.status).toBe('waiting')
    expect(e.receptivity.detail).toMatch(/^b ya vale 1: hace falta que cambie/)
  })

  it('resumen de lo que espera el grafcet', () => {
    const c = build()
    const w = waitingFor(c, start(c))
    expect(w.stuck).toBe(false)
    expect(w.list.map((e) => e.id)).toEqual(['t1'])
  })

  it('grafcet bloqueado: ninguna transición validada', () => {
    const nodes = [step('s0', '0', 0, { initial: true }), transition('t1', 'a', 80), step('s1', '1', 120), transition('t2', 'b', 200)]
    const c = compile(buildPlcModel(nodes, links([['s0', 't1'], ['t1', 's1']]), EMPTY_PLC))
    let { state } = start(c)
    state = evolve(c, state, { a: 1 }, 1).state
    const w = waitingFor(c, { state, inputs: { a: 1 } })
    expect(w.stuck).toBe(true)
    expect(explainTransition(c, { state, inputs: {} }, 't2').summary).toBe('No tiene ninguna etapa anterior enlazada: nunca se valida.')
  })
})
