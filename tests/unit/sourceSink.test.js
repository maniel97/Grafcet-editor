import { describe, expect, it } from 'vitest'
import { validateGrafcet } from '../../src/lib/validation'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { buildPlcModel } from '../../src/lib/plcModel'
import { generateLadder } from '../../src/lib/ladder/generate'
import { toS7200 } from '../../src/lib/ladder/exportS7200'
import { createCpu, parseProgram } from '../../src/lib/plc/s7200cpu'
import { autoAssign, EMPTY_PLC } from '../../src/lib/addressing'
import { projectVariables } from '../../src/lib/symbols'
import { links, step, transition } from './helpers'

// IEC 60848: transición fuente (sin etapa anterior) y sumidero (sin etapa posterior). Una pieza
// entra (↑Pieza activa la etapa 1, «pieza presente») y sale (Retirada la desactiva). El grafcet
// de la máquina (etapa 0) es otro, independiente.
const nodes = [
  step('s0', '0', 0, { initial: true }),
  transition('tin', '↑Pieza', 100),
  step('s1', '1', 200, { actions: ['Presente'] }),
  transition('tout', 'Retirada', 300),
]
const edges = links([['tin', 's1'], ['s1', 'tout']])

describe('transiciones fuente y sumidero', () => {
  it('Verificar las admite (la fuente con flanco, sin avisos)', () => {
    const issues = validateGrafcet(nodes, edges).filter((i) => i.nodeIds?.some((id) => id === 'tin' || id === 'tout'))
    expect(issues).toEqual([])
  })
  it('Verificar avisa de una fuente sin flanco', () => {
    const level = nodes.map((n) => (n.id === 'tin' ? transition('tin', 'Pieza', 100) : n))
    expect(validateGrafcet(level, edges).some((i) => i.severity === 'warning' && /transición fuente/.test(i.message))).toBe(true)
  })
  it('suelta (sin ninguna etapa) sigue siendo un error', () => {
    const loose = [...nodes, transition('tx', 'a', 400)]
    expect(validateGrafcet(loose, edges).some((i) => i.severity === 'error' && i.nodeIds?.includes('tx'))).toBe(true)
  })
  it('simulación: la fuente activa la etapa 1 y el sumidero la desactiva', () => {
    const c = compile(buildPlcModel(nodes, edges, EMPTY_PLC))
    const on = (s) => s.active.has('s1')
    let s = initialState(c)
    s = evolve(c, s, { Pieza: 0, Retirada: 0 }, 0).state
    expect(on(s)).toBe(false)
    s = evolve(c, s, { Pieza: 1 }, 0.1).state
    expect(on(s)).toBe(true)
    expect(s.unstable).toBe(false)
    s = evolve(c, s, { Pieza: 1, Retirada: 1 }, 0.2).state
    expect(on(s)).toBe(false)
    expect(s.active.has('s0')).toBe(true)
  })
  it('una fuente de nivel no se toma por inestable', () => {
    const level = nodes.map((n) => (n.id === 'tin' ? transition('tin', 'Pieza', 100) : n))
    const c = compile(buildPlcModel(level, edges, EMPTY_PLC))
    const { state } = evolve(c, initialState(c), { Pieza: 1 }, 0)
    expect(state.unstable).toBe(false)
    expect(state.active.has('s1')).toBe(true)
  })
  it('S7-200 en la CPU simulada', () => {
    const plc = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}))
    const ladder = generateLadder(nodes, edges, plc)
    expect(ladder.warnings).toEqual([])
    const { blocks, errors } = parseProgram(toS7200(ladder, plc).text)
    expect(errors).toEqual([])
    const cpu = createCpu({ blocks })
    const v = (name) => plc.variables[name].address
    const scans = (n = 3) => {
      for (let i = 0; i < n; i++) cpu.scan(0.01)
    }
    scans()
    expect(Boolean(cpu.bits.get(v('Presente')))).toBe(false)
    cpu.bits.set(v('Pieza'), true)
    scans()
    expect(cpu.bits.get(v('Presente'))).toBe(true)
    cpu.bits.set(v('Retirada'), true)
    scans()
    expect(Boolean(cpu.bits.get(v('Presente')))).toBe(false)
  })
})
