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

describe('estación de elevación (vista de frente, con gravedad)', () => {
  it('cada ciclo lleva una pieza a la recogida', () => {
    const { world } = runExample('elevador-frente', 40, { marcha: 'toggle' })
    expect(world.counts.recogida).toBeGreaterThanOrEqual(3)
  })

  it('con el elevador atascado, la vigilancia de tiempo enciende la alarma', () => {
    let alarm = false
    const { state } = runExample('elevador-frente', 15, { marcha: 'toggle', elevador: 'fault:stuck' }, (t, { state }) => {
      if (state.values.Alarma) alarm = true
    })
    expect(alarm).toBe(true)
    expect([...state.active]).toEqual(['s5'])
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

describe('ejemplos documentados: tabla de variables, direcciones y comentarios', async () => {
  const { validatePlc } = await import('../../src/lib/addressing')
  const { projectVariables } = await import('../../src/lib/symbols')
  const { generateLadder } = await import('../../src/lib/ladder/generate')
  const { toS7200 } = await import('../../src/lib/ladder/exportS7200')
  const { makeCpuRunner } = await import('../../src/lib/plc/cpuRun')
  for (const example of EXAMPLES) {
    it(example.title, () => {
      const project = normalizeProject(example.build())
      const { nodes, edges, plc } = project
      // La tabla en el lienzo, a la izquierda de todo el grafcet.
      const table = nodes.find((n) => n.type === 'variables')
      const drawing = nodes.filter((n) => ['step', 'transition', 'frame'].includes(n.type))
      expect(table.position.x).toBeLessThan(Math.min(...drawing.map((n) => n.position.x)) - 400)
      // Cada variable y cada etapa con dirección y comentario.
      const model = buildPlcModel(nodes, edges, plc)
      for (const v of model.variables) {
        if (v.type === 'timer') continue // los temporizadores t/Xn los calcula el programa
        expect(v.address, `${v.name}: dirección`).toMatch(/\S/)
        expect(v.comment, `${v.name}: comentario`).toMatch(/\S/)
      }
      for (const s of model.steps) {
        expect(s.address, `${s.variable}: dirección`).toMatch(/\S/)
        expect(plc.steps[s.id]?.comment, `${s.variable}: comentario`).toMatch(/\S/)
      }
      // Sin direcciones repetidas ni fuera de su zona.
      const stepNodes = nodes.filter((n) => n.type === 'step')
      expect(validatePlc(plc, stepNodes, projectVariables(nodes, plc.variables))).toEqual([])
      // Las direcciones funcionan: el STL S7-200 generado corre en la CPU simulada sin avisos.
      const text = toS7200(generateLadder(nodes, edges, plc), plc, { title: '' }).text
      const { errors, warnings } = makeCpuRunner(text, model.variables)
      expect(errors.map((e) => e.message)).toEqual([])
      expect(warnings).toEqual([])
    })
  }
})

describe('paro inmediato con encapsulación', () => {
  it('Marcha cicla el cilindro; Paro a media carrera desactiva todo lo encapsulado', () => {
    const project = normalizeProject(EXAMPLES.find((e) => e.id === 'encapsulacion').build())
    const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
    const scene = project.plc.scene
    const world = makeWorld(scene, () => null)
    let w = world.init()
    let inputs = world.inputs(w)
    let state = evolve(compiled, initialState(compiled), inputs, 0).state
    const labels = () => [...state.active].map((id) => compiled.steps.find((s) => s.id === id).label).sort()
    const advance = (from, to) => {
      for (let t = from + 0.1; t <= to + 1e-9; t += 0.1) {
        const r = advanceWorld(compiled, { state, inputs, world: w }, t, { world })
        ;({ state, inputs } = r)
        w = r.world
      }
    }
    w = sceneAction(scene, w, 'marcha', 'press')
    advance(0, 0.3)
    w = sceneAction(scene, w, 'marcha', 'release')
    expect(labels()).toEqual(['1', '11'])
    advance(0.3, 2.5) // A sale (1,5 s) y empieza a entrar
    expect(labels()).toEqual(['1', '12'])
    w = sceneAction(scene, w, 'paro', 'press')
    advance(2.5, 2.8)
    expect(labels()).toEqual(['0'])
    expect(state.values['A-']).toBe(0)
    expect(state.values.En_marcha).toBe(0)
  })
})

describe('cargador por gravedad', () => {
  it('con 6 piezas repuestas, Marcha saca un lote de 5 y queda 1 en el cargador', () => {
    const project = normalizeProject(EXAMPLES.find((e) => e.id === 'cargador-gravedad').build())
    const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
    const scene = project.plc.scene
    const world = makeWorld(scene, () => null)
    let w = world.init()
    let inputs = world.inputs(w)
    let state = evolve(compiled, initialState(compiled), inputs, 0).state
    let time = 0
    const advance = (seconds) => {
      for (const end = time + seconds; time < end - 1e-9; ) {
        time = Math.round((time + 0.1) * 10) / 10
        const r = advanceWorld(compiled, { state, inputs, world: w }, time, { world })
        ;({ state, inputs } = r)
        w = r.world
      }
    }
    for (let i = 0; i < 6; i++) {
      w = sceneAction(scene, w, 'reponer', 'press')
      advance(0.2)
      w = sceneAction(scene, w, 'reponer', 'release')
      advance(0.6)
    }
    expect(w.pieces).toHaveLength(6)
    w = sceneAction(scene, w, 'marcha', 'press')
    advance(0.3)
    w = sceneAction(scene, w, 'marcha', 'release')
    advance(20)
    expect(state.values.Lote_listo).toBe(1)
    expect(state.values.C).toBe(5)
    advance(4) // la cinta sigue hasta vaciarse
    expect(w.counts.recogida).toBe(5)
    expect(w.pieces).toHaveLength(1)
  })
})

describe('apilador con trampilla', () => {
  it('apila de 3 en 3 y descarga cada pila en la recogida', () => {
    let opened = 0
    const { world, state } = runExample('apilador-trampilla', 30, { marcha: 'toggle' }, (t, { state: s }) => {
      if (s.values.Abrir) opened++
    })
    expect(opened).toBeGreaterThan(0)
    expect(world.counts.recogida % 3).toBe(0)
    expect(world.counts.recogida).toBeGreaterThanOrEqual(6)
    expect(state.values.C).toBe(world.counts.recogida / 3)
  })
})
