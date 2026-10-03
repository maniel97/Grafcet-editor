import { describe, expect, it } from 'vitest'
import { studentTips } from '../../src/lib/tips'
import { EXAMPLES } from '../../src/lib/examples'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { links, step, transition } from './helpers'

// 0 -(c1)-> 1 [acciones] -(c2)-> 0
const loop = (c1, c2, actions = ['Motor'], plc = EMPTY_PLC) => {
  const nodes = [step('s0', '0', 0, { initial: true }), transition('t1', c1, 80), step('s1', '1', 120, { actions }), transition('t2', c2, 200)]
  return studentTips(nodes, links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']]), plc)
}
const messages = (tips) => tips.map((t) => t.message)

describe('consejos de Verificar', () => {
  it('ninguno en un grafcet correcto', () => {
    expect(loop('Marcha', 'Paro')).toEqual([])
  })

  it('etapa atravesada sin detenerse (mismo pulsador, también con flanco al entrar)', () => {
    // En el bucle se atraviesan las dos etapas.
    expect(messages(loop('Marcha', 'Marcha'))).toContain(
      'X1 se atraviesa sin detenerse: si «Marcha» es verdadera, «Marcha» también lo es y sus acciones continuas no se ejecutan.',
    )
    expect(loop('↑P · a', 'P')).toHaveLength(1)
    expect(loop('a · b', 'a + c')).toHaveLength(1)
    // X1: con flanco en la salida hace falta un cambio nuevo, o la salida pide más que la entrada.
    // (X0 sí se atraviesa: al volver con ↑P / a · b, «P» / «a» ya se cumplen.)
    const x1 = (tips) => messages(tips).filter((m) => m.startsWith('X1'))
    expect(x1(loop('P', '↑P'))).toEqual([])
    expect(x1(loop('a', 'a · b'))).toEqual([])
    expect(messages(loop('P', '↑P'))).toEqual(['X0 se atraviesa sin detenerse: si «↑P» es verdadera, «P» también lo es.'])
  })

  it('salida usada en una receptividad', () => {
    const tips = loop('Marcha', 'Motor')
    expect(messages(tips)).toEqual(['La receptividad «Motor» usa Motor, que es una salida.'])
    expect(tips[0].why).toMatch(/sensor/)
    expect(tips[0].nodeIds).toEqual(['t2'])
  })

  it('temporización de una etapa que no es la anterior', () => {
    expect(messages(loop('5s/X1', 'Paro'))).toEqual(['La temporización 5s/X1 está en una transición que no sale de X1 (sale de X0).'])
    expect(loop('Marcha', '5s/X1')).toEqual([])
  })

  it('receptividad constante', () => {
    expect(messages(loop('Marcha', '1'))).toEqual(['Receptividad «1» después de X1, que tiene acciones continuas: no llegarán a ejecutarse.'])
    expect(loop('Marcha', '1', [{ text: 'C:=C+1', kind: 'stored-on' }])).toEqual([])
    expect(messages(loop('Marcha', '0'))).toEqual(['La receptividad «0» es siempre falsa: la transición no se franquea nunca.'])
  })

  it('salida con acción continua y memorizada', () => {
    const nodes = [
      step('s0', '0', 0, { initial: true, actions: [{ text: 'Motor:=1', kind: 'stored-on' }] }),
      transition('t1', 'a', 80),
      step('s1', '1', 120, { actions: ['Motor'] }),
      transition('t2', 'b', 200),
    ]
    const tips = studentTips(nodes, links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']]), EMPTY_PLC)
    expect(messages(tips)).toEqual(['Motor se manda con acción continua (X1) y memorizada (X0).'])
  })

  it('los ejemplos del editor no dan consejos', () => {
    for (const ex of EXAMPLES) {
      const p = ex.build()
      expect(messages(studentTips(p.nodes, p.edges, { ...EMPTY_PLC, ...(p.plc ?? {}) })), ex.title).toEqual([])
    }
  })
})
