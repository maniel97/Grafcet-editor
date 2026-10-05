import { describe, expect, it } from 'vitest'
import { applyResize, resizeCursor, resizeHandles, resizeMeasure } from '../../src/lib/sim/sceneHandles'

const conveyor = { id: 'c', type: 'conveyor', x: 100, y: 200, rot: 0, length: 240 }

describe('tiradores de la planta', () => {
  it('cinta: un tirador en cada extremo, en su eje', () => {
    const h = resizeHandles(conveyor)
    expect(h.map((x) => [x.id, x.x, x.y])).toEqual([
      ['end', 340, 200],
      ['start', 100, 200],
    ])
    expect(h[0].cursor).toBe('ew-resize')
  })

  it('estirar por el final cambia el largo (a la rejilla) y no baja del mínimo', () => {
    expect(applyResize(conveyor, 'end', { x: 403, y: 260 }).length).toBe(300)
    expect(applyResize(conveyor, 'end', { x: 90, y: 200 }).length).toBe(60)
  })

  it('estirar por el principio mueve el origen y el final se queda quieto', () => {
    const r = applyResize(conveyor, 'start', { x: 40, y: 200 })
    expect(r).toMatchObject({ x: 40, y: 200, length: 300 })
    expect(r.x + r.length).toBe(conveyor.x + conveyor.length)
  })

  it('elementos girados: los tiradores y el arrastre siguen su eje', () => {
    const vertical = { ...conveyor, rot: 90 } // el eje local x apunta hacia abajo
    const [end] = resizeHandles(vertical)
    expect([Math.round(end.x), Math.round(end.y)]).toEqual([100, 440])
    expect(end.cursor).toBe('ns-resize')
    expect(applyResize(vertical, 'end', { x: 130, y: 500 }).length).toBe(300)
    const r = applyResize(vertical, 'start', { x: 100, y: 140 })
    expect([r.x, r.y, r.length]).toEqual([100, 140, 300])
  })

  it('cilindro: el tirador está al final de la carrera; diverter y barrera, solo en el extremo', () => {
    const cyl = { type: 'cylinder', x: 0, y: 0, rot: 0, stroke: 100 }
    expect(resizeHandles(cyl).map((h) => [h.id, h.x])).toEqual([['end', 180]])
    expect(applyResize(cyl, 'end', { x: 230, y: 0 }).stroke).toBe(150)
    expect(resizeHandles({ type: 'diverter', x: 0, y: 0, rot: 0, length: 80 }).map((h) => h.id)).toEqual(['end'])
    expect(resizeHandles({ type: 'barrier', x: 0, y: 0, rot: 0, length: 140 }).map((h) => h.id)).toEqual(['end'])
  })

  it('imagen: laterales y esquinas; con Mayús, en proporción', () => {
    const img = { type: 'image', x: 0, y: 0, width: 300, height: 200 }
    expect(resizeHandles(img)).toHaveLength(8)
    expect(applyResize(img, 'e', { x: 400, y: 50 })).toMatchObject({ x: 0, width: 400, height: 200 })
    expect(applyResize(img, 'nw', { x: -100, y: -50 })).toMatchObject({ x: -100, y: -50, width: 400, height: 250 })
    expect(applyResize(img, 'se', { x: 600, y: 230 }, { keepRatio: true })).toMatchObject({ width: 600, height: 400 })
  })

  it('rótulo: la esquina cambia el tamaño de la letra', () => {
    const label = { type: 'label', x: 0, y: 0, text: 'Estación', size: 16 }
    expect(applyResize(label, 'se', { x: 115, y: 0 }).size).toBe(24)
    expect(resizeMeasure({ ...label, size: 24 })).toBe('24 pt')
  })

  it('cursor según el ángulo', () => {
    expect([0, 45, 90, 135, 180].map(resizeCursor)).toEqual(['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize'])
  })

  it('los elementos de tamaño fijo no tienen tiradores', () => {
    expect(resizeHandles({ type: 'button', x: 0, y: 0 })).toEqual([])
  })
})
