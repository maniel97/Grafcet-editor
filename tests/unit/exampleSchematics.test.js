import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { normalizeProject } from '../../src/lib/projectFile'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { sceneAction, sceneInputNames } from '../../src/lib/sim/scene'
import { advanceWorld, makeWorld } from '../../src/lib/sim/world'

// Simula un ejemplo 40 s accionando los mandos de su planta (interruptores al principio; pulsadores
// NA dos veces) y devuelve la secuencia de etapas activas.
function trace(project, electrical) {
  const model = buildPlcModel(project.nodes, project.edges, project.plc)
  const compiled = compile(model)
  const scene = project.plc.scene
  const range = (name) => {
    const v = compiled.variables.find((x) => x.name === name)
    return v?.analog ? { min: v.analog.min, max: v.analog.max } : null
  }
  const world = makeWorld(scene, range, electrical, model.variables)
  let w = world.init()
  let inputs = world.inputs(w)
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  const seq = []
  for (let k = 1; k <= 400; k++) {
    for (const e of scene?.elements ?? []) {
      if (e.type === 'switch' && k === 5) w = sceneAction(scene, w, e.id, 'toggle')
      if (e.type === 'button' && e.contact !== 'NC' && (k === 5 || k === 150)) w = sceneAction(scene, w, e.id, 'press')
      if (e.type === 'button' && e.contact !== 'NC' && (k === 8 || k === 153)) w = sceneAction(scene, w, e.id, 'release')
    }
    const r = advanceWorld(compiled, { state, inputs, world: w }, k / 10, { world })
    ;({ state, inputs } = r)
    w = r.world
    const now = [...state.active].sort().join(',')
    if (seq.at(-1) !== now) seq.push(now)
  }
  return seq
}

describe('todos los ejemplos traen su esquema eléctrico', () => {
  for (const e of EXAMPLES) {
    it(`${e.id}: con el esquema conectado hace lo mismo que sin él`, () => {
      const project = normalizeProject(e.build())
      const elec = project.plc.electrical
      expect(elec?.components?.some((c) => c.type === 'plc')).toBe(true)
      const hasPlant = (project.plc.scene?.elements?.length ?? 0) > 0
      expect(elec.enabled).toBe(hasPlant)
      if (!hasPlant) return
      // Con planta, cada entrada tiene su mando o detector (si no, no se podría accionar).
      const sensed = new Set(sceneInputNames(project.plc.scene))
      const model = buildPlcModel(project.nodes, project.edges, project.plc)
      expect(model.variables.filter((v) => v.type === 'input' && !sensed.has(v.name)).map((v) => v.name)).toEqual([])
      // Mismas etapas recorridas (por los cables puede verse un instante una etapa de paso) y casi
      // el mismo número de cambios (los relés tardan un paso de simulación).
      const plain = trace(project, null)
      const wired = trace(project, elec)
      for (const s of plain) expect(wired).toContain(s)
      expect(Math.abs(plain.length - wired.length)).toBeLessThanOrEqual(3)
    }, 30000)
  }
})
