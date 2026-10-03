import { describe, expect, it } from 'vitest'
import { junctions, nextTerminalNumber, wireNumbers } from '../../src/lib/elec/wiring'
import { elecAction, elecInit, elecStep } from '../../src/lib/elec/solve'
import { ELEC_TEMPLATES } from '../../src/lib/elec/templates'

const build = (id) => {
  const b = ELEC_TEMPLATES.find((t) => t.id === id).build(0, 0, 'p')
  return { components: b.components, wires: b.wires }
}

describe('cableado de plano', () => {
  it('números de cable: uno por red; los de un embarrado, su potencial', () => {
    const s = build('marcha-paro')
    const nums = wireNumbers(s)
    const byEnds = (a, b) => nums[s.wires.find((w) => (w.from.c === a && w.to.c === b) || (w.from.c === b && w.to.c === a)).id]
    expect(byEnds('p-L', 'p-S0')).toBe('L')
    expect(byEnds('p-KM1', 'p-N')).toBe('N')
    // S0:12 sale hacia S1 y hacia el 13-14 de KM1: misma red, mismo número.
    expect(byEnds('p-S0', 'p-S1')).toBe(byEnds('p-S0', 'p-KM1h'))
    expect(byEnds('p-S0', 'p-S1')).toMatch(/^\d+$/)
    expect(byEnds('p-S1', 'p-KM1')).not.toBe(byEnds('p-S0', 'p-S1'))
  })

  it('puntos de unión: en un borne con dos cables y en las tomas de un embarrado', () => {
    const s = build('marcha-paro')
    const j = junctions(s)
    expect(j['p-S0:12']).toBe(true) // sale a S1 y al contacto de KM1
    expect(j['p-L:t2']).toBe(true) // toma del embarrado
    expect(j['p-S1:13']).toBeUndefined()
  })

  it('bornas: unen arriba y abajo (el cable sigue por la regleta) y se numeran solas', () => {
    const s = {
      components: [
        { id: 'L', type: 'rail', x: 0, y: 0, potential: 'L' },
        { id: 'N', type: 'rail', x: 0, y: 0, potential: 'N' },
        { id: 'X', type: 'terminal', x: 0, y: 0, tag: 'X1', n: 1 },
        { id: 'H', type: 'lamp', x: 0, y: 0, tag: 'H1' },
      ],
      wires: [
        { id: 'a', from: { c: 'L', t: 't0' }, to: { c: 'X', t: '1' } },
        { id: 'b', from: { c: 'X', t: '2' }, to: { c: 'H', t: 'X1' } },
        { id: 'c', from: { c: 'H', t: 'X2' }, to: { c: 'N', t: 't0' } },
      ],
    }
    expect(elecStep(s, elecInit(), {}, 0.05).state.view.loads.H).toBe(true)
    expect(wireNumbers(s)).toMatchObject({ a: 'L', b: 'L' }) // misma red a los dos lados de la borna
    expect(nextTerminalNumber(s.components, 'X1')).toBe(2)
    expect(nextTerminalNumber(s.components, 'X2')).toBe(1)
    expect(elecAction(s, elecInit(), 'X', 'toggle')).toEqual(expect.objectContaining({ pressed: {} }))
  })
})
