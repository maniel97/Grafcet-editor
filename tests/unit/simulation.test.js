import { describe, expect, it } from 'vitest'
import { evaluate, parseAssignment, parseCondition, evaluateArithmetic, stepDelay } from '../../src/lib/sim/expression'
import { compile, evolve, initialState, inspect } from '../../src/lib/sim/engine'
import { buildPlcModel } from '../../src/lib/plcModel'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { links, step, transition } from './helpers'

describe('intérprete de receptividades', () => {
  const ctx = { value: (n) => ({ a: 1, b: 0, C: 3 })[n] ?? 0, step: (l) => l === '2', elapsed: () => 6 }
  const ev = (t) => evaluate(parseCondition(t), ctx)

  it.each([
    ['a · b', 0],
    ['a + b', 1],
    ['!b · a', 1],
    ['!(a + b)', 0],
    ['a AND NOT b', 1],
    ['b · 0 + a', 1],
    ['X2', 1],
    ['5s/X2', 1],
    ['10s/X2', 0],
    ['C >= 3', 1],
    ['C != 3', 0],
    ['1', 1],
  ])('%s = %i', (expr, expected) => expect(ev(expr)).toBe(expected))

  it.each([
    ['a b', /Falta un operador antes de «b»/],
    ['a ·', /incompleta/],
    ['(a + b', /Falta «\)»/],
    ['5s/', /Falta un nombre al final/],
    ['a $ b', /Carácter no válido «\$»/],
  ])('error claro en «%s»', (expr, message) => expect(() => parseCondition(expr)).toThrow(message))

  it('asignaciones aritméticas', () => {
    const a = parseAssignment('N := (N + 2) * 3')
    expect(a.target).toBe('N')
    expect(evaluateArithmetic(a.value, { value: () => 1 })).toBe(9)
    expect(parseAssignment('Motor ON')).toBe(null)
  })
})

const compiled = (nodes, edges) => compile(buildPlcModel(nodes, edges, EMPTY_PLC))

// IEC 60848: temporización sobre cualquier variable, con retardo a la subida y a la bajada
// (t1/a/t2), y condiciones numéricas entre corchetes.
describe('temporizaciones t1/a/t2 y corchetes', () => {
  it('se interpretan', () => {
    expect(parseCondition('3s/a/2s')).toEqual({ op: 'delay', on: 3, off: 2, arg: { op: 'var', name: 'a' } })
    expect(parseCondition('500ms/b')).toEqual({ op: 'delay', on: 0.5, off: 0, arg: { op: 'var', name: 'b' } })
    expect(parseCondition('5s/X2')).toEqual({ op: 'timer', seconds: 5, step: '2' })
    expect(parseCondition('0s/X2/1s').op).toBe('delay')
    expect(evaluate(parseCondition('[C >= 3] · a'), { value: (n) => ({ C: 4, a: 1 })[n], step: () => false })).toBe(1)
  })
  it('sube t1 después de a y baja t2 después', () => {
    let st = null
    const d = { on: 2, off: 1 }
    const trace = [[0, 1], [1, 1], [2, 1], [3, 0], [3.5, 0], [4, 0], [5, 1], [6, 0]].map(([time, a]) => {
      st = stepDelay(st, Boolean(a), time, d)
      return st.out ? 1 : 0
    })
    // 0 s: a sube; 2 s: sale; 3 s: a baja; 4 s: 1 s después, cae; 5–6 s: pulso corto, no sale.
    expect(trace).toEqual([0, 0, 1, 1, 1, 0, 0, 0])
  })
  it('en la simulación: un pulso corto de a no franquea «2s/a»; mantenido, sí', () => {
    const nodes = [step('s0', '0', 0, { initial: true }), transition('t1', '2s/a', 100), step('s1', '1', 200), transition('t2', 'b', 300)]
    const c = compiled(nodes, links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']]))
    let s = initialState(c)
    for (const [time, a] of [[0, 1], [1, 1], [1.5, 0], [2.5, 0]]) s = evolve(c, s, { a }, time).state
    expect(active(c, s)).toEqual(['0'])
    for (const [time, a] of [[3, 1], [4, 1], [5.1, 1]]) s = evolve(c, s, { a }, time).state
    expect(active(c, s)).toEqual(['1'])
  })
})
const active = (c, state) => [...state.active].map((id) => c.steps.find((s) => s.id === id).label).sort()

describe('motor de evolución (IEC 60848)', () => {
  const nodes = [
    step('s0', '0', 0, { initial: true }),
    transition('t1', '↑Marcha', 100),
    step('s1', '1', 170, { actions: ['Motor', { text: 'N:=N+1', kind: 'stored-on' }, { text: 'Luz', kind: 'conditional', condition: 'Sensor' }] }),
    transition('t2', '2s/X1', 270),
    step('s2', '2', 340),
    transition('t3', 'Paro', 440),
  ]
  const c = compiled(nodes, links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['t3', 's0']]))

  it('compila sin errores y arranca en la etapa inicial', () => {
    expect(c.errors).toEqual([])
    expect(active(c, initialState(c))).toEqual(['0'])
  })

  it('secuencia completa: flanco, acciones, temporización y vuelta', () => {
    let s = evolve(c, initialState(c), { Marcha: 0 }, 0).state
    s = evolve(c, s, { Marcha: 1 }, 0.1).state
    expect(active(c, s)).toEqual(['1'])
    expect(s.values).toMatchObject({ Motor: 1, N: 1, Luz: 0 })

    s = evolve(c, s, { Marcha: 1, Sensor: 1 }, 0.2).state
    expect(s.values.Luz).toBe(1)
    expect(active(c, s)).toEqual(['1']) // el flanco no se repite

    s = evolve(c, s, { Marcha: 1, Sensor: 1 }, 1.5).state
    expect(active(c, s)).toEqual(['1'])
    const view = inspect(c, s)
    expect(view.enabled.has('t2') && !view.ready.has('t2')).toBe(true)

    s = evolve(c, s, { Marcha: 1, Sensor: 1 }, 2.2).state
    expect(active(c, s)).toEqual(['2'])
    expect(s.values).toMatchObject({ Motor: 0, N: 1 })

    s = evolve(c, s, { Paro: 1 }, 2.3).state
    expect(active(c, s)).toEqual(['0'])
  })

  it('evolución fugaz: continuas no emitidas, memorizadas sí; paso a paso', () => {
    const f = compiled(
      [step('s0', '0', 0, { initial: true }), transition('t1', 'a', 100), step('s1', '1', 170, { actions: ['Fugaz', { text: 'M:=7', kind: 'stored-on' }] }), transition('t2', '1', 270), step('s2', '2', 340)],
      links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2']]),
    )
    const r = evolve(f, initialState(f), { a: 1 }, 0)
    expect(active(f, r.state)).toEqual(['2'])
    expect(r.state.values).toMatchObject({ Fugaz: 0, M: 7 })
    expect(r.events).toHaveLength(2)
    expect(active(f, evolve(f, initialState(f), { a: 1 }, 0, { singleStep: true }).state)).toEqual(['1'])
  })

  it('divergencia y convergencia en Y', () => {
    const y = compiled(
      [step('s0', '0', 0, { initial: true }), transition('t1', 'go', 100), step('s1', '1', 170), step('s2', '2', 170), transition('t2', 'fin', 300), step('s3', '3', 370)],
      links([['s0', 't1'], ['t1', 's1'], ['t1', 's2'], ['s1', 't2'], ['s2', 't2'], ['t2', 's3']]),
    )
    let s = evolve(y, initialState(y), { go: 1 }, 0).state
    expect(active(y, s)).toEqual(['1', '2'])
    s = evolve(y, s, { go: 1, fin: 1 }, 1).state
    expect(active(y, s)).toEqual(['3'])
  })

  it('detecta ciclos inestables', () => {
    const u = compiled(
      [step('s0', '0', 0, { initial: true }), transition('t1', '1', 100), step('s1', '1', 170), transition('t2', '1', 270)],
      links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']]),
    )
    expect(evolve(u, initialState(u), {}, 0).state.unstable).toBe(true)
  })

  it('anota las expresiones no válidas', () => {
    const e = compiled([step('s0', '0', 0, { initial: true }), transition('t1', 'a b', 100)], links([['s0', 't1']]))
    expect(e.errors).toHaveLength(1)
    expect(e.errors[0].nodeId).toBe('t1')
  })
})
