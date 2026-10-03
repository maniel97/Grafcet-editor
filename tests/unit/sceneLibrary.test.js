import { describe, expect, it } from 'vitest'
import { exportGroups, importGroups, makeGroup, placeGroup } from '../../src/lib/sim/sceneLibrary'

describe('mis grupos de la planta', () => {
  const X = { id: 'x1', type: 'cylinder', x: 100, y: 120, mountedOn: '' }
  const Z = { id: 'z1', type: 'cylinder', x: 188, y: 120, rot: 90, mountedOn: 'x1' }
  const lamp = { id: 'l1', type: 'lamp', x: 140, y: 60, variable: 'Luz', mountedOn: undefined }

  it('guarda posiciones relativas y conserva el montaje interno', () => {
    const g = makeGroup('  Pick & place  ', [X, Z, lamp], 'g1')
    expect(g.name).toBe('Pick & place')
    expect(g.elements.map((e) => [e.id, e.x, e.y])).toEqual([
      ['x1', 0, 60],
      ['z1', 88, 60],
      ['l1', 40, 0],
    ])
    expect(g.elements[1].mountedOn).toBe('x1')
    // Montado en un cilindro que no va en el grupo: queda fijo.
    expect(makeGroup('Z', [Z]).elements[0].mountedOn).toBe('')
  })

  it('al colocarlo: ids nuevos, posición y referencias actualizadas', () => {
    let n = 0
    const placed = placeGroup(makeGroup('PP', [X, Z]), { x: 300, y: 400 }, () => `n${++n}`)
    expect(placed.map((e) => [e.id, e.x, e.y, e.mountedOn])).toEqual([
      ['n1', 300, 400, ''],
      ['n2', 388, 400, 'n1'],
    ])
  })

  it('exportar e importar (sumando a los que hay, sin ids repetidos)', () => {
    const g = makeGroup('PP', [X, Z], 'g1')
    const merged = importGroups(exportGroups([g]), [g])
    expect(merged).toHaveLength(2)
    expect(merged[1].id).not.toBe('g1')
    expect(merged[1].name).toBe('PP')
    expect(() => importGroups('{"format":"otra-cosa"}', [])).toThrow('no contiene grupos')
    expect(() => importGroups('no es json', [])).toThrow('JSON válido')
  })
})
