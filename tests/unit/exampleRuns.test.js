import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { normalizeProject } from '../../src/lib/projectFile'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { sceneAction } from '../../src/lib/sim/scene'
import { advanceWorld, makeWorld } from '../../src/lib/sim/world'

// Hace funcionar un ejemplo con su planta (grafcet + escena), como la simulación del editor.
function runExample(id, seconds, actions = {}) {
  const project = normalizeProject(EXAMPLES.find((e) => e.id === id).build())
  const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
  const scene = project.plc.scene
  const world = makeWorld(scene)
  let w = world.init()
  for (const [elementId, action] of Object.entries(actions)) w = sceneAction(scene, w, elementId, action)
  let inputs = world.inputs(w)
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  for (let t = 0.1; t <= seconds + 1e-9; t += 0.1) {
    const r = advanceWorld(compiled, { state, inputs, world: w }, t, { world })
    ;({ state, inputs } = r)
    w = r.world
  }
  return { world: w, state, compiled }
}

describe('los ejemplos con planta funcionan de verdad', () => {
  it('clasificadora por tamaño: cada pieza a su recogida', () => {
    // Piezas: pequeña de plástico, grande de plástico, pequeña de metal, grande de metal…
    const { world } = runExample('clasificadora-tamano', 22, { marcha: 'toggle' })
    expect(world.counts).toMatchObject({ rechazo: 2, grandes: 1, pequenas: 1 })
  })

  it('clasificadora por material: el metal a un lado y el plástico al final', () => {
    const { world } = runExample('clasificadora', 12, { marcha: 'toggle' })
    expect(world.counts.metal).toBeGreaterThan(0)
    expect(world.counts.plastico).toBeGreaterThan(0)
    expect(Math.abs(world.counts.metal - world.counts.plastico)).toBeLessThanOrEqual(1) // alternas
  })
})
