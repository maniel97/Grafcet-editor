import { describe, expect, it } from 'vitest'
import { MIN_SIZE, clampRect, resizeRect } from '../../src/lib/floating'

describe('paneles flotantes', () => {
  const host = { w: 1000, h: 700 }

  it('siempre dentro de la zona, con tamaño mínimo y sin ser más grande que ella', () => {
    expect(clampRect({ x: -50, y: -10, w: 400, h: 300 }, host)).toEqual({ x: 0, y: 0, w: 400, h: 300 })
    expect(clampRect({ x: 900, y: 650, w: 400, h: 300 }, host)).toEqual({ x: 600, y: 400, w: 400, h: 300 })
    expect(clampRect({ x: 10, y: 10, w: 50, h: 20 }, host)).toMatchObject({ w: MIN_SIZE.w, h: MIN_SIZE.h })
    expect(clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, host)).toEqual({ x: 0, y: 0, w: 1000, h: 700 })
  })

  it('redimensionar por la esquina y por los bordes izquierdo y superior', () => {
    expect(resizeRect({ x: 100, y: 100, w: 400, h: 300 }, 'se', 50, 20)).toEqual({ x: 100, y: 100, w: 450, h: 320 })
    // Por la izquierda: el borde derecho se queda donde estaba.
    expect(resizeRect({ x: 100, y: 100, w: 400, h: 300 }, 'w', -30, 0)).toEqual({ x: 70, y: 100, w: 430, h: 300 })
    // Sin bajar del mínimo (y sin mover el otro borde).
    expect(resizeRect({ x: 100, y: 100, w: 300, h: 200 }, 'nw', 200, 200)).toEqual({ x: 140, y: 140, w: MIN_SIZE.w, h: MIN_SIZE.h })
  })
})
