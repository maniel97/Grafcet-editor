import { describe, expect, it } from 'vitest'
import { elecAction, elecInit, elecStep, phaseOrder } from '../../src/lib/elec/solve'
import { ELEC_TEMPLATES } from '../../src/lib/elec/templates'
import { terminalAddress } from '../../src/lib/elec/catalog'

const run = (schematic, state, seconds = 0.05, inputs = {}) => {
  let s = state
  let out
  for (let t = 0; t < seconds - 1e-9; t += 0.05) {
    out = elecStep(schematic, s, inputs, 0.05)
    s = out.state
  }
  return { state: s, ...out }
}
const act = (s, st, id, action) => run(s, elecAction(s, st, id, action)).state
const press = (s, st, id) => act(s, act(s, st, id, 'press'), id, 'release')
const build = (id) => {
  const b = ELEC_TEMPLATES.find((t) => t.id === id).build(0, 0, 'p')
  return { components: b.components, wires: b.wires }
}

describe('cabecera de máquina', () => {
  it('interruptor general, control de fases y fuente de 24 V', () => {
    const s = build('cabecera')
    let st = run(s, elecInit()).state
    expect(st.view.loads['p-G1']).toBe(true) // la fuente da 24 V
    expect(st.view.loads['p-H1']).toBe(true) // fases en orden
    st = act(s, st, 'p-Q0', 'toggle') // se abre el interruptor general: todo sin tensión
    expect(st.view.loads['p-G1']).toBe(false)
    expect(st.view.loads['p-H1']).toBe(false)
  })

  it('el relé de control de fases no cierra con las fases cambiadas', () => {
    const s = build('cabecera')
    const swapped = { ...s, components: s.components.map((c) => (c.id === 'p-L2' ? { ...c, potential: 'L3' } : c.id === 'p-L3' ? { ...c, potential: 'L2' } : c)) }
    expect(run(swapped, elecInit()).state.view.loads['p-H1']).toBe(false)
    expect(phaseOrder('L1', 'L3', 'L2').dir).toBe(-1)
  })
})

describe('seguridad: relé de seguridad de doble canal', () => {
  const s = build('seguridad')
  const on = (st) => [st.view.loads['p-KM1'], st.view.loads['p-KM2']]

  it('no arranca sin rearme; con el rearme, los dos contactores entran', () => {
    let st = run(s, elecInit()).state
    expect(on(st)).toEqual([false, false])
    expect(st.view.loads['p-H1']).toBe(true) // 41-42: parada
    st = press(s, st, 'p-S2')
    expect(on(run(s, st).state)).toEqual([true, true])
  })

  it('la seta o la puerta paran, y no vuelve a arrancar solo al cerrarlas', () => {
    let st = press(s, run(s, elecInit()).state, 'p-S2')
    for (const id of ['p-S1', 'p-B1']) {
      st = act(s, st, id, 'toggle') // se pulsa la seta / se abre la puerta
      expect(on(st), id).toEqual([false, false])
      st = act(s, st, id, 'toggle')
      expect(on(run(s, st).state), id).toEqual([false, false])
      st = press(s, st, 'p-S2')
      expect(on(run(s, st).state), id).toEqual([true, true])
    }
  })

  it('discrepancia: con un canal abierto (cable cortado) no se puede rearmar', () => {
    const cut = { ...s, wires: s.wires.filter((w) => !(w.from.c === 'p-B1' && w.from.t === '22')) }
    const st = press(cut, run(cut, elecInit()).state, 'p-S2')
    expect(on(run(cut, st).state)).toEqual([false, false])
    expect(st.view.safety['p-KS1'].discrepancy).toBe(true)
  })

  it('cortina fotoeléctrica: sus OSSD a los canales; al cortar el haz, para', () => {
    const curtain = {
      components: [
        { id: 'P', type: 'rail', x: 0, y: 0, potential: 'L+' },
        { id: 'M', type: 'rail', x: 0, y: 0, potential: 'M' },
        { id: 'KS', type: 'safetyrelay', x: 0, y: 0, tag: 'KS1' },
        { id: 'C', type: 'lightcurtain', x: 0, y: 0, tag: 'B1' },
        { id: 'R', type: 'pushbutton', x: 0, y: 0, tag: 'S2', contact: 'NO' },
      ],
      wires: [
        ['P', 't0', 'KS', 'A1'],
        ['KS', 'A2', 'M', 't0'],
        ['P', 't1', 'C', '+24'],
        ['C', '0V', 'M', 't1'],
        ['C', 'OSSD1', 'KS', 'S12'],
        ['C', 'OSSD2', 'KS', 'S22'],
        ['KS', 'S33', 'R', '13'],
        ['R', '14', 'KS', 'S34'],
      ].map(([a, ta, b, tb], i) => ({ id: `w${i}`, from: { c: a, t: ta }, to: { c: b, t: tb } })),
    }
    let st = press(curtain, run(curtain, elecInit()).state, 'R')
    expect(run(curtain, st).state.safety.KS1).toBe(true)
    st = act(curtain, st, 'C', 'toggle') // alguien corta el haz
    expect(st.safety.KS1).toBe(false)
  })
})

describe('accionamientos', () => {
  const s = build('variador')
  it('variador: adelante a 50 Hz, atrás, segunda velocidad y consigna del potenciómetro', () => {
    let st = act(s, run(s, elecInit()).state, 'p-S1', 'toggle')
    expect(st.view.motors['p-M1']).toMatchObject({ running: true, dir: 1, speed: 1 })
    expect(st.view.vfd['p-T1'].hz).toBe(50)
    expect(st.view.beacons['p-P1'].green).toBe(true)
    st = act(s, st, 'p-S3', 'toggle')
    expect(st.view.vfd['p-T1'].hz).toBe(25)
    expect(st.view.motors['p-M1'].speed).toBe(0.5)
    st = act(s, st, 'p-S4', 'toggle') // consigna externa: potenciómetro al 50 % = 5 V = 25 Hz
    expect(st.view.vfd['p-T1'].hz).toBe(25)
    st = act(s, st, 'p-R1', 'set:0.8')
    expect(st.view.vfd['p-T1'].hz).toBe(40)
    st = act(s, act(s, st, 'p-S1', 'toggle'), 'p-S2', 'toggle')
    expect(st.view.motors['p-M1']).toMatchObject({ running: true, dir: -1 })
    st = act(s, st, 'p-S1', 'toggle') // adelante y atrás a la vez: se para
    expect(st.view.motors['p-M1'].running).toBe(false)
    expect(st.view.beacons['p-P1'].green).toBe(false)
  })

  it('el variador mueve el motor con su velocidad (fracción) en la señal de la planta', () => {
    const bound = { ...s, components: s.components.map((c) => (c.id === 'p-M1' ? { ...c, signal: 'Cinta' } : c)) }
    let st = act(bound, run(bound, elecInit()).state, 'p-S1', 'toggle')
    st = elecAction(bound, st, 'p-S3', 'toggle')
    expect(run(bound, st).actuators.Cinta).toBe(0.5)
  })

  it('arrancador suave: rampa y motor en marcha', () => {
    const a = build('arrancador-suave')
    let st = act(a, run(a, elecInit()).state, 'p-S1', 'toggle')
    expect(st.view.motors['p-M1'].running).toBe(true)
    expect(st.view.soft['p-T1'].pct).toBeLessThan(0.1)
    st = run(a, st, 3.1).state
    expect(st.view.soft['p-T1'].pct).toBe(1)
  })

  it('freno: suelta con el motor en marcha y frena al parar', () => {
    const f = build('freno')
    let st = press(f, run(f, elecInit()).state, 'p-S1')
    expect(st.view.loads['p-MB1']).toBe(true)
    st = press(f, st, 'p-S0')
    expect(st.view.loads['p-MB1']).toBe(false)
  })

  it('enclavamiento mecánico: aunque falle el eléctrico, nunca entran los dos', () => {
    const inv = build('inversion')
    // Sin enclavamiento eléctrico (sus contactos, siempre cerrados): solo queda el mecánico.
    const noElec = { ...inv, components: inv.components.map((c) => (c.id === 'p-KM2i' || c.id === 'p-KM1i' ? { ...c, contact: 'NC', ref: 'NADA' } : c)) }
    let st = press(noElec, run(noElec, elecInit()).state, 'p-S1')
    st = press(noElec, st, 'p-S2')
    expect(st.coils.KM1).toBe(true)
    expect(st.coils.KM2).toBe(false)
    expect(st.view.short).toBe(null)
  })
})

describe('analógicas por el esquema', async () => {
  const { EXAMPLES } = await import('../../src/lib/examples')
  const { normalizeProject } = await import('../../src/lib/projectFile')
  const { buildPlcModel } = await import('../../src/lib/plcModel')
  const { compile, evolve, initialState } = await import('../../src/lib/sim/engine')
  const { makeWorld, advanceWorld } = await import('../../src/lib/sim/world')
  const { sceneAction } = await import('../../src/lib/sim/scene')
  const { generatePlcWiring } = await import('../../src/lib/elec/generate')

  it('direcciones analógicas a bornes AIW / AQW', () => {
    expect(terminalAddress('IW64')).toBe('AIW64')
    expect(terminalAddress('%IW66')).toBe('AIW66')
    expect(terminalAddress('PQW80')).toBe('AQW80')
    expect(terminalAddress('AIW0')).toBe('AIW0')
    expect(terminalAddress('I0.0')).toBe('I0.0')
  })

  it('depósito: el nivel llega al autómata por el transmisor de 4-20 mA y se regula igual', () => {
    const project = normalizeProject(EXAMPLES.find((e) => e.id === 'deposito-nivel').build())
    const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
    const scene = project.plc.scene
    const wiring = generatePlcWiring(compiled.variables, scene)
    expect(wiring.components.find((c) => c.type === 'transmitter')).toMatchObject({ signal: 'Nivel', output: '4-20mA' })
    const range = (name) => {
      const v = compiled.variables.find((x) => x.name === name)
      return v?.analog ? { min: v.analog.min, max: v.analog.max } : null
    }
    const world = makeWorld(scene, range, { enabled: true, ...wiring }, compiled.variables)
    let w = world.init()
    for (const id of ['marcha', 'consumir']) w = sceneAction(scene, w, id, 'toggle')
    let inputs = world.inputs(w)
    let state = evolve(compiled, initialState(compiled), inputs, 0).state
    const levels = []
    for (let t = 0.1; t <= 120 + 1e-9; t += 0.1) {
      ;({ state, inputs, world: w } = advanceWorld(compiled, { state, inputs, world: w }, t, { world }))
      if (t > 20) levels.push(inputs.Nivel)
    }
    expect(Math.min(...levels)).toBeGreaterThan(27)
    expect(Math.max(...levels)).toBeLessThan(83)
    // Lo que lee el autómata viene del borne: 4-20 mA.
    const reading = Object.values(w.elec.view.plcInAnalog)[0]
    expect(reading.unit).toBe('mA')
    expect(reading.value).toBeGreaterThanOrEqual(4)
  })
})
