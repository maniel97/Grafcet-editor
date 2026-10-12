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
    expect(messages(loop('Marcha', '1', [{ text: 'C:=C+1', kind: 'stored-on' }])).filter((m) => m.includes('«1»'))).toEqual([])
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

  it('acción memorizada que nunca vuelve a 0', () => {
    const on = { text: 'Luz:=1', kind: 'stored-on' }
    const tips = loop('Marcha', 'Paro', [on])
    expect(messages(tips)).toEqual(['Luz se pone a 1 en X1 y ninguna acción la vuelve a poner a 0: se queda activa para siempre.'])
    expect(tips[0].why).toContain('Luz:=0')
    expect(tips[0].topic).toBe('acciones')
    // También «Luz» como memorizada sin asignación.
    expect(loop('Marcha', 'Paro', [{ text: 'Luz', kind: 'stored-on' }])).toHaveLength(1)
    // Con su puesta a 0, al desactivar o en otra etapa, no hay consejo.
    expect(loop('Marcha', 'Paro', [on, { text: 'Luz:=0', kind: 'stored-off' }])).toEqual([])
  })

  it('contadores: sin leer, sin poner a cero y sin contar', () => {
    const up = { text: 'C:=C+1', kind: 'stored-on' }
    expect(messages(loop('Marcha', 'Paro', [up]))).toEqual(['C se cuenta en X1 pero no se lee en ninguna receptividad ni condición.'])
    expect(messages(loop('Marcha', '[C >= 3]', [up]))).toEqual([
      'C se cuenta en X1 pero nunca se pone a cero: en el segundo ciclo empieza con la cuenta del anterior.',
    ])
    expect(loop('Marcha', '[C >= 3]', [up, { text: 'C:=0', kind: 'stored-off' }])).toEqual([])
    // Sube y baja: es un saldo (plazas de un aparcamiento), no hace falta ponerlo a cero.
    expect(loop('Marcha', '[C >= 3]', [up, { text: 'C:=C-1', kind: 'event', condition: '↑S' }])).toEqual([])
    // Solo se pone a 0 y se compara: vale siempre 0.
    const never = loop('Marcha', '[C >= 3]', [{ text: 'C:=0', kind: 'stored-on' }])
    expect(messages(never)).toEqual(['C se compara pero ninguna acción lo cuenta: vale siempre 0.'])
    expect(never[0].nodeIds).toEqual(['t2', 's1'])
    // Sin ninguna acción: solo si está declarado como marca o contador (si no, es una entrada analógica).
    expect(loop('Marcha', '[N >= 3]', ['Motor'])).toEqual([])
    const declared = { ...EMPTY_PLC, variables: { N: { type: 'counter' } } }
    expect(messages(loop('Marcha', '[N >= 3]', ['Motor'], declared))).toEqual(['N se compara pero ninguna acción lo cuenta: vale siempre 0.'])
  })

  it('los ejemplos del editor no dan consejos', () => {
    for (const ex of EXAMPLES) {
      const p = ex.build()
      expect(messages(studentTips(p.nodes, p.edges, { ...EMPTY_PLC, ...(p.plc ?? {}) })), ex.title).toEqual([])
    }
  })
})
