import { describe, expect, it } from 'vitest'
import { buildPath, computeRoute } from '../../src/lib/grafcetRouting'
import { internal } from './helpers'

// Simula el estado del store de React Flow y calcula la ruta de cada enlace.
function routes(nodeList, edgeList) {
  const nodeLookup = new Map(nodeList)
  const edges = edgeList.map(([id, source, target]) => ({ id, source, target }))
  const state = { nodeLookup, edgeLookup: new Map(edges.map((e) => [e.id, e])), nodes: [...nodeLookup.values()], edges }
  const out = {}
  for (const e of edges) {
    const s = nodeLookup.get(e.source)
    const t = nodeLookup.get(e.target)
    const h = {
      sourceX: s.internals.positionAbsolute.x + 28,
      sourceY: s.internals.positionAbsolute.y + s.measured.height,
      targetX: t.internals.positionAbsolute.x + 28,
      targetY: t.internals.positionAbsolute.y,
    }
    const route = computeRoute(state, { ...e, ...h })
    out[e.id] = { route, ...buildPath(route, h.sourceX, h.sourceY, h.targetX, h.targetY) }
  }
  return out
}

describe('trazado de enlaces', () => {
  const chain = [
    internal('s0', 'step', 200, 40),
    internal('t1', 'transition', 200, 140),
    internal('s1', 'step', 200, 210),
    internal('t2', 'transition', 200, 310),
    internal('s2', 'step', 200, 380),
    internal('t3', 'transition', 200, 480),
  ]
  const r = routes(chain, [
    ['e1', 's0', 't1'],
    ['loop0', 't3', 's0'],
    ['loop1', 't2', 's1'],
    ['skip', 's0', 's2'],
  ])

  it('enlace normal: recto hacia abajo', () => {
    expect(r.e1.route.kind).toBe('down')
    expect(r.e1.path).toBe('M 228 96 V 140')
  })
  it('bucle: por la izquierda y con flecha', () => {
    expect(r.loop0.route.kind).toBe('loop')
    expect(r.loop0.arrow).toBeTruthy()
  })
  it('bucles anidados en carriles distintos (el exterior más a la izquierda)', () => {
    expect(r.loop0.route.laneX).toBeLessThan(r.loop1.route.laneX)
  })
  it('salto de etapas: rodea por la derecha sin flecha', () => {
    expect(r.skip.route.kind).toBe('skip')
    expect(r.skip.route.laneX).toBeGreaterThan(228)
    expect(r.skip.arrow).toBeUndefined()
  })

  it('divergencia y convergencia en Y: doble línea compartida', () => {
    const and = routes(
      [
        internal('t1', 'transition', 200, 100),
        internal('s2', 'step', 200, 170),
        internal('s3', 'step', 440, 170),
        internal('t2', 'transition', 200, 270),
        internal('t9', 'transition', 200, 440),
        internal('s0', 'step', 200, 0),
      ],
      [
        ['a', 't1', 's2'],
        ['b', 't1', 's3'],
        ['c', 's2', 't2'],
        ['d', 's3', 't2'],
        ['loop', 't9', 's0'],
      ],
    )
    expect(and.a.route.kind).toBe('andDiv')
    expect(and.b.route.kind).toBe('andDiv')
    expect(and.c.route.kind).toBe('andConv')
    expect(and.d.route.kind).toBe('andConv')
    // Las dos ramas dibujan su tramo de doble línea a la misma altura.
    expect(and.a.path).toContain('M 212 144 H 244 M 212 149 H 244')
    expect(and.b.path).toContain('M 212 144 H 484 M 212 149 H 484')
  })

  it('divergencia en O: dobla justo debajo de la etapa', () => {
    const or = routes([internal('s1', 'step', 200, 210), internal('t2', 'transition', 440, 310)], [['d', 's1', 't2']])
    expect(or.d.path).toBe('M 228 266 V 286 H 468 V 310')
  })
})
