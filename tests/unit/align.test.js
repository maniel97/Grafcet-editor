import { describe, expect, it } from 'vitest'
import { alignColumn, spaceSequence } from '../../src/lib/align'
import { step, transition } from './helpers'

describe('alinear y espaciar', () => {
  const messy = [
    step('s0', '0', 3, {}, 203),
    transition('t1', 'a', 140, 237),
    step('s1', '1', 190, {}, 180),
    transition('t2', 'b', 400, 260),
    { id: 'nota', type: 'note', position: { x: 900, y: 50 }, data: { text: 'x' } },
  ]

  it('alinear en columna: a la x del más alto, ajustada a la cuadrícula; ignora notas y tabla', () => {
    const moves = alignColumn(messy)
    expect([...moves.keys()].sort()).toEqual(['s0', 's1', 't1', 't2'])
    expect(new Set([...moves.values()].map((p) => p.x))).toEqual(new Set([200]))
  })

  it('espaciar: distancias estándar etapa->transición 100 y transición->etapa 70', () => {
    const moves = spaceSequence(messy)
    const y = (id) => moves.get(id)?.y
    expect(moves.has('s0')).toBe(false) // el primero no se mueve
    expect(y('t1')).toBe(103)
    expect(y('s1')).toBe(173)
    expect(y('t2')).toBe(273)
    expect(moves.has('nota')).toBe(false)
  })

  it('con menos de dos nodos no hace nada', () => {
    expect(alignColumn([step('a', '0', 0)]).size).toBe(0)
    expect(spaceSequence([]).size).toBe(0)
  })
})
