import { describe, expect, it } from 'vitest'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { advanceWithPlant, plantAction, plantInit, plantInputNames, plantInputs, plantStep } from '../../src/lib/sim/plant'
import { buildPlcModel } from '../../src/lib/plcModel'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { links, step, transition } from './helpers'

const CYL_A = { id: 'A', type: 'cylinder', extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1', time: 1 }
const CYL_B = { id: 'B', type: 'cylinder', extend: 'B+', retract: 'B-', retracted: 'b0', extended: 'b1', time: 0.5 }

describe('planta virtual: elementos', () => {
  it('cilindro de doble efecto: sale, se queda donde está sin órdenes y vuelve', () => {
    let s = plantInit([CYL_A])
    expect(plantInputs([CYL_A], s)).toEqual({ a0: 1, a1: 0 })
    s = plantStep([CYL_A], s, { 'A+': 1 }, 0.5)
    expect(plantInputs([CYL_A], s)).toEqual({ a0: 0, a1: 0 })
    s = plantStep([CYL_A], s, {}, 5) // sin órdenes: no se mueve
    expect(s.A.pos).toBeCloseTo(0.5)
    s = plantStep([CYL_A], s, { 'A+': 1 }, 0.6)
    expect(plantInputs([CYL_A], s)).toEqual({ a0: 0, a1: 1 })
    s = plantStep([CYL_A], s, { 'A+': 1, 'A-': 1 }, 1) // órdenes contrarias: no se mueve
    expect(s.A.pos).toBe(1)
    s = plantStep([CYL_A], s, { 'A-': 1 }, 2)
    expect(plantInputs([CYL_A], s)).toEqual({ a0: 1, a1: 0 })
  })

  it('cilindro de simple efecto: vuelve con el muelle al quitar la orden', () => {
    const c = { ...CYL_A, retract: '' }
    let s = plantStep([c], plantInit([c]), { 'A+': 1 }, 2)
    expect(s.A.pos).toBe(1)
    s = plantStep([c], s, {}, 0.5)
    expect(s.A.pos).toBeCloseTo(0.5)
  })

  it('cinta: las piezas avanzan con el motor, tapan el sensor final y caen', () => {
    const belt = { id: 'C', type: 'conveyor', motor: 'M', sensor: 'S', entry: 'E', time: 2 }
    let s = plantAction(plantInit([belt]), 'C', 'add-piece')
    expect(plantInputs([belt], s)).toEqual({ S: 0, E: 1 })
    expect(plantAction(s, 'C', 'add-piece')).toBe(s) // la entrada está ocupada
    s = plantStep([belt], s, {}, 5) // motor parado
    expect(s.C.pieces).toEqual([0])
    s = plantStep([belt], s, { M: 1 }, 1.8)
    expect(plantInputs([belt], s)).toEqual({ S: 1, E: 0 })
    s = plantStep([belt], s, { M: 1 }, 0.5)
    expect(s.C.pieces).toEqual([]) // cayó al final
  })

  it('depósito: sensores de nivel y nivel analógico en unidades físicas', () => {
    const tank = { id: 'D', type: 'tank', fill: 'EV1', drain: 'EV2', low: 'Nb', high: 'Na', level: 'Nivel', fillTime: 10, drainTime: 5 }
    const range = () => ({ min: 0, max: 2000 })
    let s = plantInit([tank])
    expect(plantInputs([tank], s, range)).toEqual({ Nb: 0, Na: 0, Nivel: 0 })
    s = plantStep([tank], s, { EV1: 1 }, 5)
    expect(plantInputs([tank], s, range)).toEqual({ Nb: 1, Na: 0, Nivel: 1000 })
    s = plantStep([tank], s, { EV1: 1 }, 5)
    expect(plantInputs([tank], s, range)).toEqual({ Nb: 1, Na: 1, Nivel: 2000 })
    s = plantStep([tank], s, { EV2: 1 }, 5)
    expect(s.D.level).toBe(0)
    expect([...plantInputNames([tank])]).toEqual(['Nb', 'Na', 'Nivel'])
  })
})

describe('planta virtual en la simulación', () => {
  // Secuencia neumática A+ B+ B− A− con dos cilindros de doble efecto.
  const actions = ['A+', 'B+', 'B-', 'A-']
  const conditions = ['Marcha · a0 · b0', 'a1', 'b1', 'b0', 'a0']
  const nodes = [step('s0', '0', 0, { initial: true })]
  const edges = []
  conditions.forEach((c, i) => {
    nodes.push(transition(`t${i}`, c, i * 160 + 80))
    edges.push([i === 0 ? 's0' : `s${i}`, `t${i}`])
    if (i < actions.length) {
      nodes.push(step(`s${i + 1}`, String(i + 1), i * 160 + 160, { actions: [actions[i]] }))
      edges.push([`t${i}`, `s${i + 1}`])
    } else edges.push([`t${i}`, 's0'])
  })
  const compiled = compile(buildPlcModel(nodes, links(edges), EMPTY_PLC))
  const elements = [CYL_A, CYL_B]

  it('la secuencia completa funciona sola, sin tocar ningún final de carrera', () => {
    let plant = plantInit(elements)
    let inputs = { Marcha: 1, ...plantInputs(elements, plant) }
    let state = evolve(compiled, initialState(compiled), inputs, 0).state
    const visited = []
    for (let t = 0.1; t <= 5; t += 0.1) {
      const r = advanceWithPlant(compiled, { state, inputs, plant }, t, { elements })
      ;({ state, inputs, plant } = r)
      if (t > 0.5) inputs = { ...inputs, Marcha: 0 } // un solo ciclo
      const label = compiled.steps.find((s) => state.active.has(s.id)).label
      if (visited.at(-1) !== label) visited.push(label)
    }
    expect(visited).toEqual(['1', '2', '3', '4', '0'])
    expect(plant.A.pos).toBeCloseTo(0)
    expect(plant.B.pos).toBeCloseTo(0)
  })

  it('a saltos grandes (velocidad x10) no se salta ningún final de carrera', () => {
    let plant = plantInit(elements)
    let inputs = { Marcha: 1, ...plantInputs(elements, plant) }
    let state = evolve(compiled, initialState(compiled), inputs, 0).state
    ;({ state, inputs, plant } = advanceWithPlant(compiled, { state, inputs, plant }, 2.2, { elements }))
    // A fuera (1 s) y B fuera (0,5 s) y vuelta de B (0,5 s): en X4, recogiendo A.
    expect(compiled.steps.find((s) => state.active.has(s.id)).label).toBe('4')
  })
})
