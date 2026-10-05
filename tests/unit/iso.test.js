import { describe, expect, it } from 'vitest'
import { ISO, isoBoxes, isoPrism, isoProject, isoScreenBox, lift, pieceLift } from '../../src/lib/sim/iso'

describe('vista isométrica', () => {
  it('subir z en la escena es subir z (a escala) en la pantalla, sin moverse a los lados', () => {
    const p = { x: 300, y: 200 }
    const o = lift(40)
    const up = isoProject({ x: p.x + o.x, y: p.y + o.y })
    const base = isoProject(p)
    expect(up.x).toBeCloseTo(base.x, 6)
    expect(base.y - up.y).toBeCloseTo(40 * (ISO.a / Math.SQRT1_2), 6)
    expect(isoProject(p, 40).y).toBeCloseTo(up.y, 6)
  })

  it('la escena entera (1200 × 800) cabe en el lienzo', () => {
    const corners = [
      [0, 0],
      [1200, 0],
      [1200, 800],
      [0, 800],
    ].map(([x, y]) => isoProject({ x, y }, 60))
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x).toBeLessThanOrEqual(1200)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeLessThanOrEqual(800)
    }
  })

  it('un volumen: arriba, sur y este, con la base en el suelo', () => {
    const { top, south, east } = isoPrism({ r: { x: 0, y: 0, w: 100, h: 50 }, base: 0, h: 20 })
    expect(south[0]).toEqual([0, 50]) // esquina de delante a la izquierda, en el suelo
    expect(east[1]).toEqual([100, 50])
    expect(top[2][0]).toBeCloseTo(100 - 20 * Math.SQRT2, 6)
    const sb = isoScreenBox({ x: 0, y: 0, w: 100, h: 50 }, 0, 20)
    expect(sb.h).toBeGreaterThan(20)
  })

  it('la cinta es una mesa y la pieza que lleva va encima', () => {
    const conveyor = { id: 'c', type: 'conveyor', x: 100, y: 300, rot: 0, length: 400 }
    const scene = { elements: [conveyor] }
    const state = { pos: {}, pieces: [] }
    const { boxes, top } = isoBoxes(scene, state, conveyor)
    expect(boxes.length).toBe(1)
    expect(top).toBe(40)
    const r = boxes[0].r
    const piece = { x: r.x + 50, y: r.y + r.h / 2 - 10, w: 20, h: 20 }
    expect(pieceLift(scene, state, piece, [conveyor])).toBe(40)
    expect(pieceLift(scene, state, { ...piece, y: r.y + r.h + 100 }, [conveyor])).toBe(0)
  })

  it('los detectores, en un poste a la altura de la cinta', () => {
    const sensor = { id: 's', type: 'sensor', x: 0, y: 0, rot: 0 }
    expect(isoBoxes({ elements: [sensor] }, { pos: {} }, sensor)).toMatchObject({ boxes: [], top: 40, post: true })
  })
})
