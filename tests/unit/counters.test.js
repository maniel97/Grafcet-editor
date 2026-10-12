import { describe, expect, it } from 'vitest'
import { counterActions, counterConditions, counterNames, declareCounter, isVariableName } from '../../src/lib/counters'
import { extractSymbols } from '../../src/lib/symbols'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { step, transition } from './helpers'

describe('atajos de contador (#7)', () => {
  it('acciones memorizadas y comparaciones excluyentes', () => {
    expect(counterActions('Piezas').map((a) => [a.text, a.kind])).toEqual([
      ['Piezas:=0', 'stored-on'],
      ['Piezas:=Piezas+1', 'stored-on'],
      ['Piezas:=Piezas-1', 'stored-on'],
    ])
    expect(counterConditions('C', 5).map((c) => c.text)).toEqual(['[C >= 5]', '[C < 5]'])
  })

  it('declara el contador solo si aún no tiene tipo', () => {
    const plc = declareCounter(EMPTY_PLC, 'C')
    expect(plc.variables.C).toEqual({ type: 'counter', address: '' })
    const marked = { ...EMPTY_PLC, variables: { N: { type: 'memory', address: 'MW10' } } }
    expect(declareCounter(marked, 'N')).toBe(marked)
    // Una variable con comentario pero sin tipo conserva lo que tenía.
    const commented = { ...EMPTY_PLC, variables: { C: { comment: 'Piezas' } } }
    expect(declareCounter(commented, 'C').variables.C).toEqual({ comment: 'Piezas', type: 'counter', address: '' })
    expect(declareCounter(EMPTY_PLC, '3C')).toBe(EMPTY_PLC)
    expect([isVariableName('C_1'), isVariableName('Piezas'), isVariableName('a b'), isVariableName('')]).toEqual([true, true, false, false])
  })

  it('contadores del proyecto: declarados o palabras que cuentan', () => {
    const nodes = [step('s0', '0', 0, { initial: true, actions: [{ text: 'N:=N+1', kind: 'stored-on' }, { text: 'A:=1', kind: 'stored-on' }] }), transition('t1', '[K > 2] · P', 80)]
    const symbols = extractSymbols(nodes)
    expect(counterNames(symbols, {})).toEqual(['N'])
    expect(counterNames(symbols, { K: { type: 'counter' } })).toEqual(['N', 'K'])
  })
})
