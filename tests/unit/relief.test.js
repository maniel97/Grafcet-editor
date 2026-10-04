import { describe, expect, it } from 'vitest'
import { faces, pieceBox, reliefBoxes, reliefOffset } from '../../src/lib/sim/relief'
import { sceneInit } from '../../src/lib/sim/scene'

// Vista en relieve: solo dibujo (proyección oblicua a 45°, media escala).
describe('vista en relieve', () => {
  it('las caras de arriba y de la derecha salen hacia atrás, arriba a la derecha', () => {
    expect(reliefOffset(40)).toEqual({ x: 20, y: -20 })
    const { top, side } = faces({ r: { x: 0, y: 100, w: 50, h: 30 }, depth: 40 })
    expect(top).toEqual([[0, 100], [20, 80], [70, 80], [50, 100]])
    expect(side).toEqual([[50, 100], [70, 80], [70, 110], [50, 130]])
  })
  it('el vástago del cilindro crece con su carrera; las piezas son cubos', () => {
    const scene = { elements: [{ id: 'A', type: 'cylinder', x: 0, y: 0, rot: 0, stroke: 100 }] }
    const state = sceneInit(scene)
    const rod = (pos) => reliefBoxes(scene, { ...state, pos: { A: pos } }, scene.elements[0]).find((b) => b.tone === 'rod').r.w
    // Recogido: 68 px; fuera (carrera 100): 68 − 62 + 100 = 106 px.
    expect(rod(0)).toBe(68)
    expect(rod(1)).toBe(106)
    expect(pieceBox({ x: 0, y: 0, w: 28, h: 28 }).depth).toBe(28)
  })
  it('la barrera abierta no tiene volumen (el brazo gira hacia arriba)', () => {
    const e = { id: 'b', type: 'barrier', x: 0, y: 0, rot: 0, length: 60 }
    const scene = { elements: [e] }
    expect(reliefBoxes(scene, { pos: { b: 0 } }, e)).toHaveLength(1)
    expect(reliefBoxes(scene, { pos: { b: 1 } }, e)).toHaveLength(0)
  })
})
