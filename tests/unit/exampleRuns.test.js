import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { normalizeProject } from '../../src/lib/projectFile'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { sceneAction } from '../../src/lib/sim/scene'
import { advanceWorld, makeWorld } from '../../src/lib/sim/world'

// Hace funcionar un ejemplo con su planta (grafcet + escena), como la simulación del editor.
// observe(t, { state, inputs, world }) se llama en cada paso de 0,1 s.
function runExample(id, seconds, actions = {}, observe = () => {}) {
  const project = normalizeProject(EXAMPLES.find((e) => e.id === id).build())
  const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
  const scene = project.plc.scene
  const range = (name) => {
    const v = compiled.variables.find((x) => x.name === name)
    return v?.analog ? { min: v.analog.min, max: v.analog.max } : null
  }
  const world = makeWorld(scene, range)
  let w = world.init()
  for (const [elementId, action] of Object.entries(actions)) w = sceneAction(scene, w, elementId, action)
  let inputs = world.inputs(w)
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  for (let t = 0.1; t <= seconds + 1e-9; t += 0.1) {
    const r = advanceWorld(compiled, { state, inputs, world: w }, t, { world })
    ;({ state, inputs } = r)
    w = r.world
    observe(t, { state, inputs, world: w })
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

describe('ejemplos analógicos', () => {
  it('horno: la temperatura se mantiene en la consigna ± 5 °C', () => {
    const temps = []
    runExample('horno', 240, { marcha: 'toggle' }, (t, { inputs }) => t > 120 && temps.push(inputs.Temp))
    // Consigna al 50 % de 0–200 °C = 100 °C: oscila entre 95 y 105 (con un poco de inercia).
    expect(Math.min(...temps)).toBeGreaterThan(92)
    expect(Math.max(...temps)).toBeLessThan(108)
    expect(Math.max(...temps) - Math.min(...temps)).toBeGreaterThan(8) // regula, no se queda fijo
  })

  it('depósito: con consumo, la bomba mantiene el nivel entre el 30 y el 80 %', () => {
    const levels = []
    let pumped = false
    runExample('deposito-nivel', 120, { marcha: 'toggle', consumir: 'toggle' }, (t, { inputs, state }) => {
      if (t > 20) levels.push(inputs.Nivel)
      if (state.values.Bomba) pumped = true
    })
    expect(pumped).toBe(true)
    expect(Math.min(...levels)).toBeGreaterThan(27)
    expect(Math.max(...levels)).toBeLessThan(83)
  })
})
