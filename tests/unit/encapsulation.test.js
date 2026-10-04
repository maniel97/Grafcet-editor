import { describe, expect, it } from 'vitest'
import { validateGrafcet } from '../../src/lib/validation'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { buildPlcModel } from '../../src/lib/plcModel'
import { generateLadder } from '../../src/lib/ladder/generate'
import { toS7200 } from '../../src/lib/ladder/exportS7200'
import { toStructuredText } from '../../src/lib/ladder/exportText'
import { createCpu, parseProgram } from '../../src/lib/plc/s7200cpu'
import { autoAssign, EMPTY_PLC } from '../../src/lib/addressing'
import { projectVariables } from '../../src/lib/symbols'
import { links, step, transition } from './helpers'

// IEC 60848, encapsulación: la etapa 5 (encapsulante) encapsula el grafcet G5 (51 con enlace de
// activación, 52). 0 -Marcha-> 5 -Paro-> 0; dentro: 51 -a-> 52 -b-> 51.
const frame = (id, step, name, x, y, width, height) => ({ id, type: 'frame', position: { x, y }, width, height, data: { kind: 'encapsulation', step, name } })
const base = (extra = {}) => [
  step('s0', '0', 0, { initial: true, ...extra.s0 }),
  transition('t1', 'Marcha', 100),
  step('s5', '5', 200, { encapsulating: true, actions: ['Motor'], ...extra.s5 }),
  transition('t2', 'Paro', 300),
  frame('f5', '5', 'G5', 300, -60, 320, 460),
  step('s51', '51', 0, { activationLink: true, actions: ['Luz'], ...extra.s51 }, 400),
  transition('t51', 'a', 100, 400),
  step('s52', '52', 200, { actions: ['Bocina'] }, 400),
  transition('t52', 'b', 300, 400),
]
const edges = links([
  ['s0', 't1'], ['t1', 's5'], ['s5', 't2'], ['t2', 's0'],
  ['s51', 't51'], ['t51', 's52'], ['s52', 't52'], ['t52', 's51'],
])
const labels = (c, state) => [...state.active].map((id) => c.steps.find((s) => s.id === id).label).sort()
const run = (nodes, sequence, e = edges) => {
  const c = compile(buildPlcModel(nodes, e, EMPTY_PLC))
  let s = initialState(c)
  const out = []
  sequence.forEach((inputs, i) => {
    s = evolve(c, s, inputs, i * 0.1).state
    out.push(labels(c, s))
  })
  return { out, state: s }
}

describe('encapsulación (IEC 60848)', () => {
  it('Verificar: conforme', () => {
    const issues = validateGrafcet(base(), edges)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    // 51 (con *) no necesita enlace de entrada.
    expect(issues.filter((i) => i.nodeIds.includes('s51'))).toEqual([])
  })
  it('Verificar: sin enlace de activación, o con un enlace que cruza el marco, es un error', () => {
    const noLink = base({ s51: { activationLink: false } })
    expect(validateGrafcet(noLink, edges).some((i) => i.severity === 'error' && /enlace de activación/.test(i.message))).toBe(true)
    const crossing = [...edges, { id: 'x', source: 's52', target: 't2' }]
    expect(validateGrafcet(base(), crossing).some((i) => i.severity === 'error' && /cruza el marco/.test(i.message))).toBe(true)
  })
  it('simulación: entra por 51, evoluciona dentro y al salir de 5 se desactiva todo lo encapsulado', () => {
    const { out, state } = run(base(), [{}, { Marcha: 1 }, { Marcha: 0, a: 1 }, { a: 0, Paro: 1 }])
    expect(out).toEqual([['0'], ['5', '51'], ['5', '52'], ['0']])
    expect(state.values.Bocina).toBe(0)
  })
  it('encapsulación anidada: 51 encapsula a su vez G51 (511 con *)', () => {
    const nodes = [
      ...base({ s51: { encapsulating: true } }),
      { ...frame('f51', '51', 'G51', 460, -40, 140, 140) },
      step('s511', '511', 0, { activationLink: true }, 500),
    ]
    // 52 queda fuera de G51 (más abajo): se mueve el marco interior para que solo contenga 511.
    expect(validateGrafcet(nodes, edges).filter((i) => i.severity === 'error')).toEqual([])
    const { out } = run(nodes, [{}, { Marcha: 1 }, { Marcha: 0, a: 1 }, { a: 0, b: 1 }, { b: 0, Paro: 1 }])
    expect(out).toEqual([['0'], ['5', '51', '511'], ['5', '52'], ['5', '51', '511'], ['0']])
  })
  it('etapa encapsulante inicial: arranca con sus enlaces activos', () => {
    const nodes = base({ s0: { initial: false }, s5: { initial: true } })
    const { out } = run(nodes, [{}])
    expect(out[0]).toEqual(['5', '51'])
  })
  it('ST: al activar 5 se activa 51; con 5 inactiva se desactivan 51 y 52', () => {
    const nodes = base()
    const plc = autoAssign(EMPTY_PLC, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}))
    const st = toStructuredText(generateLadder(nodes, edges, plc), plc)
    expect(st).toMatch(/IF Tr1 THEN\s+X5 := TRUE;\s+X51 := TRUE;/)
    expect(st).toMatch(/IF NOT X5 THEN\s+X51 := FALSE;\s+X52 := FALSE;/)
  })
  it('S7-200 en la CPU simulada: igual que la simulación del grafcet', () => {
    const nodes = base()
    const plc = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}))
    const ladder = generateLadder(nodes, edges, plc)
    expect(ladder.warnings).toEqual([])
    const { blocks, errors } = parseProgram(toS7200(ladder, plc).text)
    expect(errors).toEqual([])
    const cpu = createCpu({ blocks })
    const set = (inputs) => {
      for (const [name, v] of Object.entries(inputs)) cpu.bits.set(plc.variables[name].address, Boolean(v))
      for (let i = 0; i < 3; i++) cpu.scan(0.01)
    }
    const out = (name) => Boolean(cpu.bits.get(plc.variables[name].address))
    set({})
    expect([out('Motor'), out('Luz')]).toEqual([false, false])
    set({ Marcha: 1 })
    expect([out('Motor'), out('Luz')]).toEqual([true, true])
    set({ Marcha: 0, a: 1 })
    expect([out('Luz'), out('Bocina')]).toEqual([false, true])
    // Paro y b a la vez: sale de 5 y, aunque 52 -b-> 51 se franquee en el mismo ciclo, nada queda dentro.
    set({ a: 0, Paro: 1, b: 1 })
    expect([out('Motor'), out('Luz'), out('Bocina')]).toEqual([false, false, false])
  })
})
