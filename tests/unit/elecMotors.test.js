import { describe, expect, it } from 'vitest'
import { elecAction, elecInit, elecStep } from '../../src/lib/elec/solve'
import { ELEC_TEMPLATES, insertTemplate } from '../../src/lib/elec/templates'

const run = (s, st, seconds = 0.05) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.05) st = elecStep(s, st, {}, 0.05).state
  return st
}
const act = (s, st, id, action) => run(s, elecAction(s, st, id, action))
const press = (s, st, id) => act(s, act(s, st, id, 'press'), id, 'release')
const build = (id) => {
  const s = insertTemplate(ELEC_TEMPLATES.find((t) => t.id === id))
  const by = (tag) => s.components.find((c) => c.tag === tag && c.type !== 'contact').id
  return { s, by }
}

describe('motores especiales', () => {
  it('monofásico: S1 a derechas, S2 a izquierdas (el auxiliar al revés); sin auxiliar zumba', () => {
    const { s, by } = build('monofasico-inversion')
    let st = press(s, run(s, elecInit()), by('S1'))
    expect(st.view.motors[by('M1')]).toMatchObject({ running: true, dir: 1 })
    st = press(s, st, by('S0'))
    expect(st.view.motors[by('M1')].running).toBe(false)
    st = press(s, st, by('S2'))
    expect(st.view.motors[by('M1')]).toMatchObject({ running: true, dir: -1 })
    expect(st.view.short).toBeFalsy()
    // Sin el auxiliar (cable a Z2 cortado): no arranca.
    const cut = s.wires.filter((w) => w.to.c === by('M1') && w.to.t === 'Z2').map((w) => w.id)
    let st2 = run(s, elecInit())
    for (const id of cut) st2 = elecAction(s, st2, id, 'fault:cut')
    st2 = press(s, st2, by('S1'))
    expect(st2.view.motors[by('M1')]).toMatchObject({ running: false, warning: expect.stringMatching(/auxiliar/) })
  })
  it('Dahlander: lenta en triángulo, rápida en doble estrella (KM2 + KM3), sin cortocircuitos', () => {
    const { s, by } = build('dahlander')
    let st = press(s, run(s, elecInit()), by('S1'))
    expect(st.view.motors[by('M1')]).toMatchObject({ running: true, speed: 0.5, mode: expect.stringMatching(/lenta/) })
    st = press(s, st, by('S0'))
    st = press(s, st, by('S2'))
    expect(st.view.motors[by('M1')]).toMatchObject({ running: true, speed: 1, mode: expect.stringMatching(/doble estrella/) })
    expect(st.view.short).toBeFalsy()
    // Enclavada: con la rápida en marcha, S1 no entra.
    st = press(s, st, by('S1'))
    expect(st.view.motors[by('M1')].speed).toBe(1)
  })
  it('dos devanados: lenta y rápida', () => {
    const { s, by } = build('dos-devanados')
    let st = press(s, run(s, elecInit()), by('S1'))
    expect(st.view.motors[by('M1')]).toMatchObject({ running: true, speed: 0.5 })
    st = press(s, press(s, st, by('S0')), by('S2'))
    expect(st.view.motors[by('M1')]).toMatchObject({ running: true, speed: 1 })
  })
  it('monofásico de arranque: sigue girando sin el auxiliar una vez en marcha', () => {
    const c = (id, type, props = {}) => ({ id, type, x: 0, y: 0, ...props })
    const w = (i, a, ta, b, tb) => ({ id: `w${i}`, from: { c: a, t: ta }, to: { c: b, t: tb } })
    const s = {
      components: [c('L', 'rail', { potential: 'L' }), c('N', 'rail', { potential: 'N' }), c('M', 'motor1', { capacitor: 'start' }), c('S', 'switch', { tag: 'S1' })],
      wires: [w(0, 'L', 't0', 'M', 'U1'), w(1, 'N', 't0', 'M', 'U2'), w(2, 'L', 't1', 'S', '13'), w(3, 'S', '14', 'M', 'Z1'), w(4, 'N', 't1', 'M', 'Z2')],
    }
    let st = act(s, run(s, elecInit()), 'S', 'toggle')
    expect(st.view.motors.M.running).toBe(true)
    st = act(s, st, 'S', 'toggle') // se desconecta el auxiliar
    expect(st.view.motors.M.running).toBe(true)
  })
})
