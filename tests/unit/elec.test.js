import { describe, expect, it } from 'vitest'
import { elecAction, elecInit, elecStep, powered } from '../../src/lib/elec/solve'
import { contactNumbers, crossReferences, nextTag, terminalAddress } from '../../src/lib/elec/catalog'

const c = (id, type, props = {}) => ({ id, type, x: 0, y: 0, ...props })
let n = 0
const w = (a, ta, b, tb) => ({ id: `w${n++}`, from: { c: a, t: ta }, to: { c: b, t: tb } })
// Avanza el esquema `seconds` en pasos de 50 ms.
const run = (schematic, state, seconds = 0.05, inputs = {}) => {
  let s = state
  let out
  for (let t = 0; t < seconds - 1e-9; t += 0.05) {
    out = elecStep(schematic, s, inputs, 0.05)
    s = out.state
  }
  return { state: s, ...out }
}

describe('esquema eléctrico: mando', () => {
  // L ─ S0 (NC) ─┬─ S1 (NA) ─┬─ KM1 ─ N
  //              └─ KM1 13-14┘
  const schematic = {
    components: [
      c('L', 'rail', { potential: 'L' }),
      c('N', 'rail', { potential: 'N' }),
      c('S0', 'pushbutton', { tag: 'S0', contact: 'NC' }),
      c('S1', 'pushbutton', { tag: 'S1', contact: 'NO' }),
      c('K', 'contact', { ref: 'KM1', contact: 'NO' }),
      c('KM1', 'coil', { tag: 'KM1', kind: 'contactor', signal: 'Motor' }),
    ],
    wires: [w('L', 't0', 'S0', '11'), w('S0', '12', 'S1', '13'), w('S0', '12', 'K', 'a'), w('S1', '14', 'KM1', 'A1'), w('K', 'b', 'KM1', 'A1'), w('KM1', 'A2', 'N', 't0')],
  }

  it('marcha-paro con autorretención', () => {
    let r = run(schematic, elecInit())
    expect(r.state.coils.KM1).toBe(false)
    r = run(schematic, elecAction(schematic, r.state, 'S1', 'press'))
    expect(r.state.coils.KM1).toBe(true)
    expect(r.actuators.Motor).toBe(1) // la bobina mueve la planta (señal enlazada)
    r = run(schematic, elecAction(schematic, r.state, 'S1', 'release'))
    expect(r.state.coils.KM1).toBe(true) // se mantiene por su contacto 13-14
    r = run(schematic, elecAction(schematic, r.state, 'S0', 'press'))
    expect(r.state.coils.KM1).toBe(false)
    expect(r.state.view.pot['L:t0']).toBe('L')
  })

  it('los pulsadores de la planta (señales) accionan sus contactos', () => {
    const bound = { ...schematic, components: schematic.components.map((x) => (x.id === 'S1' ? { ...x, signal: 'Marcha' } : x)) }
    expect(run(bound, elecInit(), 0.05, { physical: { Marcha: true } }).state.coils.KM1).toBe(true)
  })

  it('temporizador a la conexión: su contacto cierra al pasar el tiempo', () => {
    const s = {
      components: [
        c('L', 'rail', { potential: 'L' }),
        c('N', 'rail', { potential: 'N' }),
        c('S', 'switch', { tag: 'S1' }),
        c('KT', 'coil', { tag: 'KT1', kind: 'ton', preset: 2 }),
        c('K', 'contact', { ref: 'KT1', contact: 'NO' }),
        c('H', 'lamp', { tag: 'H1' }),
      ],
      wires: [w('L', 't0', 'S', '13'), w('S', '14', 'KT', 'A1'), w('KT', 'A2', 'N', 't0'), w('L', 't1', 'K', 'a'), w('K', 'b', 'H', 'X1'), w('H', 'X2', 'N', 't1')],
    }
    const on = elecAction(s, elecInit(), 'S', 'toggle')
    expect(run(s, on, 1).state.view.loads.H).toBe(false)
    expect(run(s, on, 2.2).state.view.loads.H).toBe(true)
  })
})

describe('esquema eléctrico: potencia', () => {
  // Inversión de giro: KM1 directo, KM2 cruza L1 y L3.
  const power = (extra = []) => ({
    components: [
      c('L1', 'rail', { potential: 'L1' }),
      c('L2', 'rail', { potential: 'L2' }),
      c('L3', 'rail', { potential: 'L3' }),
      c('L', 'rail', { potential: 'L' }),
      c('N', 'rail', { potential: 'N' }),
      c('Q1', 'breaker', { tag: 'Q1', poles: 3 }),
      c('KM1m', 'maincontacts', { ref: 'KM1' }),
      c('KM2m', 'maincontacts', { ref: 'KM2' }),
      c('M1', 'motor3', { tag: 'M1', signal: 'M', reverse: 'M_inv' }),
      c('SA', 'switch', { tag: 'S1' }),
      c('SB', 'switch', { tag: 'S2' }),
      c('KM1', 'coil', { tag: 'KM1' }),
      c('KM2', 'coil', { tag: 'KM2' }),
      ...extra,
    ],
    wires: [
      w('L1', 't0', 'Q1', '1'),
      w('L2', 't0', 'Q1', '3'),
      w('L3', 't0', 'Q1', '5'),
      ...['1', '3', '5'].flatMap((t, i) => [w('Q1', String(2 * i + 2), 'KM1m', t), w('Q1', String(2 * i + 2), 'KM2m', t)]),
      w('KM1m', '2', 'M1', 'U'),
      w('KM1m', '4', 'M1', 'V'),
      w('KM1m', '6', 'M1', 'W'),
      w('KM2m', '2', 'M1', 'W'),
      w('KM2m', '4', 'M1', 'V'),
      w('KM2m', '6', 'M1', 'U'),
      w('L', 't0', 'SA', '13'),
      w('SA', '14', 'KM1', 'A1'),
      w('KM1', 'A2', 'N', 't0'),
      w('L', 't1', 'SB', '13'),
      w('SB', '14', 'KM2', 'A1'),
      w('KM2', 'A2', 'N', 't1'),
    ],
  })

  it('el orden de las fases da el sentido de giro', () => {
    const s = power()
    const fwd = run(s, elecAction(s, elecInit(), 'SA', 'toggle'))
    expect(fwd.state.view.motors.M1).toMatchObject({ running: true, dir: 1 })
    expect(fwd.actuators).toMatchObject({ M: 1, M_inv: 0 })
    const rev = run(s, elecAction(s, elecInit(), 'SB', 'toggle'))
    expect(rev.state.view.motors.M1).toMatchObject({ running: true, dir: -1 })
    expect(rev.actuators).toMatchObject({ M: 1, M_inv: 1 })
  })

  it('sin enclavamiento, los dos contactores a la vez son un cortocircuito: salta el magnetotérmico', () => {
    const s = power()
    let st = elecAction(s, elecInit(), 'SA', 'toggle')
    st = elecAction(s, st, 'SB', 'toggle')
    const r = run(s, st)
    expect(r.state.tripped.Q1).toBe(true)
    expect(r.state.view.short).toContain('-Q1')
    expect(r.state.view.motors.M1.running).toBe(false)
    // Se quita la causa y se rearma: vuelve a funcionar.
    let fixed = elecAction(s, r.state, 'SB', 'toggle')
    fixed = elecAction(s, fixed, 'Q1', 'toggle')
    expect(run(s, fixed).state.view.motors.M1.running).toBe(true)
  })

  it('cortocircuito sin protección: aviso y todo sin tensión', () => {
    const s = { components: [c('L', 'rail', { potential: 'L' }), c('N', 'rail', { potential: 'N' })], wires: [w('L', 't0', 'N', 't0')] }
    const r = run(s, elecInit())
    expect(r.state.view.short).toMatch(/sin protección/)
    expect(r.state.view.pot['L:t0']).toBe(null)
  })

  it('motor estrella-triángulo', () => {
    const base = [c('L1', 'rail', { potential: 'L1' }), c('L2', 'rail', { potential: 'L2' }), c('L3', 'rail', { potential: 'L3' }), c('M', 'motor6', { tag: 'M1' })]
    const feed = [w('L1', 't0', 'M', 'U1'), w('L2', 't0', 'M', 'V1'), w('L3', 't0', 'M', 'W1')]
    const star = { components: base, wires: [...feed, w('M', 'U2', 'M', 'V2'), w('M', 'V2', 'M', 'W2')] }
    expect(run(star, elecInit()).state.view.motors.M).toMatchObject({ running: true, mode: 'estrella' })
    const delta = { components: base, wires: [...feed, w('L1', 't1', 'M', 'W2'), w('L2', 't1', 'M', 'U2'), w('L3', 't1', 'M', 'V2')] }
    expect(run(delta, elecInit()).state.view.motors.M).toMatchObject({ running: true, mode: 'triángulo' })
    const open = { components: base, wires: feed }
    expect(run(open, elecInit()).state.view.motors.M.running).toBe(false)
  })

  it('el relé térmico disparado abre su contacto 95-96', () => {
    const s = {
      components: [c('L', 'rail', { potential: 'L' }), c('N', 'rail', { potential: 'N' }), c('F2', 'thermal', { tag: 'F2' }), c('K', 'contact', { ref: 'F2', contact: 'NC' }), c('H', 'lamp', { tag: 'H1' })],
      wires: [w('L', 't0', 'K', 'a'), w('K', 'b', 'H', 'X1'), w('H', 'X2', 'N', 't0')],
    }
    expect(run(s, elecInit()).state.view.loads.H).toBe(true)
    expect(run(s, elecAction(s, elecInit(), 'F2', 'overload')).state.view.loads.H).toBe(false)
    expect(contactNumbers(s.components).K).toEqual(['95', '96'])
  })
})

describe('esquema eléctrico: autómata', () => {
  // Entrada: L+ del autómata -> S1 -> I0.0 (1M a M). Salida: 1L desde L+, Q0.0 -> KM1 -> M.
  const s = {
    components: [c('A', 'plc', { tag: 'A1' }), c('S', 'switch', { tag: 'S1' }), c('KM1', 'coil', { tag: 'KM1', signal: 'Motor' })],
    wires: [w('A', 'L+', 'S', '13'), w('S', '14', 'A', 'I0.0'), w('A', '1M', 'A', 'M'), w('A', 'L+', 'A', '1L'), w('A', 'Q0.0', 'KM1', 'A1'), w('KM1', 'A2', 'A', 'M')],
  }
  it('la entrada se activa por el cable y la salida alimenta la bobina', () => {
    expect(run(s, elecInit()).plcIn['I0.0']).toBe(false)
    expect(run(s, elecAction(s, elecInit(), 'S', 'toggle')).plcIn['I0.0']).toBe(true)
    expect(run(s, elecInit(), 0.05, { plcOut: { 'Q0.0': true } }).actuators.Motor).toBe(1)
    expect(run(s, elecInit(), 0.05, { plcOut: {} }).actuators.Motor).toBe(0)
  })
})

describe('esquema eléctrico: utilidades', () => {
  it('potenciales que forman circuito', () => {
    expect(powered('L+', 'M')).toBe(true)
    expect(powered('L', 'N')).toBe(true)
    expect(powered('L1', 'L2')).toBe(true)
    expect(powered('L1', 'L1')).toBe(false)
    expect(powered('L+', 'N')).toBe(false)
    expect(powered('PE', 'L')).toBe(false)
  })
  it('identificadores, numeración de contactos y referencias cruzadas', () => {
    const list = [c('a', 'coil', { tag: 'KM1' }), c('b', 'contact', { ref: 'KM1', contact: 'NO', x: 10 }), c('d', 'contact', { ref: 'KM1', contact: 'NC', x: 20 })]
    expect(nextTag(list, 'KM')).toBe('KM2')
    expect(contactNumbers(list)).toEqual({ b: ['13', '14'], d: ['21', '22'] })
    expect(crossReferences(list).KM1).toHaveLength(2)
    expect(terminalAddress('%IX0.3')).toBe('I0.3')
  })
})

describe('esquema de conexiones del autómata (generado) en la simulación', async () => {
  const { EXAMPLES } = await import('../../src/lib/examples')
  const { normalizeProject } = await import('../../src/lib/projectFile')
  const { buildPlcModel } = await import('../../src/lib/plcModel')
  const { compile, evolve, initialState } = await import('../../src/lib/sim/engine')
  const { makeWorld, advanceWorld } = await import('../../src/lib/sim/world')
  const { sceneAction } = await import('../../src/lib/sim/scene')
  const { generatePlcWiring } = await import('../../src/lib/elec/generate')

  const project = normalizeProject(EXAMPLES.find((e) => e.id === 'marcha-paro').build())
  const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
  const scene = project.plc.scene
  const wiring = generatePlcWiring(compiled.variables, scene)
  const simulate = (electrical, seconds) => {
    const world = makeWorld(scene, () => null, electrical, compiled.variables)
    let w = world.init()
    w = sceneAction(scene, w, 'marcha', 'press')
    let inputs = world.inputs(w)
    let state = evolve(compiled, initialState(compiled), inputs, 0).state
    for (let t = 0.1; t <= seconds + 1e-9; t += 0.1) ({ state, inputs, world: w } = advanceWorld(compiled, { state, inputs, world: w }, t, { world }))
    return { state, w }
  }

  it('crea un aparato por entrada y salida, con su contacto según la planta', () => {
    const types = wiring.components.map((c) => `${c.type}:${c.signal ?? ''}:${c.contact ?? ''}`)
    expect(types).toEqual(expect.arrayContaining(['pushbutton:Marcha:NO', 'pushbutton:Paro:NC', 'coil:Motor:', 'lamp:Piloto:']))
    expect(wiring.skipped).toEqual([])
  })

  it('con el esquema, Marcha llega por el cable a la entrada y la bobina mueve el motor de la planta', () => {
    const { state, w } = simulate({ enabled: true, ...wiring }, 1)
    expect(state.values.Motor).toBe(1)
    expect(w.angle.motor).toBeGreaterThan(0)
    expect(w.elec.view.loads).toMatchObject(Object.fromEntries(wiring.components.filter((c) => c.signal === 'Motor').map((c) => [c.id, true])))
  })

  it('sin el cable de la entrada de Marcha, no arranca', () => {
    const marcha = wiring.components.find((c) => c.signal === 'Marcha')
    const cut = { enabled: true, components: wiring.components, wires: wiring.wires.filter((x) => x.from.c !== marcha.id && x.to.c !== marcha.id) }
    const { state, w } = simulate(cut, 1)
    expect(state.values.Motor ?? 0).toBe(0)
    expect(w.angle.motor ?? 0).toBe(0)
  })
})

describe('plantillas del esquema eléctrico (montajes clásicos)', async () => {
  const { ELEC_TEMPLATES } = await import('../../src/lib/elec/templates')
  const build = (id) => {
    const b = ELEC_TEMPLATES.find((t) => t.id === id).build(0, 0, 'p')
    return { components: b.components, wires: b.wires }
  }
  const press = (s, state, name) => {
    let st = elecAction(s, state, `p-${name}`, 'press')
    st = run(s, st).state
    return run(s, elecAction(s, st, `p-${name}`, 'release')).state
  }

  it('marcha-paro: arranca, se mantiene y para; el piloto lo indica', () => {
    const s = build('marcha-paro')
    let st = press(s, elecInit(), 'S1')
    expect(st.coils.KM1).toBe(true)
    expect(st.view.loads['p-H1']).toBe(true)
    st = press(s, st, 'S0')
    expect(st.coils.KM1).toBe(false)
  })

  it('arranque directo: el motor gira y el relé térmico lo para', () => {
    const s = build('directo')
    let st = press(s, elecInit(), 'S1')
    expect(st.view.motors['p-M1']).toMatchObject({ running: true, dir: 1 })
    st = run(s, elecAction(s, st, 'p-F2', 'overload')).state
    expect(st.coils.KM1).toBe(false)
    expect(st.view.motors['p-M1'].running).toBe(false)
  })

  it('inversión: cada sentido y el enclavamiento impide el cortocircuito', () => {
    const s = build('inversion')
    let st = press(s, elecInit(), 'S1')
    expect(st.view.motors['p-M1']).toMatchObject({ running: true, dir: 1 })
    st = press(s, st, 'S2') // con KM1 dentro, KM2 no entra
    expect(st.coils.KM2).toBe(false)
    expect(st.view.short).toBe(null)
    st = press(s, st, 'S0')
    st = press(s, st, 'S2')
    expect(st.view.motors['p-M1']).toMatchObject({ running: true, dir: -1 })
  })

  it('estrella-triángulo: arranca en estrella y a los 5 s pasa a triángulo', () => {
    const s = build('estrella-triangulo')
    let st = press(s, elecInit(), 'S1')
    expect(st.view.motors['p-M1']).toMatchObject({ running: true, mode: 'estrella' })
    st = run(s, st, 5.3).state
    expect(st.view.motors['p-M1']).toMatchObject({ running: true, mode: 'triángulo' })
    expect(st.view.short).toBe(null)
    expect(st.coils.KM3).toBe(false)
  })
})
