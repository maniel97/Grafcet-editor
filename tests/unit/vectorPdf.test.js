import { describe, expect, it } from 'vitest'
import { parsePath, pdfSafe, splitRuns } from '../../src/lib/vectorPdf'

describe('PDF vectorial: piezas puras', () => {
  it('trazados de los enlaces (M, L, H, V, Z)', () => {
    expect(parsePath('M 10 20 V 50 H 30 V 80')).toEqual([{ points: [[10, 20], [10, 50], [30, 50], [30, 80]], closed: false }])
    // Divergencia en Y: varios subtrazados.
    expect(parsePath('M 0 0 V 5 M -10 5 H 10').map((s) => s.points)).toEqual([[[0, 0], [0, 5]], [[-10, 5], [10, 5]]])
    expect(parsePath('M 0 10 L 5 0 L 10 10 Z')[0].closed).toBe(true)
    expect(parsePath('M0,0 C 1 1 2 2 3 3')).toBeNull() // curvas: se muestrean aparte
  })
  it('caracteres que no tienen las fuentes del PDF', () => {
    expect(pdfSafe('Nivel ≥ 3 · Válvula «A» ñ')).toBe('Nivel >= 3 · Válvula «A» ñ')
    expect(pdfSafe('a ≠ b → c')).toBe('a <> b -> c')
  })
  it('las flechas de flanco se separan del texto', () => {
    const chars = [...'↑Marcha ·'].map((ch, i) => ({ ch, left: i * 10, right: i * 10 + 10 }))
    expect(splitRuns(chars)).toEqual([
      { glyph: 'up', left: 0, right: 10 },
      { text: 'Marcha ·', left: 10, right: 90 },
    ])
  })
})
