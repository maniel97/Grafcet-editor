import { describe, expect, it } from 'vitest'
import { isValidName, renameInExpression, renameVariable, renumberStep } from '../../src/lib/rename'
import { step, transition } from './helpers'

describe('renombrar variables', () => {
  it('solo nombres completos', () => {
    expect(renameInExpression('a · Pieza + !a + ↑a + 5s/X2', 'a', 'Sensor')).toBe('Sensor · Pieza + !Sensor + ↑Sensor + 5s/X2')
    expect(renameInExpression('Marcha_2 + Marcha', 'Marcha', 'Inicio')).toBe('Marcha_2 + Inicio')
    expect(renameInExpression('N >= 3', 'N', 'Piezas')).toBe('Piezas >= 3')
  })
  it('en todo el diagrama, la tabla y los escenarios', () => {
    const nodes = [
      transition('t', 'Marcha · !Paro', 0),
      step('s', '1', 100, { actions: ['Marcha', { text: 'C:=C+Marcha', kind: 'stored-on' }, { text: 'Luz', kind: 'conditional', condition: 'Marcha' }, 'F/G2{3}'] }),
    ]
    const plc = { variables: { Marcha: { address: 'I0.0', comment: 'pulsador' } }, steps: {}, scenarios: [{ id: 'e', events: [{ t: 1, name: 'Marcha', value: 1 }] }] }
    const r = renameVariable(nodes, plc, 'Marcha', 'Inicio')
    expect(r.nodes[0].data.condition).toBe('Inicio · !Paro')
    expect(r.nodes[1].data.actions.map((a) => (typeof a === 'string' ? a : `${a.text}|${a.condition}`))).toEqual([
      'Inicio|',
      'C:=C+Inicio|',
      'Luz|Inicio',
      'F/G2{3}',
    ])
    expect(r.plc.variables).toEqual({ Inicio: { address: 'I0.0', comment: 'pulsador' } }) // conserva la dirección
    expect(r.plc.scenarios[0].events[0].name).toBe('Inicio')
    expect(r.changed).toBe(2)
  })
  it('nombres válidos', () => {
    expect(isValidName('Fc_abajo')).toBe(true)
    expect(isValidName('2a')).toBe(false)
    expect(isValidName('a b')).toBe(false)
  })
})

describe('renumerar una etapa actualiza sus referencias', () => {
  const nodes = [
    step('s5', '5', 0, { actions: [{ text: 'Luz', kind: 'conditional', condition: '3s/X5' }] }),
    transition('t', 'X5 · 5s/X5 + X50', 100),
    step('f', '9', 200, { actions: ['F/G2{5,6}', 'F/G3{5}'] }),
  ]
  const g = (n) => (n.id === 's5' ? 'G2' : null)
  const out = renumberStep(nodes, 's5', '5', '7', g)
  it('X5 y 5s/X5, pero no X50', () => expect(out[1].data.condition).toBe('X7 · 5s/X7 + X50'))
  it('condiciones de acciones', () => expect(out[0].data.actions[0].condition).toBe('3s/X7'))
  it('forzados solo hacia su grafcet', () => expect(out[2].data.actions.map((a) => a.text ?? a)).toEqual(['F/G2{7,6}', 'F/G3{5}']))
})
