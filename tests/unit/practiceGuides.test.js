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

  it('práctica 8: secuencia continua; la seta para al final del ciclo y al soltarla no arranca sola', () => {
    const project = teacher('p8')
    // Tres ciclos de ~4,2 s: A+ arranca en 0,55, 4,75 y 8,95.
    near(edgesOf(run(project, 'marcha').samples, 'A+').times, [0.55, 1.6, 4.75, 5.8, 8.95, 10])
    const seta = run(project, 'seta').samples
    near(edgesOf(seta, 'A+').times, [0.55, 1.6, 8.05, 9.1, 12.25, 13.3])
    // Desde la parada al final de la secuencia (4,75 s), todo en reposo: también tras soltar la
    // seta (6,5 s), hasta volver a pulsar PM (8 s).
    for (const s of seta.filter((s) => s.t >= 5 && s.t <= 7.9)) {
      expect(s.values.X0).toBe(1)
      for (const o of ['A+', 'A-', 'B+', 'B-']) expect(s.values[o]).toBe(0)
    }
    // Con la seta pulsada, la marcha no hace nada; al soltarla y volver a pulsar PM, arranca.
    const antes = run(project, 'seta-antes').samples
    near(edgesOf(antes, 'A+').times, [4.05, 5.1, 8.25])
  })

  it('práctica 9: el metal pasa por SI al caer y lo empuja B a Metal; el plástico, A a Plástico', () => {
    const project = teacher('p9')
    const metal = run(project, 'metal')
    near(edgesOf(metal.samples, 'SI').times, [0.9, 1.05]) // lo ve al caer, antes de llegar a SC
    near(edgesOf(metal.samples, 'B+').times, [1.1, 2.4])
    near(edgesOf(metal.samples, 'B-').times, [2.4, 3.45])
    expect(edgesOf(metal.samples, 'A+').times).toHaveLength(0)
    expect(metal.counts.metal).toBe(1)
    expect(metal.counts.plastico).toBe(0)
    const plastico = run(project, 'plastico')
    expect(edgesOf(plastico.samples, 'SI').times).toHaveLength(0)
    near(edgesOf(plastico.samples, 'A+').times, [1.1, 2.4]) // hasta a1
    expect(edgesOf(plastico.samples, 'B+').times).toHaveLength(0)
    expect(plastico.counts.metal).toBe(0)
    expect(plastico.counts.plastico).toBe(1)
    // Los dos ciclos acaban en reposo, con los cilindros dentro.
    for (const r of [metal, plastico]) {
      const end = r.samples.at(-1).values
      expect([end.X0, end.a0, end.b0]).toEqual([1, 1, 1])
    }
  })

  it('práctica 10: A sale y entra 3 veces y B 5, cada uno a su paso; pulsar a mitad no hace nada', () => {
    const project = teacher('p10')
    const marcha = run(project, 'marcha').samples
    expect(edgesOf(marcha, 'A+').times).toHaveLength(6)
    expect(edgesOf(marcha, 'B+').times).toHaveLength(10)
    // B no espera a A: los dos salen a la vez y B sigue cuando A ya ha terminado (6,85 s).
    near(edgesOf(marcha, 'A-').times.slice(-1), [6.85])
    near(edgesOf(marcha, 'B-').times.slice(-1), [11.05])
    expect(marcha.at(-1).values.X0).toBe(1)
    const otra = run(project, 'otra').samples
    // La pulsación de los 4 s no cuenta; la de los 13 s vuelve a hacer 3 y 5 ciclos.
    expect(edgesOf(otra, 'A+').times).toHaveLength(12)
    expect(edgesOf(otra, 'B+').times).toHaveLength(20)
    near(edgesOf(otra, 'X0').times, [0.55, 11.05, 13, 23.5])
  })

  it('práctica 11: la caja va y vuelve entre S1 y S2; con otra pulsación, se para a la derecha', () => {
    const project = teacher('p11')
    for (const id of ['ida-vuelta', 'volviendo']) {
      const r = run(project, id).samples
      near(edgesOf(r, 'MD').times, [2, 4.1, 7.15, 10.2])
      near(edgesOf(r, 'MI').times, [4.1, 7.15])
      // Se queda en reposo con la caja delante de S2 (no se ha caído por el extremo).
      const end = r.at(-1).values
      expect([end.X0, end.S2, end.MD, end.MI]).toEqual([1, 1, 0, 0])
    }
  })

  it('práctica 12: roja a la izquierda, azul a la derecha y otra roja; pulsar con una caja en marcha no suelta otra', () => {
    const r = run(teacher('p12'), 'alternar')
    const s = r.samples
    // Cada caja sale con su pulsación (0,5 s, 7 s y 13 s); la de los 2 s no hace nada.
    near(edgesOf(s, 'CR').times, [0.55, 3.9, 13, 16.35])
    near(edgesOf(s, 'CA').times, [7.05, 10.4])
    // Las dos cintas de su lado, a la vez, hasta que su sensor ve caer la caja.
    near(edgesOf(s, 'MSI').times, edgesOf(s, 'MI').times)
    near(edgesOf(s, 'MSD').times, edgesOf(s, 'MD').times)
    near(edgesOf(s, 'SI').times, [3.9, 4.05, 16.35, 16.5])
    near(edgesOf(s, 'SD').times, [10.4, 10.55])
    expect(r.counts).toEqual({ recogida_izq: 2, recogida_der: 1 })
  })

  it('práctica 13: verde si es metal, azul si es plástico, las dos sin pieza; el rojo la expulsa (sin pieza, A no se mueve)', () => {
    const project = teacher('p13')
    const metal = run(project, 'metal')
    near(edgesOf(metal.samples, 'LV').times, [1.5, 3.05])
    expect(edgesOf(metal.samples, 'LA').times).toHaveLength(0)
    near(edgesOf(metal.samples, 'A+').times, [3.05, 4.35])
    const plastico = run(project, 'plastico')
    near(edgesOf(plastico.samples, 'LA').times, [1.5, 3.05])
    expect(edgesOf(plastico.samples, 'LV').times).toHaveLength(0)
    expect(edgesOf(plastico.samples, 'S1').times).toHaveLength(0) // el inductivo no ve el plástico
    for (const r of [metal, plastico]) {
      expect(r.counts.recogida).toBe(1)
      expect([r.samples.at(-1).values.X0, r.samples.at(-1).values.a0]).toEqual([1, 1])
    }
    const vacio = run(project, 'vacio').samples
    near(edgesOf(vacio, 'LV').times, [0.55, 2.55])
    near(edgesOf(vacio, 'LA').times, [0.55, 2.55])
    expect(edgesOf(vacio, 'A+').times).toHaveLength(0)
  })
})

describe('práctica 14', () => {
  const near = (got, want) => {
    expect(got).toHaveLength(want.length)
    got.forEach((t, i) => expect(Math.abs(t - want[i])).toBeLessThanOrEqual(0.1))
  }
  it('con S1 una bolsa y con S5 cinco; pulsar a mitad no hace nada; H1 o H5 durante la carga', () => {
    const una = run(teacher('p14'), 'una')
    expect(una.counts).toEqual({ salida: 1, 'salida:dentro': 1 })
    near(edgesOf(una.samples, 'BOLSA').times, [2.9, 4.8])
    near(edgesOf(una.samples, 'H1').times, [0.55, 4.85])
    expect(edgesOf(una.samples, 'H5').times).toHaveLength(0)
    const cinco = run(teacher('p14'), 'cinco')
    // Cinco bolsas en la primera caja y una en la segunda (la pulsación de los 6 s no cuenta).
    expect(cinco.counts).toEqual({ salida: 2, 'salida:dentro': 6 })
    expect(edgesOf(cinco.samples, 'BOLSA').times).toHaveLength(12)
    expect(edgesOf(cinco.samples, 'CAJA').times).toHaveLength(4)
    near(edgesOf(cinco.samples, 'H5').times, [0.55, 12.65])
    near(edgesOf(cinco.samples, 'H1').times, [21, 25.3])
    // La cinta de las cajas no vuelve a arrancar hasta que la caja ha caído a la recogida.
    expect(cinco.samples.at(-1).values.X0).toBe(1)
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
