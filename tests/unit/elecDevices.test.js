import { describe, expect, it } from 'vitest'
import { elecAction, elecInit, elecStep } from '../../src/lib/elec/solve'
import { ELEC_TEMPLATES } from '../../src/lib/elec/templates'

const c = (id, type, props = {}) => ({ id, type, x: 0, y: 0, ...props })
let n = 0
const w = (a, ta, b, tb) => ({ id: `w${n++}`, from: { c: a, t: ta }, to: { c: b, t: tb } })
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
const lamp = (st, id = 'H') => st.view.loads[id]

describe('aparatos: protecciones', () => {
  // L - F1 - (S1) - H - N ; S2 une la salida del fusible con N (cortocircuito).
  const s = {
    components: [c('L', 'rail', { potential: 'L' }), c('N', 'rail', { potential: 'N' }), c('F1', 'fuse', { tag: 'F1' }), c('H', 'lamp', { tag: 'H1' }), c('S2', 'switch', { tag: 'S2' })],
    wires: [w('L', 't0', 'F1', '1'), w('F1', '2', 'H', 'X1'), w('H', 'X2', 'N', 't0'), w('F1', '2', 'S2', '13'), w('S2', '14', 'N', 't1')],
  }
  it('el fusible se funde con un cortocircuito y se repone', () => {
    let st = run(s, elecInit()).state
    expect(lamp(st)).toBe(true)
    st = act(s, st, 'S2', 'toggle')
    expect(st.tripped.F1).toBe(true)
    expect(st.view.short).toMatch(/fundido -F1/)
    expect(lamp(st)).toBe(false)
    st = act(s, act(s, st, 'S2', 'toggle'), 'F1', 'toggle') // se quita la causa y se repone
    expect(lamp(st)).toBe(true)
  })

  // Diferencial -Q1 y magnetotérmico -Q2 en serie; S2 provoca una derivación a tierra, S3 un
  // cortocircuito fase-neutro.
  const rcd = {
    components: [
      c('L', 'rail', { potential: 'L' }),
      c('N', 'rail', { potential: 'N' }),
      c('PE', 'rail', { potential: 'PE' }),
      c('Q1', 'rcd', { tag: 'Q1' }),
      c('Q2', 'breaker', { tag: 'Q2', poles: 1 }),
      c('H', 'lamp', { tag: 'H1' }),
      c('S2', 'switch', { tag: 'S2' }),
      c('S3', 'switch', { tag: 'S3' }),
    ],
    wires: [
      w('L', 't0', 'Q1', '1'),
      w('N', 't0', 'Q1', '3'),
      w('Q1', '2', 'Q2', '1'),
      w('Q2', '2', 'H', 'X1'),
      w('H', 'X2', 'Q1', '4'),
      w('Q2', '2', 'S2', '13'),
      w('S2', '14', 'PE', 't0'),
      w('Q2', '2', 'S3', '13'),
      w('S3', '14', 'Q1', '4'),
    ],
  }
  it('diferencial: salta con una derivación a tierra (no el magnetotérmico) y con su botón de prueba', () => {
    let st = run(rcd, elecInit()).state
    expect(lamp(st)).toBe(true)
    const earth = act(rcd, st, 'S2', 'toggle')
    expect(earth.tripped.Q1).toBe(true)
    expect(earth.tripped.Q2).toBeFalsy()
    expect(earth.view.short).toMatch(/Derivación a tierra/)
    const tested = act(rcd, st, 'Q1', 'test')
    expect(tested.tripped.Q1).toBe(true)
    expect(lamp(tested)).toBe(false)
  })
  it('un cortocircuito fase-neutro lo corta el magnetotérmico, no el diferencial', () => {
    const st = act(rcd, run(rcd, elecInit()).state, 'S3', 'toggle')
    expect(st.tripped.Q2).toBe(true)
    expect(st.tripped.Q1).toBeFalsy()
  })
})

describe('aparatos: mando', () => {
  it('transformador: el secundario es un circuito aparte, con tensión solo si el primario la tiene', () => {
    const s = {
      components: [c('L', 'rail', { potential: 'L' }), c('N', 'rail', { potential: 'N' }), c('S', 'switch', { tag: 'S1' }), c('T', 'transformer', { tag: 'T1' }), c('H', 'lamp', { tag: 'H1' })],
      wires: [w('L', 't0', 'S', '13'), w('S', '14', 'T', 'P1'), w('N', 't0', 'T', 'P2'), w('T', 'S1', 'H', 'X1'), w('H', 'X2', 'T', 'S2')],
    }
    expect(lamp(run(s, elecInit()).state)).toBe(false)
    expect(lamp(act(s, elecInit(), 'S', 'toggle'))).toBe(true)
    // Mezclar el secundario con la red (fase) sin protección: cortocircuito.
    const mixed = { ...s, wires: [...s.wires, w('T', 'S1', 'N', 't1')] }
    expect(act(mixed, elecInit(), 'S', 'toggle').view.short).toMatch(/Cortocircuito/)
  })

  it('conmutador 0-1-2: cada posición cierra su contacto', () => {
    const s = {
      components: [c('L', 'rail', { potential: 'L' }), c('N', 'rail', { potential: 'N' }), c('S', 'selector3', { tag: 'S1' }), c('H1', 'lamp', { tag: 'H1' }), c('H2', 'lamp', { tag: 'H2' })],
      wires: [w('L', 't0', 'S', '13'), w('L', 't1', 'S', '23'), w('S', '14', 'H1', 'X1'), w('S', '24', 'H2', 'X1'), w('H1', 'X2', 'N', 't0'), w('H2', 'X2', 'N', 't1')],
    }
    let st = run(s, elecInit()).state
    expect([lamp(st, 'H1'), lamp(st, 'H2')]).toEqual([false, false])
    st = act(s, st, 'S', 'toggle')
    expect([lamp(st, 'H1'), lamp(st, 'H2')]).toEqual([true, false])
    st = act(s, st, 'S', 'toggle')
    expect([lamp(st, 'H1'), lamp(st, 'H2')]).toEqual([false, true])
    st = act(s, st, 'S', 'toggle')
    expect(st.view.pos.S).toBe(0)
  })

  it('detector de 3 hilos: PNP da + y NPN da − a la entrada, solo alimentado', () => {
    const make = (output, supplied = true) => ({
      components: [c('A', 'plc', { tag: 'A1' }), c('B', 'sensor3', { tag: 'B1', output, signal: 'Pieza' })],
      wires: [
        ...(supplied ? [w('A', 'L+', 'B', 'BN'), w('A', 'M', 'B', 'BU')] : []),
        w('B', 'BK', 'A', 'I0.0'),
        // PNP: común 1M a M (sumidero); NPN: común 1M a L+ (fuente).
        output === 'PNP' ? w('A', '1M', 'A', 'M') : w('A', '1M', 'A', 'L+'),
      ],
    })
    for (const out of ['PNP', 'NPN']) {
      expect(run(make(out), elecInit(), 0.1, { physical: { Pieza: true } }).plcIn['I0.0'], out).toBe(true)
      expect(run(make(out), elecInit(), 0.1, { physical: { Pieza: false } }).plcIn['I0.0'], out).toBe(false)
      expect(run(make(out, false), elecInit(), 0.1, { physical: { Pieza: true } }).plcIn['I0.0'], `${out} sin alimentar`).toBe(false)
    }
  })

  it('relé intermitente: su contacto abre y cierra mientras está alimentado', () => {
    const s = {
      components: [c('L', 'rail', { potential: 'L' }), c('N', 'rail', { potential: 'N' }), c('S', 'switch', { tag: 'S1' }), c('KF', 'coil', { tag: 'KF1', kind: 'flash', preset: 0.5 }), c('K', 'contact', { ref: 'KF1', contact: 'NO' }), c('H', 'lamp', { tag: 'H1' })],
      wires: [w('L', 't0', 'S', '13'), w('S', '14', 'KF', 'A1'), w('KF', 'A2', 'N', 't0'), w('L', 't1', 'K', 'a'), w('K', 'b', 'H', 'X1'), w('H', 'X2', 'N', 't1')],
    }
    let st = elecAction(s, elecInit(), 'S', 'toggle')
    const seen = []
    for (let i = 0; i < 40; i++) {
      st = run(s, st).state
      seen.push(lamp(st))
    }
    expect(seen.filter(Boolean).length).toBeGreaterThan(10)
    expect(seen.filter((x) => !x).length).toBeGreaterThan(10)
  })

  it('contador: a la tercera pulsación cierra su contacto; R1-R2 lo pone a cero', () => {
    const s = {
      components: [
        c('L', 'rail', { potential: 'L' }),
        c('N', 'rail', { potential: 'N' }),
        c('S1', 'pushbutton', { tag: 'S1' }),
        c('S2', 'pushbutton', { tag: 'S2' }),
        c('KC', 'counter', { tag: 'KC1', preset: 3 }),
        c('K', 'contact', { ref: 'KC1', contact: 'NO' }),
        c('H', 'lamp', { tag: 'H1' }),
      ],
      wires: [w('L', 't0', 'S1', '13'), w('S1', '14', 'KC', 'A1'), w('KC', 'A2', 'N', 't0'), w('L', 't1', 'S2', '13'), w('S2', '14', 'KC', 'R1'), w('KC', 'R2', 'N', 't1'), w('L', 't2', 'K', 'a'), w('K', 'b', 'H', 'X1'), w('H', 'X2', 'N', 't2')],
    }
    let st = run(s, elecInit()).state
    for (let i = 0; i < 2; i++) st = press(s, st, 'S1')
    expect(st.view.counts.KC1).toBe(2)
    expect(lamp(run(s, st).state)).toBe(false)
    st = press(s, st, 'S1')
    expect(lamp(run(s, st).state)).toBe(true)
    st = press(s, st, 'S2')
    expect(st.view.counts.KC1).toBe(0)
  })
})

describe('plantillas de vivienda y de mando a 24 V', () => {
  const build = (id) => {
    const b = ELEC_TEMPLATES.find((t) => t.id === id).build(0, 0, 'p')
    return { components: b.components, wires: b.wires }
  }
  const on = (st) => st.view.loads['p-E1']

  it('punto de luz: el interruptor enciende; el botón de prueba del diferencial lo corta', () => {
    const s = build('punto-luz')
    let st = act(s, run(s, elecInit()).state, 'p-S1', 'toggle')
    expect(on(st)).toBe(true)
    st = act(s, st, 'p-Q1', 'test')
    expect(on(st)).toBe(false)
  })

  it('conmutada: cada conmutador cambia la lámpara', () => {
    const s = build('conmutada')
    let st = run(s, elecInit()).state
    const before = on(st)
    st = act(s, st, 'p-S1', 'toggle')
    expect(on(st)).toBe(!before)
    st = act(s, st, 'p-S2', 'toggle')
    expect(on(st)).toBe(before)
  })

  it('cruzamiento: cualquiera de los tres cambia la lámpara', () => {
    const s = build('cruzamiento')
    let st = run(s, elecInit()).state
    let last = on(st)
    for (const id of ['p-S1', 'p-S2', 'p-S3', 'p-S2']) {
      st = act(s, st, id, 'toggle')
      expect(on(st), id).toBe(!last)
      last = on(st)
    }
  })

  it('telerruptor: cada pulsación (de cualquier pulsador) cambia la lámpara', () => {
    const s = build('telerruptor')
    let st = run(s, elecInit()).state
    expect(on(st)).toBe(false)
    st = press(s, st, 'p-S1')
    expect(on(run(s, st).state)).toBe(true)
    st = press(s, st, 'p-S3')
    expect(on(run(s, st).state)).toBe(false)
  })

  it('minutero: enciende con un pulsador y apaga solo a los 30 s', () => {
    const s = build('minutero')
    let st = press(s, run(s, elecInit()).state, 'p-S2')
    expect(on(run(s, st, 20).state)).toBe(true)
    expect(on(run(s, st, 31).state)).toBe(false)
  })

  it('mando a 24 V~: marcha-paro con el transformador; sin el fusible, nada', () => {
    const s = build('mando-24v')
    let st = press(s, run(s, elecInit()).state, 'p-S1')
    expect(st.coils.KM1).toBe(true)
    st = act(s, st, 'p-F1', 'toggle') // seccionador portafusibles abierto
    expect(st.coils.KM1).toBe(false)
  })
})

describe('conexiones del autómata con detectores de 3 hilos (clasificadora)', async () => {
  const { EXAMPLES } = await import('../../src/lib/examples')
  const { normalizeProject } = await import('../../src/lib/projectFile')
  const { buildPlcModel } = await import('../../src/lib/plcModel')
  const { compile, evolve, initialState } = await import('../../src/lib/sim/engine')
  const { makeWorld, advanceWorld } = await import('../../src/lib/sim/world')
  const { sceneAction } = await import('../../src/lib/sim/scene')
  const { generatePlcWiring } = await import('../../src/lib/elec/generate')

  it('el detector inductivo (PNP) lleva «Metal» al autómata y el metal sale por su recogida', () => {
    const project = normalizeProject(EXAMPLES.find((e) => e.id === 'clasificadora').build())
    const compiled = compile(buildPlcModel(project.nodes, project.edges, project.plc))
    const scene = project.plc.scene
    const wiring = generatePlcWiring(compiled.variables, scene)
    expect(wiring.components.find((x) => x.signal === 'Metal')).toMatchObject({ type: 'sensor3', output: 'PNP', kind: 'inductive' })
    const world = makeWorld(scene, () => null, { enabled: true, ...wiring }, compiled.variables)
    let w = sceneAction(scene, world.init(), 'marcha', 'toggle')
    let inputs = world.inputs(w)
    let state = evolve(compiled, initialState(compiled), inputs, 0).state
    for (let t = 0.1; t <= 12 + 1e-9; t += 0.1) ({ state, inputs, world: w } = advanceWorld(compiled, { state, inputs, world: w }, t, { world }))
    expect(w.counts.metal).toBeGreaterThan(0)
    expect(w.counts.plastico).toBeGreaterThan(0)
  })
})
