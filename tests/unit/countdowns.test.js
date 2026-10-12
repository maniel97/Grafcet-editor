import { describe, expect, it } from 'vitest'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { buildPlcModel } from '../../src/lib/plcModel'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { createCountdownStore, timerCountdowns } from '../../src/lib/sim/countdowns'
import { links, step, transition } from './helpers'

// 0 -(Marcha)-> 1 -(3s/X1 · [C < 9] + 2s/X1 · P)-> 0
const compiled = compile(
  buildPlcModel(
    [step('s0', '0', 0, { initial: true }), transition('t1', 'Marcha', 80), step('s1', '1', 120), transition('t2', '3s/X1 + 2s/X1 · P', 200)],
    links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']]),
    EMPTY_PLC,
  ),
)

describe('cuenta atrás de las temporizaciones en el lienzo (#9)', () => {
  it('solo con la etapa activa, la que menos falta y a la décima hacia arriba', () => {
    let state = initialState(compiled)
    expect(timerCountdowns(compiled, state).size).toBe(0)
    state = evolve(compiled, state, { Marcha: 1 }, 0).state
    expect(timerCountdowns(compiled, state).get('t2')).toBe('2.0 s')
    state = evolve(compiled, state, { Marcha: 0 }, 1.04).state
    expect(timerCountdowns(compiled, state).get('t2')).toBe('1.0 s')
    // Cumplida la de 2 s queda la de 3 s.
    state = evolve(compiled, state, {}, 2.5).state
    expect(timerCountdowns(compiled, state).get('t2')).toBe('0.5 s')
    state = evolve(compiled, state, {}, 3).state
    expect(timerCountdowns(compiled, state).size).toBe(0)
  })

  it('el almacén solo avisa si cambia algún texto', () => {
    const store = createCountdownStore()
    let calls = 0
    store.subscribe(() => calls++)
    store.set(new Map([['t2', '1.0 s']]))
    store.set(new Map([['t2', '1.0 s']]))
    expect([calls, store.get('t2')]).toEqual([1, '1.0 s'])
    store.set(new Map())
    expect([calls, store.get('t2')]).toEqual([2, null])
  })
})
