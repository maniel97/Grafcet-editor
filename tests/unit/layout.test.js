import { describe, expect, it } from 'vitest'
import { findFreePosition, nextStepLabel, nextTransitionLabel, positionBelow } from '../../src/lib/layout'
import { step, transition } from './helpers'

describe('numeración automática', () => {
  it('siguiente etapa: mayor número + 1', () => {
    expect(nextStepLabel([step('a', '0', 0), step('b', '1', 0)])).toBe('2')
  })
  it('conserva el prefijo del diagrama (E1 -> E2)', () => {
    expect(nextStepLabel([step('a', 'E0', 0), step('b', 'E1', 0)])).toBe('E2')
  })
  it('primera etapa: 0', () => {
    expect(nextStepLabel([])).toBe('0')
  })
  it('transiciones: no por detrás del total ni repitiendo T', () => {
    expect(nextTransitionLabel([transition('m', 'Marcha', 0), transition('p', 'Paro', 0)])).toBe('T3')
    expect(nextTransitionLabel([transition('m', 'T1', 0), transition('p', 'T5', 0)])).toBe('T6')
  })
})

describe('colocación sin solapes', () => {
  const s1 = step('s1', '1', 210, {}, 200)
  it('debajo de una etapa, alineado', () => {
    expect(positionBelow(s1, 'transition', [s1])).toEqual({ x: 200, y: 310 })
  })
  it('si está ocupado, una columna a la derecha', () => {
    expect(positionBelow(s1, 'transition', [s1, transition('t2', 'Paro', 310, 200)])).toEqual({ x: 440, y: 310 })
  })
  it('debajo de una transición', () => {
    const t1 = transition('t1', 'c', 140, 200)
    expect(positionBelow(t1, 'step', [t1])).toEqual({ x: 200, y: 210 })
  })
  it('se ajusta a la cuadrícula', () => {
    expect(findFreePosition({ x: 123, y: 47 }, 'step', [])).toEqual({ x: 120, y: 50 })
  })
})
