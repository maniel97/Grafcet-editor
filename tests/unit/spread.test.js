import { describe, expect, it } from 'vitest'
import { spreadFactor, spreadNodes } from '../../src/lib/spread'

// Dos transiciones en columnas a 100 px; la de la izquierda tiene un texto de 150 px.
const box = (left, textRight, top = 0) => ({ left, right: left + 56, top, bottom: top + 24, textRight, textTop: top, textBottom: top + 24 })

describe('separar columnas (spread)', () => {
  it('no cambia nada si ningún texto pisa a su vecina', () => {
    expect(spreadFactor({ a: box(0, 90), b: box(200, 300) })).toBe(1)
    // A distinta altura no se pisan aunque el texto sea largo.
    expect(spreadFactor({ a: box(0, 400), b: box(100, 160, 100) })).toBe(1)
  })

  it('escala lo justo para que el texto quede a la izquierda de la vecina', () => {
    const boxes = { a: box(0, 206), b: box(100, 160) }
    const factor = spreadFactor(boxes)
    const nodes = spreadNodes(
      [
        { id: 'a', type: 'transition', position: { x: 0, y: 0 } },
        { id: 'b', type: 'transition', position: { x: 100, y: 0 } },
        { id: 'n', type: 'note', position: { x: 180, y: 0 } },
      ],
      boxes,
      factor,
    )
    const b = nodes.find((n) => n.id === 'b').position.x
    expect(b).toBeGreaterThanOrEqual(206 + 16 - 1)
    expect(nodes.find((n) => n.id === 'a').position.x).toBe(0)
    // La nota de la derecha queda a la derecha de los textos.
    expect(nodes.find((n) => n.id === 'n').position.x).toBeGreaterThan(b + 60)
  })
})
