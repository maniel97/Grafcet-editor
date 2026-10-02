import { describe, expect, it } from 'vitest'
import { compile, initialState, evolve } from '../../src/lib/sim/engine'
import { advanceWithEvents, chronogramCsv, recordEvent, runScenario } from '../../src/lib/sim/scenario'
import { buildPlcModel } from '../../src/lib/plcModel'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { links, step, transition } from './helpers'

// 0 --Marcha--> 1 (Motor) --Paro--> 0
const nodes = [
  { ...step('s0', '0', 0), data: { label: '0', initial: true, actions: [] } },
  transition('t1', 'Marcha', 100),
  { ...step('s1', '1', 200), data: { label: '1', actions: ['Motor'] } },
  transition('t2', 'Paro', 300),
]
const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']])
const compiled = compile(buildPlcModel(nodes, edges, EMPTY_PLC))
const start = () => {
  const state = initialState(compiled)
  return { state: evolve(compiled, state, { Marcha: 0, Paro: 0 }, 0).state, inputs: { Marcha: 0, Paro: 0 } }
}
const active = (state) => [...state.active].sort().join()

describe('escenarios de simulación', () => {
  it('grabar: no repite valores y redondea el instante', () => {
    let ev = recordEvent([], 0.12345, 'Marcha', 1)
    ev = recordEvent(ev, 0.2, 'Marcha', 1)
    ev = recordEvent(ev, 0.3, 'Marcha', 0)
    expect(ev).toEqual([
      { t: 0.123, name: 'Marcha', value: 1 },
      { t: 0.3, name: 'Marcha', value: 0 },
    ])
    expect(recordEvent([], 1, 'Paro', 0)).toEqual([]) // ya estaba a 0
  })

  it('una pulsación corta no se pierde aunque el tiempo avance a saltos (×10)', () => {
    const scenario = { events: [{ t: 1, name: 'Marcha', value: 1 }, { t: 1.03, name: 'Marcha', value: 0 }], duration: 3 }
    const { state, inputs } = start()
    const r = advanceWithEvents(compiled, state, inputs, 1.5, scenario, 0)
    expect(r.next).toBe(2)
    expect(r.inputs.Marcha).toBe(0)
    expect(active(r.state)).toBe('s1')
    expect(r.events.map((e) => e.transitionId)).toEqual(['t1'])
  })

  it('reproducción completa: marcha, paro y vuelta al reposo', () => {
    const scenario = {
      events: [
        { t: 0.5, name: 'Marcha', value: 1 },
        { t: 0.6, name: 'Marcha', value: 0 },
        { t: 2, name: 'Paro', value: 1 },
        { t: 2.1, name: 'Paro', value: 0 },
      ],
      duration: 3,
    }
    const r = runScenario(compiled, start(), scenario)
    expect(r.events.map((e) => [e.transitionId, Math.round(e.time * 10) / 10])).toEqual([
      ['t1', 0.5],
      ['t2', 2],
    ])
    expect(active(r.state)).toBe('s0')
  })

  it('cronograma en CSV', () => {
    const csv = chronogramCsv(
      [
        { t: 0, values: { X0: 1, Motor: 0 } },
        { t: 0.5, values: { X0: 0, Motor: 1 } },
      ],
      [{ name: 'X0' }, { name: 'Motor' }],
    )
    expect(csv.split('\r\n')).toEqual(['t (s);X0;Motor', '0.000;1;0', '0.500;0;1'])
  })
})
