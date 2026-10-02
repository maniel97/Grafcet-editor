import { describe, expect, it } from 'vitest'
import { checkExclusive, describeExample, exclusiveFix } from '../../src/lib/exclusivity'

const ex = (a, b) => checkExclusive(a, b).exclusive

describe('exclusión mutua de receptividades', () => {
  it.each([
    ['a', '!a', true],
    ['a · b', 'a · !b', true],
    ['N >= 3', 'N < 3', true],
    ['N > 3', 'N < 3', true],
    ['N >= 3', 'N <= 3', false], // N = 3
    ['5s/X2', '!5s/X2', true],
    ['X3', '!X3', true],
    ['Marcha', 'Limpieza', false],
    ['Limpieza · !Marcha', 'Marcha', true],
    ['↑a', '↓a', true], // no pueden darse en el mismo ciclo
    ['↑a', 'a', false],
    ['1', 'a', false],
    ['0', 'a', true],
  ])('«%s» frente a «%s»: excluyentes = %s', (a, b, expected) => expect(ex(a, b)).toBe(expected))

  it('ejemplo legible y propuesta de arreglo', () => {
    const r = checkExclusive('Marcha', 'Limpieza')
    expect(describeExample(r.example)).toBe('Marcha = 1 y Limpieza = 1')
    expect(exclusiveFix('Marcha', 'Limpieza')).toBe('Limpieza · !Marcha')
    expect(exclusiveFix('a + b', 'c')).toBe('c · !(a + b)')
  })
  it('con flancos, el ejemplo dice de dónde viene', () => {
    expect(describeExample(checkExclusive('↑a', 'b').example)).toBe('a pasa de 0 a 1 y b = 1')
  })
  it('no se puede comprobar: sintaxis o demasiadas variables', () => {
    expect(checkExclusive('a ·', 'b')).toEqual({ exclusive: null, reason: 'syntax' })
    const many = Array.from({ length: 17 }, (_, i) => `v${i}`).join(' · ')
    expect(checkExclusive(many, 'w').exclusive).toBe(null)
  })
})

describe('Verificar avisa de divergencias en O no excluyentes', async () => {
  const { validateGrafcet } = await import('../../src/lib/validation')
  const { links, step, transition } = await import('./helpers')
  const build = (c1, c2) => {
    const nodes = [step('s0', '0', 0, { initial: true }), transition('t1', c1, 100, 0), transition('t2', c2, 100, 240), step('s1', '1', 200, {}, 0), step('s2', '2', 200, {}, 240), transition('t3', '1', 300, 0), transition('t4', '1', 300, 240)]
    const edges = links([['s0', 't1'], ['s0', 't2'], ['t1', 's1'], ['t2', 's2'], ['s1', 't3'], ['s2', 't4'], ['t3', 's0'], ['t4', 's0']])
    return validateGrafcet(nodes, edges).filter((i) => /Divergencia en O/.test(i.message))
  }
  it('aviso con ejemplo y arreglo', () => {
    const [issue] = build('Marcha', 'Limpieza')
    expect(issue.severity).toBe('warning')
    expect(issue.message).toContain('«Marcha» y «Limpieza» pueden cumplirse a la vez (p. ej. con Marcha = 1 y Limpieza = 1)')
    expect(issue.message).toContain('«Limpieza · !Marcha»')
    expect(issue.nodeIds).toEqual(['s0', 't1', 't2'])
  })
  it('excluyentes: sin aviso', () => expect(build('Marcha', 'Limpieza · !Marcha')).toEqual([]))
})
