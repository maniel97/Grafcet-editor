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

  // (las entradas del panel tardan un paso, 0,05 s, en llegar al autómata)
  const near = (got, want) => {
    expect(got).toHaveLength(want.length)
    got.forEach((t, i) => expect(Math.abs(t - want[i])).toBeLessThanOrEqual(0.1))
  }

  it('práctica 6: verde 3 s; roja y amarilla 10 s más, o hasta pulsar otra vez la marcha', () => {
    const ciclo = run(teacher('p6'), 'ciclo').samples
    near(edgesOf(ciclo, 'LV').times, [0.5, 3.5])
    near(edgesOf(ciclo, 'LA').times, [3.5, 13.5])
    near(edgesOf(ciclo, 'LR').times, [0.5, 13.5]) // la roja no parpadea al cambiar de etapa
    const cortar = run(teacher('p6'), 'cortar').samples
    near(edgesOf(cortar, 'LR').times, [0.5, 6])
    expect(cortar.at(-1).values.X0).toBe(1)
  })

  it('práctica 7: verde 1 s, rojo 2 s, amarillo 1,538 s (temporizador de 1 ms); el paro apaga todo', () => {
    const project = teacher('p7')
    const s = run(project, 'secuencia').samples
    near(edgesOf(s, 'LV').times, [0.5, 1.5])
    near(edgesOf(s, 'LR').times, [1.5, 3.5])
    near(edgesOf(s, 'LA').times, [3.5, 5.038])
    expect(project.plc.variables['1.538s/X3'].address).toBe('T32')
    const paro = run(project, 'paro').samples
    near(edgesOf(paro, 'LR').times, [1.5, 2.2])
    expect(edgesOf(paro, 'LA').times).toHaveLength(0)
    expect(paro.at(-1).values.X0).toBe(1)
  })

  it('práctica 8: secuencia continua; la seta para al final del ciclo y al soltarla sigue sola', () => {
    const project = teacher('p8')
    // Tres ciclos de ~4,2 s: A+ arranca en 0,55, 4,75 y 8,95.
    near(edgesOf(run(project, 'marcha').samples, 'A+').times, [0.55, 1.6, 4.75, 5.8, 8.95, 10])
    const seta = run(project, 'seta').samples
    near(edgesOf(seta, 'A+').times, [0.55, 1.6, 6.55, 7.6, 10.75, 11.8])
    // Entre la parada al final de la secuencia (4,75 s) y la suelta de la seta (6,5 s), todo en reposo.
    for (const s of seta.filter((s) => s.t >= 5 && s.t <= 6.4)) {
      expect(s.values.X0).toBe(1)
      for (const o of ['A+', 'A-', 'B+', 'B-']) expect(s.values[o]).toBe(0)
    }
    // Con la seta pulsada, la marcha no hace nada; al soltarla y volver a pulsar PM, arranca.
    const antes = run(project, 'seta-antes').samples
    near(edgesOf(antes, 'A+').times, [4.05, 5.1, 8.25])
  })

  it('práctica 9: el inductivo solo ve el metal; cada cilindro empuja hacia su recogida', () => {
    const project = teacher('p9')
    const metal = run(project, 'metal')
    near(edgesOf(metal.samples, 'A+').times, [1.6, 2.4])
    expect(edgesOf(metal.samples, 'B+').times).toHaveLength(0) // el plástico no se toca
    expect(metal.counts.metal).toBe(1)
    expect(metal.counts.plastico).toBe(0)
    const plastico = run(project, 'plastico')
    near(edgesOf(plastico.samples, 'B+').times, [1.6, 2.6])
    near(edgesOf(plastico.samples, 'B-').times, [2.6, 3.45])
    expect(edgesOf(plastico.samples, 'A+').times).toHaveLength(0)
    expect(plastico.counts.metal).toBe(0)
    expect(plastico.counts.plastico).toBe(1)
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
