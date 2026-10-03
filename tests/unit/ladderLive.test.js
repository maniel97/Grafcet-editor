import { describe, expect, it } from 'vitest'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { buildPlcModel } from '../../src/lib/plcModel'
import { generateLadder } from '../../src/lib/ladder/generate'
import { ladderLive } from '../../src/lib/ladder/live'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { links, step, transition } from './helpers'

// 0 -(Marcha · !Paro)-> 1 [Motor] -(Paro)-> 0
const nodes = [
  step('s0', '0', 0, { initial: true }),
  transition('t1', 'Marcha · !Paro', 80),
  step('s1', '1', 120, { actions: ['Motor'] }),
  transition('t2', 'Paro', 200),
]
const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']])

describe('ladder en vivo', () => {
  const ladder = generateLadder(nodes, edges, EMPTY_PLC)
  const compiled = compile(buildPlcModel(nodes, edges, EMPTY_PLC))
  const rungs = ladder.sections.flatMap((s) => s.rungs)
  const rungOf = (pred) => rungs.find(pred)
  const transitionRung = (id) => rungOf((r) => r.nodeIds?.includes(id) && r.outputs.some((o) => o.operand.kind === 'trans'))
  const motorRung = rungOf((r) => r.outputs.some((o) => o.type === 'coil' && o.operand.kind === 'var' && o.operand.name === 'Motor'))

  it('contactos y segmentos con la situación de la simulación', () => {
    let state = evolve(compiled, initialState(compiled), {}, 0).state
    let live = ladderLive(ladder, compiled, state)
    const t1 = transitionRung('t1')
    // X0 cerrado, Marcha abierto, !Paro cerrado: el segmento de la transición no conduce.
    const contacts = t1.network.items.map((c) => [c.operand.label ?? c.operand.name, c.kind, live.closed(c)])
    expect(contacts).toEqual([
      ['0', 'NO', true],
      ['Marcha', 'NO', false],
      ['Paro', 'NC', true],
    ])
    expect(live.energized(t1)).toBe(false)
    expect(live.energized(motorRung)).toBe(false)

    state = evolve(compiled, state, { Marcha: 1 }, 1).state
    live = ladderLive(ladder, compiled, state)
    expect(live.energized(motorRung)).toBe(true) // X1 activa: Motor
    expect(live.energized(t1)).toBe(false) // X0 ya no está activa
  })

  it('las marcas de transición valen lo que su propio segmento', () => {
    let state = evolve(compiled, initialState(compiled), {}, 0).state
    // Entrada aplicada pero sin evolucionar todavía: la transición está lista (Tr1 = 1).
    state = { ...state, values: { ...state.values, Marcha: 1 } }
    const live = ladderLive(ladder, compiled, state)
    const reset = rungOf((r) => r.nodeIds?.includes('t1') && r.outputs.every((o) => o.type === 'reset'))
    expect(live.energized(transitionRung('t1'))).toBe(true)
    expect(live.energized(reset)).toBe(true)
  })
})
