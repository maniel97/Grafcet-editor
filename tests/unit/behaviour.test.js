import { describe, expect, it } from 'vitest'
import { compareBehaviour, edgesOf, expectedFrom } from '../../src/lib/behaviour'

// Ejecución de mentira: muestras de una salida «Motor» (y su contador de piezas).
const run = (changes, counts = {}) => ({
  samples: [{ t: 0, values: { Motor: changes.initial ?? 0 } }, ...changes.at.map(([t, v]) => ({ t, values: { Motor: v } }))],
  counts,
  compiled: { variables: [{ name: 'Motor', type: 'output' }] },
})

describe('comportamiento', () => {
  it('cambios de una señal', () => {
    expect(edgesOf(run({ at: [[0.6, 1], [5.6, 0]] }).samples, 'Motor')).toEqual({ initial: 0, times: [0.6, 5.6] })
  })

  it('igual dentro del margen: bien', () => {
    const want = expectedFrom(run({ at: [[0.6, 1], [5.6, 0]] }))
    expect(compareBehaviour(want, run({ at: [[0.7, 1], [5.4, 0]] }), 0.5)).toEqual({ ok: true, problems: [] })
  })

  it('no se enciende, se enciende tarde, sobra un apagado', () => {
    const want = expectedFrom(run({ at: [[0.6, 1], [5.6, 0]] }))
    expect(compareBehaviour(want, run({ at: [] })).problems[0].text).toBe('Motor: debería encenderse hacia 0,6 s y no se enciende.')
    expect(compareBehaviour(want, run({ at: [[2, 1], [5.6, 0]] })).problems[0].text).toBe('Motor: se enciende a 2,0 s; se esperaba hacia 0,6 s.')
    const extra = compareBehaviour(expectedFrom(run({ at: [[0.6, 1]] })), run({ at: [[0.6, 1], [3, 0]] }))
    expect(extra.problems[0].text).toBe('Motor: se apaga a 3,0 s y no debería.')
  })

  it('estado inicial distinto', () => {
    const want = expectedFrom(run({ at: [] }))
    expect(compareBehaviour(want, run({ initial: 1, at: [] })).problems[0].text).toContain('al empezar debería estar apagada')
  })

  it('piezas en las recogidas, y el primer problema es el más temprano', () => {
    const want = expectedFrom(run({ at: [[1, 1]] }, { metal: 2 }), null, { metal: 'Metal' })
    const r = compareBehaviour(want, run({ at: [[3, 1]] }, { metal: 1 }))
    expect(r.problems.map((p) => p.text)).toEqual(['Motor: se enciende a 3,0 s; se esperaba hacia 1,0 s.', 'Metal: llegan 1 piezas; se esperaban 2.'])
  })
})
