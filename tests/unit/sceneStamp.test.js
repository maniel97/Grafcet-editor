import { describe, expect, it } from 'vitest'
import { GAP, collides, freeSpot, stampRow } from '../../src/lib/sim/sceneStamp'

// Piezas cuadradas de 40 con el origen en el centro.
const bounds = (e) => ({ x: e.x - 20, y: e.y - 20, w: 40, h: 40 })

describe('tampón de la planta', () => {
  it('hueco libre: el primero de la zona visible que no pisa nada', () => {
    const view = { x: 0, y: 0, w: 400, h: 300 }
    expect(freeSpot({ x: 0, y: 0 }, [], bounds, view)).toEqual({ x: 20, y: 20 })
    // Ocupado arriba a la izquierda: el siguiente a la derecha, con margen.
    const spot = freeSpot({ x: 0, y: 0 }, [{ x: 20, y: 20 }], bounds, view)
    expect(spot.y).toBe(20)
    expect(spot.x).toBeGreaterThanOrEqual(80)
    expect(collides({ x: spot.x, y: spot.y }, [{ x: 20, y: 20 }], bounds)).toBe(false)
  })

  it('sin sitio libre, el centro de la zona visible', () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ x: (i % 10) * 40 + 20, y: Math.floor(i / 10) * 40 + 20 }))
    expect(freeSpot({ x: 0, y: 0 }, full, bounds, { x: 0, y: 0, w: 200, h: 200 })).toEqual({ x: 100, y: 100 })
  })

  it('fila: una pieza cada (tamaño + hueco) en la dirección dominante', () => {
    const size = { w: 40, h: 40 }
    expect(stampRow({ x: 0, y: 0 }, { x: 5, y: 3 }, size)).toEqual([{ x: 0, y: 0 }])
    expect(stampRow({ x: 0, y: 0 }, { x: 130, y: 20 }, size)).toEqual([
      { x: 0, y: 0 },
      { x: 40 + GAP, y: 0 },
      { x: 2 * (40 + GAP), y: 0 },
    ])
    expect(stampRow({ x: 0, y: 0 }, { x: 10, y: -125 }, size).map((p) => p.y)).toEqual([0, -60, -120])
  })

  it('colisión con lo que ya hay', () => {
    expect(collides({ x: 30, y: 30 }, [{ x: 20, y: 20 }], bounds)).toBe(true)
    expect(collides({ x: 100, y: 100 }, [{ x: 20, y: 20 }], bounds)).toBe(false)
  })
})
