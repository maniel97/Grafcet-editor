import { describe, expect, it } from 'vitest'
import { pneuStep, valveBlocked, valvePaths } from '../../src/lib/elec/pneumatic'
import { elecInit, elecStep } from '../../src/lib/elec/solve'
import { terminalsOf } from '../../src/lib/elec/catalog'

const c = (id, type, props = {}) => ({ id, type, x: 0, y: 0, ...props })
let n = 0
const w = (a, ta, b, tb) => ({
  id: `w${n++}`,
  from: { c: a, t: ta },
  to: { c: b, t: tb },
})

// Soplado de dos presiones: fuente - separador - secador - regulador general - dos ramas (regulador
// y electroválvula, con antirretorno si se pide) unidas en la boquilla, con el presostato PS1.
function assist({ ways = '2/2', checks = false } = {}) {
  const components = [
    c('P', 'airsource', { tag: '0P1' }),
    c('F', 'pconditioner', { tag: '0Z1', kind: 'separator' }),
    c('D', 'pconditioner', { tag: '0Z2', kind: 'dryer' }),
    c('R0', 'pregulator', { tag: '0V1' }),
    c('R1', 'pregulator', { tag: 'R1', setting: '0,4 bar' }),
    c('R2', 'pregulator', { tag: 'R2', setting: '2 bar' }),
    c('EV1', 'pvalve', { tag: 'EV1', ways, sol14: 'Y1' }),
    c('EV2', 'pvalve', { tag: 'EV2', ways, sol14: 'Y2' }),
    c('PS1', 'pswitch', { tag: 'PS1' }),
    c('B', 'poutlet', { tag: '1Z1' }),
  ]
  const wires = [w('P', '1', 'F', '1'), w('F', '2', 'D', '1'), w('D', '2', 'R0', '1'), w('R0', '2', 'R1', '1'), w('R0', '2', 'R2', '1'), w('R1', '2', 'EV1', '1'), w('R2', '2', 'EV2', '1')]
  if (checks) {
    components.push(c('VA1', 'pcheck', { tag: 'VA1' }), c('VA2', 'pcheck', { tag: 'VA2' }))
    wires.push(w('EV1', '2', 'VA1', '1'), w('EV2', '2', 'VA2', '1'), w('VA1', '2', 'B', '1'), w('VA2', '2', 'B', '1'))
  } else wires.push(w('EV1', '2', 'B', '1'), w('EV2', '2', 'B', '1'))
  wires.push(w('B', '1', 'PS1', '1'))
  return { components, wires }
}
const step = (sch, solenoids) => pneuStep(sch, null, { solenoids: new Set(solenoids) })

describe('neumática: válvula 2/2', () => {
  it('NC abre 1→2 con la bobina; NA al revés; sin escape', () => {
    expect(valvePaths({ ways: '2/2' }, '12')).toEqual([])
    expect(valvePaths({ ways: '2/2' }, '14')).toEqual([['1', '2']])
    expect(valvePaths({ ways: '2/2', normally: 'NO' }, '12')).toEqual([['1', '2']])
    expect(valveBlocked({ ways: '2/2' }, '12')).toEqual(['1', '2'])
    expect(terminalsOf({ type: 'pvalve', ways: '2/2' }).map((t) => t.id)).toEqual(['2', '1'])
  })
})

describe('neumática: soplado de dos presiones', () => {
  it('en reposo la boquilla no tiene presión y el presostato no da señal', () => {
    const r = step(assist(), [])
    expect(r.view.ports['B:1']).toBe('R')
    expect(r.signals.ps1).toBe(0)
    expect(r.view.leaks).toBe(false)
  })

  it('con cualquiera de las dos electroválvulas sopla, sin fuga, y PS1 da señal', () => {
    for (const on of [['Y1'], ['Y2'], ['Y1', 'Y2']]) {
      const r = step(assist(), on)
      expect(r.view.ports['B:1']).toBe('P')
      expect(r.view.leaks).toBe(false)
      expect(r.signals.ps1).toBe(1)
    }
  })

  it('con 3/2 sin antirretornos, la otra rama descarga por su escape (fuga)', () => {
    const r = step(assist({ ways: '3/2' }), ['Y2'])
    expect(r.view.leaks).toBe(true)
    expect(r.signals.ps1).toBe(0)
  })

  it('con 3/2 y antirretornos, sopla sin fuga y en reposo la boquilla queda sin presión', () => {
    const on = step(assist({ ways: '3/2', checks: true }), ['Y2'])
    expect(on.view.leaks).toBe(false)
    expect(on.view.ports['B:1']).toBe('P')
    expect(on.signals.ps1).toBe(1)
    // El antirretorno de la rama parada no deja volver el aire.
    expect(on.view.ports['EV1:2']).toBe('R')
    const off = step(assist({ ways: '3/2', checks: true }), [])
    expect(off.signals.ps1).toBe(0)
  })

  it('el antirretorno no deja pasar de 2 a 1', () => {
    const sch = {
      components: [c('P', 'airsource'), c('V', 'pcheck'), c('G', 'pgauge')],
      wires: [w('P', '1', 'V', '2'), w('V', '1', 'G', '1')],
    }
    expect(step(sch, []).view.ports['G:1']).toBe(null)
    const fwd = {
      components: sch.components,
      wires: [w('P', '1', 'V', '1'), w('V', '2', 'G', '1')],
    }
    expect(step(fwd, []).view.ports['G:1']).toBe('P')
  })

  it('el contacto de presostato del esquema eléctrico sigue a PS1', () => {
    const sch = assist()
    sch.components.push(
      c('Lp', 'rail', { potential: 'L+' }),
      c('M', 'rail', { potential: 'M' }),
      c('S1', 'switch', { tag: 'S1' }),
      c('Y1', 'valve', { tag: 'Y1' }),
      c('B1', 'limit', { tag: 'B1', kind: 'pressure', signal: 'ps1' }),
      c('H1', 'lamp', { tag: 'H1' }),
    )
    sch.wires.push(w('Lp', 't0', 'S1', '13'), w('S1', '14', 'Y1', 'A1'), w('Y1', 'A2', 'M', 't0'), w('Lp', 't0', 'B1', '13'), w('B1', '14', 'H1', 'X1'), w('H1', 'X2', 'M', 't0'))
    let s = elecInit()
    for (let i = 0; i < 3; i++) s = elecStep(sch, s, {}, 0.05).state
    expect(s.view.loads.H1).toBeFalsy()
    s = { ...s, latched: { ...s.latched, S1: true } }
    for (let i = 0; i < 3; i++) s = elecStep(sch, s, {}, 0.05).state
    expect(s.view.loads.H1).toBeTruthy()
  })
})

describe('diodo de rueda libre', () => {
  it('en paralelo con la bobina (cátodo a L+) no la puentea', () => {
    const sch = {
      components: [c('Lp', 'rail', { potential: 'L+' }), c('M', 'rail', { potential: 'M' }), c('S1', 'switch', { tag: 'S1' }), c('Y1', 'valve', { tag: 'Y1' }), c('V1', 'diode', { tag: 'V1' })],
      wires: [w('Lp', 't0', 'S1', '13'), w('S1', '14', 'Y1', 'A1'), w('Y1', 'A2', 'M', 't0'), w('V1', 'K', 'Y1', 'A1'), w('V1', 'A', 'Y1', 'A2')],
    }
    expect(terminalsOf({ type: 'diode' }).map((t) => t.id)).toEqual(['K', 'A'])
    let s = elecInit()
    s = { ...s, latched: { S1: true } }
    for (let i = 0; i < 3; i++) s = elecStep(sch, s, {}, 0.05).state
    expect(s.view.loads.Y1).toBeTruthy()
  })
})
