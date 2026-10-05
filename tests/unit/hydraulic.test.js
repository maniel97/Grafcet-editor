import { describe, expect, it } from 'vitest'
import { elecAction, elecInit, elecStep } from '../../src/lib/elec/solve'
import { ELEC_TEMPLATES, insertTemplate } from '../../src/lib/elec/templates'
import { hydroStep } from '../../src/lib/elec/hydraulic'

// Grupo hidráulico con limitadora y manómetro, distribuidor 4/3 y cilindro A.
const circuit = ({ center = 'closed', relief = true, motor = '', skip = [] } = {}) => {
  const components = [
    { id: 'P', type: 'hpump', tag: '0P1', motor },
    ...(relief ? [{ id: 'R', type: 'hrelief', tag: '0V1', setting: 100 }] : []),
    { id: 'G', type: 'hgauge', tag: '0Z1' },
    { id: 'T', type: 'htank', tag: '0Z2' },
    { id: 'V', type: 'hvalve', tag: '1V1', ways: '4/3', center, sol14: 'Y1', sol12: 'Y2' },
    { id: 'A', type: 'hcylinder', tag: 'A', time: 2, initial: 0 },
  ]
  const tubes = [
    ['P', 'P', 'V', 'P'],
    ['P', 'P', 'G', '1'],
    ...(relief ? [['P', 'P', 'R', 'P']] : []),
    ['V', 'T', 'T', 'T'],
    ['V', 'A', 'A', 'A'],
    ['V', 'B', 'A', 'B'],
  ].filter((t) => !skip.includes(`${t[2]}${t[3]}`))
  return { components, wires: tubes.map(([a, b, c, d], i) => ({ id: `w${i}`, from: { c: a, t: b }, to: { c, t: d } })) }
}
const run = (sch, on, seconds, state = null, opts = {}) => {
  let r = { state }
  for (let i = 0; i < seconds * 20; i++) r = hydroStep(sch, r.state, { solenoids: new Set(on), ...opts }, 0.05)
  return r
}

describe('hidráulica', () => {
  it('con Y1 el cilindro sale; al llegar al tope abre la limitadora', () => {
    const sch = circuit()
    const moving = run(sch, ['Y1'], 1)
    expect(moving.view.cylinders.A.pos).toBeCloseTo(0.5, 1)
    expect(moving.view.gauges.G).toBe(30) // presión de trabajo
    expect(moving.view.relief.R).toBeFalsy()
    const end = run(sch, ['Y1'], 2, moving.state)
    expect(end.signals).toMatchObject({ a0: 0, a1: 1 })
    expect(end.view.gauges.G).toBe(100)
    expect(end.view.relief.R).toBe(true)
  })

  it('centro cerrado: se queda a media carrera (el aceite no se comprime)', () => {
    const sch = circuit()
    const half = run(sch, ['Y1'], 1)
    const held = run(sch, [], 3, half.state)
    expect(held.view.cylinders.A.pos).toBeCloseTo(half.view.cylinders.A.pos, 5)
    expect(held.view.cylinders.A.note).toMatch(/Retenido/)
    expect(held.view.relief.R).toBe(true) // la bomba sigue dando aceite: vuelve por la limitadora
  })

  it('centro en tándem: la bomba descarga al depósito (0 bar)', () => {
    const r = run(circuit({ center: 'tandem' }), [], 1)
    expect(r.view.gauges.G).toBe(0)
    expect(r.view.relief.R).toBeFalsy()
  })

  it('con Y2 entra', () => {
    const sch = circuit()
    const out = run(sch, ['Y1'], 3)
    const back = run(sch, ['Y2'], 3, out.state)
    expect(back.signals).toMatchObject({ a0: 1, a1: 0 })
  })

  it('la bomba con motor solo bombea si el motor gira', () => {
    const sch = circuit({ motor: 'M1' })
    expect(run(sch, ['Y1'], 1).view.cylinders.A.pos).toBe(0)
    expect(run(sch, ['Y1'], 1, null, { motors: (t) => t === 'M1' }).view.cylinders.A.pos).toBeGreaterThan(0.4)
  })

  it('sin limitadora, aviso de sobrepresión al llegar al tope', () => {
    const r = run(circuit({ relief: false }), ['Y1'], 3)
    expect(r.view.overpressure).toBe(true)
  })

  it('una conexión sin tubo derrama aceite', () => {
    const r = run(circuit({ skip: ['AA'] }), ['Y1'], 0.5)
    expect(r.view.spill).toBe(true)
    expect(r.view.cylinders.A.pos).toBe(0)
  })

  it('el regulador frena el cilindro', () => {
    const sch = circuit({ skip: ['AB'] })
    sch.components.push({ id: 'Q', type: 'hthrottle', tag: '1V2', setting: 0.5 })
    sch.wires = sch.wires.filter((w) => !(w.from.c === 'V' && w.from.t === 'B'))
    sch.wires.push({ id: 'q1', from: { c: 'V', t: 'B' }, to: { c: 'Q', t: '1' } }, { id: 'q2', from: { c: 'Q', t: '2' }, to: { c: 'A', t: 'B' } })
    expect(run(sch, ['Y1'], 1).view.cylinders.A.pos).toBeCloseTo(0.25, 1)
  })
})

describe('hidráulica: montajes', () => {
  const step = (s, st, seconds = 0.05) => {
    let r = st
    for (let i = 0; i < Math.round(seconds / 0.05); i++) r = elecStep(s, r, {}, 0.05).state
    return r
  }
  const act = (s, st, id, action) => step(s, elecAction(s, st, id, action))
  const build = (name) => {
    const s = insertTemplate(ELEC_TEMPLATES.find((t) => t.id === name))
    return { s, id: (tag) => s.components.find((x) => x.tag === tag).id }
  }
  const cyl = (st, id) => st.view.hydro.cylinders[id].pos
  const gauge = (st) => Object.values(st.view.hydro.gauges)[0]

  it('prensa: baja con S1, se para al soltar (bomba a 0 bar) y la limitadora abre en el tope', () => {
    const { s, id } = build('electrohidraulica-prensa')
    let st = act(s, step(s, elecInit()), id('S1'), 'press')
    st = step(s, st, 1.5)
    expect(gauge(st)).toBe(30)
    st = act(s, st, id('S1'), 'release')
    const half = cyl(st, id('A'))
    st = step(s, st, 2)
    expect(cyl(st, id('A'))).toBeCloseTo(half, 5)
    expect(gauge(st)).toBe(0)
    st = act(s, st, id('S1'), 'press')
    st = step(s, st, 3)
    expect(cyl(st, id('A'))).toBe(1)
    expect(gauge(st)).toBe(100)
    expect(st.view.loads[id('H1')]).toBe(true) // B1 (a1) enciende el piloto
  })

  it('elevador: sube libre y baja frenado; sujeto a media altura', () => {
    const { s, id } = build('electrohidraulica-elevador')
    let st = act(s, step(s, elecInit()), id('S1'), 'press')
    st = step(s, st, 3.1)
    expect(cyl(st, id('A'))).toBe(1)
    st = act(s, act(s, st, id('S1'), 'release'), id('S2'), 'press')
    st = step(s, st, 3)
    const down = 1 - cyl(st, id('A'))
    expect(down).toBeGreaterThan(0.3)
    expect(down).toBeLessThan(0.5) // frenado al 40 %
    st = act(s, st, id('S2'), 'release')
    const held = cyl(st, id('A'))
    st = step(s, st, 2)
    expect(cyl(st, id('A'))).toBeCloseTo(held, 5)
    expect(gauge(st)).toBe(120)
  })
})
