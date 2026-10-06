import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { EXERCISES } from '../../src/lib/exercises'
import { PRACTICE_GUIDES } from '../../src/lib/practiceGuides'
import { normalizeProject } from '../../src/lib/projectFile'
import { buildPlcModel } from '../../src/lib/plcModel'
import { generateLadder } from '../../src/lib/ladder/generate'
import { toS7200 } from '../../src/lib/ladder/exportS7200'
import { makeCpuRunner } from '../../src/lib/plc/cpuRun'

// Lo que se cuenta de uno en uno (C:=C+1) va en la tabla como contador, no como marca: si no, quien
// hace el ejercicio en un autómata no puede usar la variable del enunciado como contador.
const projects = [
  ...EXAMPLES.map((e) => [`ejemplo ${e.id}`, () => e.build()]),
  ...EXERCISES.map((e) => [`ejercicio ${e.id}`, () => e.teacher()]),
  ...PRACTICE_GUIDES.flatMap((g) => g.practices.map((p) => [`práctica ${p.id}`, () => p.teacher()])),
]
const counted = (p) =>
  new Set(
    p.nodes
      .filter((n) => n.type === 'step')
      .flatMap((n) => (n.data.actions ?? []).map((a) => String(typeof a === 'string' ? a : a.text)))
      .flatMap((t) => [...t.matchAll(/(\w+)\s*:=\s*\1\s*[+-]\s*1\b/g)].map((m) => m[1])),
  )

describe('contadores de ejemplos, ejercicios y prácticas', () => {
  it('se declaran como contadores', () => {
    const wrong = []
    for (const [id, build] of projects) {
      const p = normalizeProject(build())
      const vars = buildPlcModel(p.nodes, p.edges, p.plc).variables
      for (const name of counted(p)) if (vars.find((v) => v.name === name)?.type !== 'counter') wrong.push(`${id}: ${name}`)
    }
    expect(wrong).toEqual([])
  })
  it('«Contar pulsaciones» cuenta en el intérprete S7-200 con el contador C1', () => {
    const p = normalizeProject(EXAMPLES.find((e) => e.id === 'contador').build())
    const vars = buildPlcModel(p.nodes, p.edges, p.plc).variables
    const out = toS7200(generateLadder(p.nodes, p.edges, p.plc), p.plc, { title: '' })
    const { runner, errors } = makeCpuRunner(out.text, vars.map((v) => (out.remapped[v.name] ? { ...v, address: out.remapped[v.name] } : v)))
    expect(errors).toEqual([])
    let v
    const scan = (ins, n = 3) => {
      for (let i = 0; i < n; i++) v = runner.scan(ins, 0.01)
    }
    scan({})
    scan({ Marcha: 1 })
    for (let k = 0; k < 3; k++) {
      scan({ P: 1 })
      scan({ P: 0 })
    }
    expect(v.C).toBe(2)
    expect(v.Luz).toBe(1)
  })
})
