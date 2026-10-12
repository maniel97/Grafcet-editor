import { describe, expect, it } from 'vitest'
import { timerReading, timerText } from '../../src/lib/timers'
import { parseCondition } from '../../src/lib/sim/expression'

const base = { mode: 'on', on: '5', onUnit: 's', ref: 'X2', off: '2', offUnit: 's' }

describe('asistente de temporizaciones', () => {
  it('genera la sintaxis normalizada de cada tipo', () => {
    expect(timerText(base)).toBe('5s/X2')
    expect(timerText({ ...base, on: '500', onUnit: 'ms' })).toBe('500ms/X2')
    expect(timerText({ ...base, mode: 'off', ref: 'a' })).toBe('0s/a/2s')
    expect(timerText({ ...base, mode: 'both', on: '1,5', ref: 'a', offUnit: 'min' })).toBe('1,5s/a/2min')
    expect(timerText({ ...base, mode: 'off' })).toBe('0s/X2/2s')
  })

  it('lo que genera lo entiende el simulador', () => {
    expect(parseCondition(timerText(base))).toEqual({ op: 'timer', seconds: 5, step: '2' })
    expect(parseCondition(timerText({ ...base, mode: 'off', ref: 'a' }))).toEqual({ op: 'delay', on: 0, off: 2, arg: { op: 'var', name: 'a' } })
    expect(parseCondition(timerText({ ...base, mode: 'both', ref: 'X2', on: '3' }))).toEqual({ op: 'delay', on: 3, off: 2, arg: { op: 'step', step: '2' } })
  })

  it('sin tiempo válido o sin etapa no genera nada', () => {
    for (const bad of [{ on: '' }, { on: '0' }, { on: 'a' }, { ref: '' }, { ref: '2X' }]) expect(timerText({ ...base, ...bad }), JSON.stringify(bad)).toBeNull()
    // El tiempo de bajada solo cuenta si se usa.
    expect(timerText({ ...base, off: '' })).toBe('5s/X2')
    expect(timerText({ ...base, mode: 'both', off: '' })).toBeNull()
    expect(timerText({ ...base, mode: 'off', on: '' })).toBe('0s/X2/2s')
  })

  it('dice cómo se lee', () => {
    expect(timerReading(base)).toEqual({ text: 'Verdadera cuando {ref} lleva {t1} activa.', vars: { ref: 'X2', t1: '5 s' } })
    expect(timerReading({ ...base, ref: 'a' }).text).toMatch(/vuelve a 0/)
    expect(timerReading({ ...base, mode: 'off', ref: 'a' }).vars).toEqual({ ref: 'a', t2: '2 s' })
    expect(timerReading({ ...base, mode: 'both' }).text).toMatch(/desactive/)
    expect(timerReading({ ...base, on: '' })).toBeNull()
  })
})
