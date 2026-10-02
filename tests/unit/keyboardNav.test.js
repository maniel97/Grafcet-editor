import { describe, expect, it } from 'vitest'
import { neighbor, startNode } from '../../src/lib/keyboardNav'

const step = (id, x, y, initial = false) => ({ id, type: 'step', position: { x, y }, data: { label: id, initial } })
const tr = (id, x, y) => ({ id, type: 'transition', position: { x, y }, data: { condition: id } })
const e = (source, target) => ({ id: `${source}-${target}`, source, target })

// 0 → t1 → divergencia en Y: 1 (izq.) y 2 (der.) ; bucle t3 → 0
const nodes = [step('0', 0, 0, true), tr('t1', 0, 100), step('1', 0, 200), step('2', 200, 200), tr('t3', 0, 300), { id: 'n', type: 'note', position: { x: 500, y: 0 }, data: {} }]
const edges = [e('0', 't1'), e('t1', '1'), e('t1', '2'), e('1', 't3'), e('2', 't3'), e('t3', '0')]
const get = (id) => nodes.find((n) => n.id === id)
const go = (id, dir) => neighbor(nodes, edges, get(id), dir)?.id

describe('navegación con Alt + flechas', () => {
  it('sin selección empieza por la etapa inicial', () => {
    expect(startNode(nodes).id).toBe('0')
    expect(neighbor(nodes, edges, null, 'down').id).toBe('0')
    expect(neighbor(nodes, edges, get('n'), 'down').id).toBe('0') // una nota no es navegable
  })
  it('abajo y arriba siguen la secuencia; el bucle no cuenta', () => {
    expect(go('0', 'down')).toBe('t1')
    expect(go('t1', 'down')).toBe('1') // rama de la izquierda
    expect(go('t3', 'down')).toBeUndefined() // el bucle sube: no es «abajo»
    expect(go('0', 'up')).toBeUndefined()
    expect(go('2', 'up')).toBe('t1')
  })
  it('izquierda y derecha: ramas vecinas del mismo tipo', () => {
    expect(go('1', 'right')).toBe('2')
    expect(go('2', 'left')).toBe('1')
    expect(go('2', 'right')).toBeUndefined()
  })
})
