import { describe, expect, it } from 'vitest'
import { validateGrafcet } from '../../src/lib/validation'

const step = (id, x, y, initial = false) => ({ id, type: 'step', position: { x, y }, data: { label: id.slice(1), actions: [], ...(initial ? { initial: true } : {}) } })
const trans = (id, condition, x, y) => ({ id, type: 'transition', position: { x, y }, data: { condition } })
const edge = ([source, target]) => ({ id: `${source}-${target}`, source, target, type: 'grafcet' })
const loopsError = (issues) => issues.some((i) => /varios bucles/.test(i.message))

describe('transición con varios bucles', () => {
  it('error si activa a la vez dos etapas anteriores que no se sincronizan después', () => {
    const nodes = [step('s0', 0, 0, true), trans('t0', 'a', 0, 100), step('s1', 0, 170), trans('t1', 'b', 0, 270), step('s2', 0, 340), trans('t2', 'c', 0, 440)]
    const edges = [['s0', 't0'], ['t0', 's1'], ['s1', 't1'], ['t1', 's2'], ['s2', 't2'], ['t2', 's0'], ['t2', 's1']].map(edge)
    expect(loopsError(validateGrafcet(nodes, edges))).toBe(true)
  })
  it('sin error al devolver un recurso compartido (las dos etapas se esperan en una convergencia en Y)', () => {
    const nodes = [step('s10', 0, 0, true), step('s20', 300, 0, true), trans('t1', 'Pide', 0, 100), step('s11', 0, 170), trans('t2', 'Fin', 0, 270)]
    const edges = [['s10', 't1'], ['s20', 't1'], ['t1', 's11'], ['s11', 't2'], ['t2', 's10'], ['t2', 's20']].map(edge)
    expect(loopsError(validateGrafcet(nodes, edges))).toBe(false)
  })
})
