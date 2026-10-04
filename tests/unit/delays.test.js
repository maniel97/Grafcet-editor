import { describe, expect, it } from 'vitest'
import { generateLadder } from '../../src/lib/ladder/generate'
import { toS7200 } from '../../src/lib/ladder/exportS7200'
import { toAWL, toStructuredText } from '../../src/lib/ladder/exportText'
import { createCpu, parseProgram } from '../../src/lib/plc/s7200cpu'
import { autoAssign, EMPTY_PLC } from '../../src/lib/addressing'
import { projectVariables } from '../../src/lib/symbols'
import { links, step, transition } from './helpers'

// IEC 60848: «2s/a/1s» = a con retardo a la subida (2 s) y a la bajada (1 s). La etapa 1 está
// activa mientras lo esté la temporización: 0 -[2s/a/1s]-> 1 -[!(2s/a/1s)]-> 0.
const nodes = [
  step('s0', '0', 0, { initial: true }),
  transition('t1', '2s/a/1s', 100),
  step('s1', '1', 200, { actions: ['Luz'] }),
  transition('t2', '!(2s/a/1s)', 300),
]
const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']])
const plc = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}))
const ladder = generateLadder(nodes, edges, plc)

describe('temporización t1/a/t2 en el programa del autómata', () => {
  it('dos temporizadores en la tabla de variables', () => {
    expect(plc.variables['2s/a']).toMatchObject({ type: 'timer' })
    expect(plc.variables['a/1s']).toMatchObject({ type: 'timer' })
    expect(plc.variables.a.type).toBe('input')
    expect(ladder.warnings).toEqual([])
  })
  it('ST y AWL S7-300: los dos TON y la marca', () => {
    const st = toStructuredText(ladder, plc)
    expect(st).toContain('TON_2s_a(IN := a, PT := T#2000MS);')
    expect(st).toContain('TON_a_1s(IN := NOT a, PT := T#1000MS);')
    expect(toAWL(ladder, { mnemonic: 'en' })).toContain('S5T#1S')
  })
  it('S7-200 en la CPU simulada: sube a los 2 s de a y baja 1 s después de quitarla', () => {
    const { text } = toS7200(ladder, plc)
    const { blocks, errors } = parseProgram(text)
    expect(errors).toEqual([])
    const cpu = createCpu({ blocks })
    const a = plc.variables.a.address
    const luz = plc.variables.Luz.address
    let time = 0
    const run = (seconds, input) => {
      cpu.bits.set(a, input)
      for (const end = time + seconds; time < end - 1e-9; time += 0.05) cpu.scan(0.05)
      return Boolean(cpu.bits.get(luz))
    }
    expect(run(1.5, true)).toBe(false) // a lleva 1,5 s
    expect(run(1, true)).toBe(true) // 2,5 s: ya
    expect(run(0.5, false)).toBe(true) // quitada hace 0,5 s: sigue
    expect(run(1, false)).toBe(false) // 1,5 s: cae
    expect(run(1, true)).toBe(false) // pulso de 1 s: no llega a subir
  })
})
