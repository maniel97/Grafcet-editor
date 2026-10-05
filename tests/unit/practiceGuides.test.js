import { describe, expect, it } from 'vitest'
import { PRACTICE_GUIDES } from '../../src/lib/practiceGuides'
import { runChecks, studentProject } from '../../src/lib/exercise'
import { validateGrafcet } from '../../src/lib/validation'
import { buildPlcModel } from '../../src/lib/plcModel'
import { runScenarioWorld } from '../../src/lib/sim/scenarioMotion'
import { edgesOf } from '../../src/lib/behaviour'

const [guide] = PRACTICE_GUIDES
const teacher = (id) => guide.practices.find((p) => p.id === id).teacher()
const run = (project, scenarioId) => {
  const model = buildPlcModel(project.nodes, project.edges, project.plc)
  return runScenarioWorld(project.plc, model, project.plc.scenarios.find((s) => s.id === scenarioId))
}

describe('guion de prácticas de ejemplo', () => {
  for (const p of guide.practices) {
    it(`${p.id}: la solución cumple la norma y pasa todas sus comprobaciones`, () => {
      const project = teacher(p.id)
      const errors = validateGrafcet(project.nodes, project.edges, project.plc).filter((i) => i.severity === 'error')
      expect(errors).toEqual([])
      const results = runChecks(project)
      expect(results.filter((r) => !r.ok)).toEqual([])
      expect(results.some((r) => r.id.startsWith('comportamiento'))).toBe(true)
      // Y el alumno no recibe el grafcet.
      expect(studentProject(project).nodes.some((n) => n.type === 'step')).toBe(false)
    })
  }

  it('práctica 1: la caja pequeña la empuja P2 y la grande P3, tras su espera', () => {
    const r = run(teacher('p1'), 'cajas')
    // (los interruptores de la planta tardan un paso, 0,05 s, en llegar al autómata)
    const near = (got, want) => got.forEach((t, i) => expect(Math.abs(t - want[i])).toBeLessThanOrEqual(0.1))
    near(edgesOf(r.samples, 'P2').times, [4, 5])
    near(edgesOf(r.samples, 'P3').times, [11.5, 12.5])
    expect(edgesOf(r.samples, 'P2').times).toHaveLength(2)
    expect(edgesOf(r.samples, 'P3').times).toHaveLength(2)
  })

  it('práctica 3: sale y entra mientras el interruptor está encendido; al apagarlo termina el ciclo y se para', () => {
    const r = run(teacher('p3'), 'interruptor')
    expect(edgesOf(r.samples, 'A+').times).toHaveLength(4) // dos ciclos y acaba con A+ apagada
    // Y se queda dentro, en reposo.
    expect(r.samples.at(-1).values.a0).toBe(1)
    expect(r.samples.at(-1).values.X0).toBe(1)
  })

  it('práctica 4: la seta para la cinta al momento y la caja llega a la salida', () => {
    const r = run(teacher('p4'), 'caja')
    const m = edgesOf(r.samples, 'M').times
    expect(m.some((t) => Math.abs(t - 3) < 0.11)).toBe(true) // se para con la seta
    expect(m.some((t) => Math.abs(t - 4) < 0.11)).toBe(true) // y sigue al rearmarla
    expect(r.counts.salida).toBe(1)
  })

  it('práctica 5: trece ciclos exactos; con el paro, acaba el ciclo en curso', () => {
    expect(edgesOf(run(teacher('p5'), 'trece').samples, 'A+').times.length).toBe(26)
    const paro = edgesOf(run(teacher('p5'), 'paro').samples, 'A+').times
    expect(paro.length / 2).toBeLessThan(4)
    expect(paro.at(-1)).toBeGreaterThan(5.2)
  })
})

describe('mandos de la planta en los escenarios', () => {
  it('grabar: la primera pulsación de una seta (de 1 a 0) se graba', async () => {
    const { recordEvent } = await import('../../src/lib/sim/scenario')
    expect(recordEvent([], 1, 'Seta1', 0, 1)).toEqual([{ t: 1, name: 'Seta1', value: 0 }])
    expect(recordEvent([], 1, 'Seta1', 1, 1)).toEqual([])
  })

  it('reproducir: un interruptor de la planta se queda como lo deja el escenario', () => {
    const r = run(teacher('p3'), 'interruptor')
    const at = (t) => r.samples.filter((s) => s.t <= t).at(-1).values.I
    expect([at(0.4), at(1), at(3), at(4.1), at(4.3), at(8)]).toEqual([0, 1, 1, 1, 0, 0])
  })
})
