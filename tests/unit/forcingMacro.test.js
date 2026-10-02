import { describe, expect, it } from 'vitest'
import { compile, evolve, initialState, withMacros } from '../../src/lib/sim/engine'
import { buildPlcModel } from '../../src/lib/plcModel'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { parseForcing } from '../../src/lib/forcing'
import { extractSymbols } from '../../src/lib/symbols'
import { links, step, transition } from './helpers'

const frame = (id, name, kind, x, y, width, height) => ({ id, type: 'frame', position: { x, y }, width, height, data: { name, kind } })

describe('órdenes de forzado: sintaxis', () => {
  it.each([
    ['F/G2{12}', { grafcet: 'G2', mode: 'steps', steps: ['12'] }],
    ['F/G2{X3, X5}', { grafcet: 'G2', mode: 'steps', steps: ['3', '5'] }],
    ['F/g2:{}', { grafcet: 'G2', mode: 'empty', steps: [] }],
    ['F/G2{*}', { grafcet: 'G2', mode: 'freeze', steps: [] }],
    ['F/Seguridad{INIT}', { grafcet: 'SEGURIDAD', mode: 'init', steps: [] }],
  ])('%s', (text, expected) => expect(parseForcing(text)).toEqual(expected))
  it('no son forzados', () => {
    expect(parseForcing('Motor')).toBeNull()
    expect(parseForcing('F:=1')).toBeNull()
  })
  it('un forzado no crea variables', () => {
    const symbols = extractSymbols([step('s', '1', 0, { actions: ['F/G2{3}', 'Motor'] })])
    expect([...symbols.keys()]).toEqual(['Motor'])
  })
})

// G1 (x 0..300): 0 -m-> 1 -n-> 0, la etapa 1 fuerza G2.   G2 (x 400..700): 10 -a-> 11 -b-> 12 -c-> 10
function buildNodes(forcingText) {
  return [
    frame('g1', 'G1', 'grafcet', -40, -40, 300, 400),
    step('s0', '0', 0, { initial: true }),
    transition('tm', 'm', 100),
    step('s1', '1', 200, { actions: [{ text: forcingText, kind: 'continuous' }] }),
    transition('tn', 'n', 300),
    frame('g2', 'G2', 'grafcet', 360, -40, 300, 600),
    step('s10', '10', 0, { initial: true }, 400),
    transition('ta', 'a', 100, 400),
    step('s11', '11', 200, {}, 400),
    transition('tb', 'b', 300, 400),
    step('s12', '12', 400, {}, 400),
    transition('tc', 'c', 500, 400),
  ]
}
const edgesG = links([['s0', 'tm'], ['tm', 's1'], ['s1', 'tn'], ['tn', 's0'], ['s10', 'ta'], ['ta', 's11'], ['s11', 'tb'], ['tb', 's12'], ['s12', 'tc'], ['tc', 's10']])
const build = (forcingText) => compile(buildPlcModel(buildNodes(forcingText), edgesG, EMPTY_PLC))
build.nodes = buildNodes
build.edges = edgesG
const zero = { m: 0, n: 0, a: 0, b: 0, c: 0 }
function run(compiled, steps) {
  let state = evolve(compiled, initialState(compiled), zero, 0).state
  const out = []
  steps.forEach((inputs, i) => {
    state = evolve(compiled, state, { ...zero, ...inputs }, i + 1).state
    out.push([...state.active].map((id) => id.slice(1)).sort((x, y) => x - y).join(','))
  })
  return out
}

describe('forzado de grafcets parciales (simulación)', () => {
  it('pertenencia a los marcos', () => {
    const c = build('F/G2{12}')
    expect(c.grafcetOf.get('s1')).toBe('G1')
    expect(c.grafcetOf.get('s11')).toBe('G2')
  })
  it('F/G2{12}: toma la situación, no evoluciona mientras dura y sigue al soltarse', () => {
    expect(
      run(build('F/G2{12}'), [
        { a: 1 }, // G2: 10 -> 11
        { m: 1 }, // G1: 0 -> 1, que fuerza G2 a {12}
        { c: 1 }, // forzado: G2 no evoluciona aunque c = 1
        { n: 1, c: 1 }, // G1 vuelve a 0: se suelta el forzado y G2 sigue (12 -> 10)
      ]),
    ).toEqual(['0,11', '1,12', '1,12', '0,10'])
  })
  it('F/G2{}: situación vacía', () => {
    expect(run(build('F/G2{}'), [{ m: 1 }])).toEqual(['1'])
  })
  it('F/G2{*}: congela la situación actual', () => {
    expect(run(build('F/G2{*}'), [{ a: 1 }, { m: 1 }, { b: 1 }, { n: 1, b: 1 }])).toEqual(['0,11', '1,11', '1,11', '0,12'])
  })
  it('F/G2{INIT}: situación inicial', () => {
    expect(run(build('F/G2{INIT}'), [{ a: 1 }, { m: 1 }])).toEqual(['0,11', '1,10'])
  })
  it('un grafcet no se fuerza a sí mismo (se ignora)', () => {
    expect(run(build('F/G1{0}'), [{ m: 1 }])).toEqual(['1,10'])
  })
})

describe('macroetapas con expansión', () => {
  // 0 -a-> M1 -b-> 2 -c-> 0 ; expansión M1 (marco a la derecha): E1 -x-> S1
  const nodes = [
    step('s0', '0', 0, { initial: true }),
    transition('ta', 'a', 100),
    step('m1', 'M1', 200, { macro: true }),
    transition('tb', 'b', 300),
    step('s2', '2', 400),
    transition('tc', 'c', 500),
    frame('fm', 'M1', 'macro', 360, -40, 300, 300),
    step('e1', 'E1', 0, {}, 400),
    transition('tx', 'x', 100, 400),
    step('x1', 'S1', 200, {}, 400),
  ]
  const edges = links([['s0', 'ta'], ['ta', 'm1'], ['m1', 'tb'], ['tb', 's2'], ['s2', 'tc'], ['tc', 's0'], ['e1', 'tx'], ['tx', 'x1']])
  const model = buildPlcModel(nodes, edges, EMPTY_PLC)
  const compiled = compile(model)

  it('modelo: entrada y salida de la expansión', () => {
    expect(model.macros).toEqual([{ stepId: 'm1', name: 'M1', frameId: 'fm', entry: 'e1', exit: 'x1', members: ['e1', 'x1'] }])
    expect(model.transitions.find((t) => t.id === 'ta').to).toEqual(['e1'])
    expect(model.transitions.find((t) => t.id === 'tb').from).toEqual(['x1'])
  })
  it('activar M1 activa E1; lo siguiente a M1 espera a S1', () => {
    const zero = { a: 0, b: 0, c: 0, x: 0 }
    let state = evolve(compiled, initialState(compiled), zero, 0).state
    const active = () => [...withMacros(compiled, state.active)].sort().join(',')
    state = evolve(compiled, state, { ...zero, a: 1 }, 1).state
    expect(active()).toBe('e1,m1') // M1 activa mientras lo esté su expansión
    state = evolve(compiled, state, { ...zero, b: 1 }, 2).state
    expect(active()).toBe('e1,m1') // b no basta: falta S1
    state = evolve(compiled, state, { ...zero, x: 1 }, 3).state
    expect(active()).toBe('m1,x1')
    state = evolve(compiled, state, { ...zero, b: 1 }, 4).state
    expect(active()).toBe('s2')
  })
})

// Autómata mínimo: ejecuta las secciones del ladder en orden, ciclo a ciclo (solo contactos,
// serie, paralelo y bobinas, que es lo que usan estos grafcets).
function scanLadder(ladder, memory) {
  const key = (op) => (op.kind === 'step' ? `X${op.label}` : op.kind === 'first' ? 'first' : op.name)
  const evalNet = (n) => {
    switch (n.type) {
      case 'true':
        return true
      case 'false':
        return false
      case 'contact': {
        const v = !!memory[key(n.operand)]
        return n.kind === 'NC' ? !v : v
      }
      case 'series':
        return n.items.every(evalNet)
      case 'parallel':
        return n.items.some(evalNet)
      default:
        throw new Error(`no soportado: ${n.type}`)
    }
  }
  for (const s of ladder.sections) {
    for (const r of s.rungs) {
      const on = evalNet(r.network)
      for (const o of r.outputs) {
        if (o.type === 'coil') memory[key(o.operand)] = on
        else if (o.type === 'set' && on) memory[key(o.operand)] = true
        else if (o.type === 'reset' && on) memory[key(o.operand)] = false
      }
    }
  }
}

describe('forzado en el ladder: mismo comportamiento que la simulación', () => {
  it.each(['F/G2{12}', 'F/G2{}', 'F/G2{*}', 'F/G2{INIT}'])('%s', async (text) => {
    const { generateLadder } = await import('../../src/lib/ladder/generate')
    const sequence = [{ a: 1 }, { m: 1 }, { c: 1 }, { b: 1 }, { n: 1, c: 1 }, {}]
    const expected = run(build(text), sequence)

    const nodes = build.nodes(text)
    const ladder = generateLadder(nodes, build.edges, EMPTY_PLC)
    const memory = { first: true }
    scanLadder(ladder, memory)
    memory.first = false
    const got = sequence.map((inputs) => {
      Object.assign(memory, zero, inputs)
      for (let i = 0; i < 6; i++) scanLadder(ladder, memory) // varios ciclos: evolución fugaz
      return ['0', '1', '10', '11', '12'].filter((l) => memory[`X${l}`]).join(',')
    })
    expect(got).toEqual(expected)
  })
})

describe('Verificar: marcos, forzados y macroetapas', async () => {
  const { validateGrafcet } = await import('../../src/lib/validation')
  const messages = (nodes, edges) => validateGrafcet(nodes, edges).map((i) => `${i.severity}: ${i.message}`)

  it('forzados mal escritos', () => {
    const nodes = buildNodes('F/G9{1}')
    expect(messages(nodes, edgesG).join('\n')).toMatch(/error: Etapa 1: el forzado F\/G9\{…\} se refiere a un grafcet parcial que no existe/)
    expect(messages(buildNodes('F/G1{0}'), edgesG).join('\n')).toMatch(/un grafcet no puede forzarse a sí mismo/)
    expect(messages(buildNodes('F/G2{7}'), edgesG).join('\n')).toMatch(/la etapa 7 no es del grafcet G2/)
    expect(messages(buildNodes('F/G2{12}'), edgesG)).toEqual([])
  })
  it('nombres de marco repetidos', () => {
    const nodes = [...buildNodes('F/G2{12}'), frame('g3', 'g2', 'grafcet', 2000, 0, 200, 200)]
    expect(messages(nodes, edgesG).join('\n')).toMatch(/El nombre G2 está repetido en 2 marcos/)
  })
  it('macroetapa sin expansión y expansión sin macroetapa', () => {
    const nodes = [step('s0', '0', 0, { initial: true }), transition('t', 'a', 100), step('m', 'M3', 200, { macro: true }), transition('t2', 'b', 300)]
    const edges = links([['s0', 't'], ['t', 'm'], ['m', 't2'], ['t2', 's0']])
    expect(messages(nodes, edges).join('\n')).toMatch(/warning: Macroetapa M3 sin expansión/)
    const orphan = [...nodes.slice(0, 2), step('m', '3', 200), nodes[3], frame('f', 'M5', 'macro', 400, 0, 200, 200)]
    expect(messages(orphan, edges).join('\n')).toMatch(/La expansión M5 no corresponde a ninguna macroetapa/)
  })
})
