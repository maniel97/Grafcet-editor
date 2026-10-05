import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { normalizeProject } from '../../src/lib/projectFile'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { sceneAction } from '../../src/lib/sim/scene'
import { advanceWorld, makeWorld } from '../../src/lib/sim/world'
import { elecAction } from '../../src/lib/elec/solve'

// Las protecciones del esquema (relé térmico, guardamotor) tienen que parar el motor de verdad:
// en cada ejemplo con esquema y motor, se arranca, se dispara la protección y el motor se para.
const PROTECTIONS = ['thermal', 'motorprotector']
const MOTORS = ['motor3', 'motor6', 'dahlander', 'motor2w', 'motor1']

function setup(example) {
  const project = normalizeProject(example.build())
  const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
  const scene = project.plc.scene
  const elec = project.plc.electrical
  const world = makeWorld(scene, () => null, elec, compiled.variables)
  let w = world.init()
  let inputs = world.inputs(w)
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  let time = 0
  const run = (seconds) => {
    const end = time + seconds
    for (; time < end - 1e-9; ) {
      time = Math.round((time + 0.05) * 1e6) / 1e6
      const r = advanceWorld(compiled, { state, inputs, world: w }, time, { world })
      ;({ state, inputs } = r)
      w = r.world
    }
  }
  return {
    elec,
    scene,
    run,
    do: (id, action) => (w = sceneAction(scene, w, id, action)),
    elecDo: (id, action) => (w = { ...w, elec: elecAction(elec, w.elec, id, action) }),
    spinning: () => elec.components.filter((c) => MOTORS.includes(c.type)).filter((c) => w.elec?.spinning?.[c.id]),
  }
}

const withMotorAndProtection = EXAMPLES.filter((ex) => {
  const c = normalizeProject(ex.build()).plc.electrical?.components ?? []
  return c.some((x) => PROTECTIONS.includes(x.type)) && c.some((x) => MOTORS.includes(x.type))
})

describe('protecciones del motor en los ejemplos', () => {
  it('hay ejemplos que probar', () => expect(withMotorAndProtection.length).toBeGreaterThan(2))

  for (const example of withMotorAndProtection) {
    it(`${example.id}: al dispararse la protección, el motor se para`, () => {
      const sim = setup(example)
      // Arrancar: los mandos de marcha de la planta (pulsador o interruptor).
      const starts = (sim.scene?.elements ?? []).filter((e) => (e.type === 'button' || e.type === 'switch') && /marcha|adelante|derecha|lenta|avance|start/i.test(`${e.variable} ${e.text}`))
      for (const e of starts) sim.do(e.id, e.type === 'switch' ? 'toggle' : 'press')
      sim.run(0.5)
      for (const e of starts) if (e.type === 'button') sim.do(e.id, 'release')
      sim.run(8) // ya en régimen (p. ej. en triángulo), sin cambios de etapa pendientes
      expect(sim.spinning().length, 'el motor arranca').toBeGreaterThan(0)
      for (const p of sim.elec.components.filter((c) => PROTECTIONS.includes(c.type))) sim.elecDo(p.id, 'overload')
      sim.run(1.5)
      expect(sim.spinning().map((m) => m.tag), 'motores girando tras el disparo').toEqual([])
    })
  }
})

// Los montajes del esquema (sin autómata): se pulsa cada pulsador de marcha y se accionan los
// selectores, se dispara cada protección y ningún motor puede seguir girando.
describe('protecciones del motor en los montajes del esquema', async () => {
  const { ELEC_TEMPLATES } = await import('../../src/lib/elec/templates')
  const withBoth = ELEC_TEMPLATES.filter((tpl) => {
    const c = tpl.build(0, 0, 't').components
    return c.some((x) => MOTORS.includes(x.type)) && c.some((x) => PROTECTIONS.includes(x.type))
  })
  it('hay montajes que probar', () => expect(withBoth.length).toBeGreaterThan(3))
  for (const tpl of withBoth) {
    it(`${tpl.id}: al dispararse la protección, el motor se para`, () => {
      const b = tpl.build(0, 0, 't')
      const elec = { enabled: false, components: b.components, wires: b.wires }
      const world = makeWorld(null, () => null, elec, [])
      let w = world.init()
      const act = (id, action) => (w = { ...w, elec: elecAction(elec, w.elec, id, action) })
      const run = (seconds) => {
        for (let i = 0; i < seconds / 0.05; i++) w = world.step(w, {}, 0.05)
      }
      const motors = () => elec.components.filter((c) => MOTORS.includes(c.type) && w.elec?.spinning?.[c.id])
      // Arranque: pulsadores NA que no sean de paro.
      const starts = elec.components.filter((c) => c.type === 'pushbutton' && c.contact !== 'NC' && !/paro|stop|parada/i.test(c.text ?? ''))
      for (const s of starts) {
        act(s.id, 'press')
        run(0.3)
        act(s.id, 'release')
        run(0.3)
      }
      // Interruptores de marcha (p. ej. la orden del variador): se cierran.
      for (const s of elec.components.filter((c) => c.type === 'switch' && /adelante|marcha|consigna/i.test(c.text ?? ''))) act(s.id, 'toggle')
      run(8)
      expect(motors().length, 'el motor arranca').toBeGreaterThan(0)
      for (const p of elec.components.filter((c) => PROTECTIONS.includes(c.type))) act(p.id, 'overload')
      run(1.5)
      expect(motors().map((m) => m.tag)).toEqual([])
    })
  }
})
