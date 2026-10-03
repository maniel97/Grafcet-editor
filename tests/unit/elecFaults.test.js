import { describe, expect, it } from 'vitest'
import { elecAction, elecInit, elecStep, randomFault, voltageBetween } from '../../src/lib/elec/solve'
import { ELEC_TEMPLATES } from '../../src/lib/elec/templates'

const run = (s, st) => elecStep(s, st, {}, 0.05).state
const act = (s, st, id, action) => run(s, elecAction(s, st, id, action))
const press = (s, st, id) => act(s, act(s, st, id, 'press'), id, 'release')
const b = ELEC_TEMPLATES.find((t) => t.id === 'marcha-paro').build(0, 0, 'p')
const s = { components: b.components, wires: b.wires }
const fault = (id, f) => elecAction(s, elecInit(), id, `fault:${f}`)

describe('averías', () => {
  it('sin averías, marcha-paro funciona', () => {
    expect(press(s, run(s, elecInit()), 'p-S1').coils.KM1).toBe(true)
  })
  it('pulsador de marcha quemado: no arranca', () => {
    expect(press(s, run(s, fault('p-S1', 'open')), 'p-S1').coils.KM1).toBe(false)
  })
  it('contacto de autorretención quemado: arranca solo mientras se pulsa', () => {
    let st = act(s, run(s, fault('p-KM1h', 'open')), 'p-S1', 'press')
    expect(st.coils.KM1).toBe(true)
    st = act(s, st, 'p-S1', 'release')
    expect(st.coils.KM1).toBe(false)
  })
  it('paro soldado: no para', () => {
    let st = press(s, run(s, fault('p-S0', 'welded')), 'p-S1')
    st = press(s, st, 'p-S0')
    expect(st.coils.KM1).toBe(true)
  })
  it('bobina cortada: tiene tensión pero no se excita (el polímetro marca 230 V en A1-A2)', () => {
    const st = act(s, run(s, fault('p-KM1', 'open')), 'p-S1', 'press')
    expect(st.coils.KM1).toBe(false)
    expect(voltageBetween(st.view.pot['p-KM1:A1'], st.view.pot['p-KM1:A2']).value).toBe(230)
  })
  it('cable cortado: el circuito se abre ahí', () => {
    const cut = s.wires.find((w) => w.from.c === 'p-KM1' && w.from.t === 'A2').id
    const st = act(s, run(s, fault(cut, 'cut')), 'p-S1', 'press')
    expect(st.coils.KM1).toBe(false)
    expect(voltageBetween(st.view.pot['p-KM1:A1'], st.view.pot['p-KM1:A2']).value).toBe(0)
  })
  it('avería al azar oculta: no se ve hasta mostrarla; reparar lo deja como estaba', () => {
    let st = elecAction(s, elecInit(), null, 'random-fault')
    expect(Object.keys(st.faults)).toHaveLength(1)
    st = run(s, st)
    expect(st.view.faults).toEqual({})
    expect(st.view.hiddenFaults).toBe(true)
    st = run(s, elecAction(s, st, null, 'reveal'))
    expect(Object.keys(st.view.faults)).toHaveLength(1)
    st = elecAction(s, st, null, 'repair-all')
    expect(st.faults).toEqual({})
    expect(randomFault(s, () => 0)).toEqual(expect.objectContaining({ fault: expect.any(String) }))
  })
})

describe('polímetro', () => {
  it('tensiones entre potenciales', () => {
    expect(voltageBetween('L', 'N').text).toBe('230 V~')
    expect(voltageBetween('L1', 'L3').text).toBe('400 V~')
    expect(voltageBetween('L+', 'M').text).toBe('24 V DC')
    expect(voltageBetween('sec:t1:1', 'sec:t1:2').text).toBe('24 V~')
    expect(voltageBetween('L', 'L').value).toBe(0)
    expect(voltageBetween('L', null).value).toBe(0)
    expect(voltageBetween('L+', 'N').value).toBe(null)
  })
})
