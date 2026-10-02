import { describe, expect, it } from 'vitest'
import { rawRange, toRaw } from '../../src/lib/analog'
import { extractSymbols } from '../../src/lib/symbols'
import { generateLadder } from '../../src/lib/ladder/generate'
import { toStructuredText } from '../../src/lib/ladder/exportText'
import { toS7200 } from '../../src/lib/ladder/exportS7200'
import { autoAssign, EMPTY_PLC } from '../../src/lib/addressing'
import { projectVariables } from '../../src/lib/symbols'
import { links, step, transition } from './helpers'

describe('escalado de analógicas', () => {
  it('valor bruto según señal y autómata', () => {
    expect(rawRange('4-20mA', 's7200')).toEqual([6400, 32000])
    expect(rawRange('0-10V', 's7200')).toEqual([0, 32000])
    expect(rawRange('4-20mA', 'siemens')).toEqual([0, 27648])
    const temp = { signal: '4-20mA', min: 0, max: 100 }
    expect(toRaw(60, temp, 's7200')).toBe(6400 + 0.6 * 25600) // 21760
    expect(toRaw(0, temp, 's7200')).toBe(6400)
    expect(toRaw(150, temp, 's7200')).toBe(32000) // fuera de rango: se recorta
    expect(toRaw(2.5, { signal: '0-10V', min: 0, max: 5 }, 'siemens')).toBe(13824)
  })
  it('una entrada comparada con números es analógica', () => {
    const symbols = extractSymbols([transition('t', 'Temperatura > 60 · Marcha', 0)])
    expect(symbols.get('Temperatura').type).toBe('analogIn')
    expect(symbols.get('Marcha').type).toBe('input')
  })
})

// 0 -Marcha-> 1 (Calentar) -Temperatura >= 60-> 2 (Velocidad := 50 al activarse) -Temperatura < 30-> 0
const nodes = [
  step('s0', '0', 0, { initial: true }),
  transition('t1', 'Marcha', 100),
  step('s1', '1', 200, { actions: ['Calentar'] }),
  transition('t2', 'Temperatura >= 60', 300),
  step('s2', '2', 400, { actions: [{ text: 'Velocidad:=50', kind: 'stored-on' }] }),
  transition('t3', 'Temperatura < 30', 500),
]
const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['t3', 's0']])

describe('umbrales precalculados en el programa', () => {
  const symbols = projectVariables(nodes, {})
  const base = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, nodes.filter((n) => n.type === 'step'), symbols)
  const plc = {
    ...base,
    variables: {
      ...base.variables,
      Temperatura: { ...base.variables.Temperatura, signal: '4-20mA', min: 0, max: 100 },
      Velocidad: { ...base.variables.Velocidad, type: 'analogOut', signal: '0-10V', min: 0, max: 100, address: 'AQW0' },
    },
  }
  const ladder = generateLadder(nodes, edges, plc)
  it('direcciones AIW y comparaciones en bruto (S7-200)', () => {
    expect(plc.variables.Temperatura.address).toBe('AIW0')
    const { text } = toS7200(ladder, plc)
    expect(text).toContain('AW>=   AIW0, +21760') // 60 °C con 4–20 mA (en serie con la etapa)
    expect(text).toContain('AW<    AIW0, +14080') // 30 °C
    expect(text).toContain('MOVW   +16000, VW900') // Velocidad := 50 % con 0–10 V
    expect(text).toContain('MOVW   VW900, AQW0')
    expect(ladder.warnings).toEqual([])
  })
  it('también en el ST (los umbrales en bruto, la receptividad física en el comentario)', () => {
    const st = toStructuredText(ladder, plc)
    expect(st).toContain('(Temperatura >= 21760)')
    expect(st).toContain('«Temperatura >= 60»')
  })
  it('avisa de lo que necesitaría escalar en el PLC', () => {
    const calc = nodes.map((n) => (n.id === 's2' ? step('s2', '2', 400, { actions: [{ text: 'Velocidad:=Temperatura*2', kind: 'stored-on' }] }) : n))
    const warnings = generateLadder(calc, edges, plc).warnings.map((w) => w.message)
    expect(warnings.some((w) => /necesitaría escalar/.test(w))).toBe(true)
  })
})
