import { describe, expect, it } from 'vitest'
import { elecAction, elecInit, elecStep } from '../../src/lib/elec/solve'
import { pneuStep, valveBlocked, valvePaths, valvePosition } from '../../src/lib/elec/pneumatic'
import { ELEC_TEMPLATES, insertTemplate } from '../../src/lib/elec/templates'

const c = (id, type, props = {}) => ({ id, type, x: 0, y: 0, ...props })
let n = 0
const w = (a, ta, b, tb) => ({ id: `w${n++}`, from: { c: a, t: ta }, to: { c: b, t: tb } })
const run = (schematic, state, seconds = 0.05) => {
  let s = state
  for (let t = 0; t < seconds - 1e-9; t += 0.05) s = elecStep(schematic, s, {}, 0.05).state
  return s
}
const act = (s, st, id, action) => run(s, elecAction(s, st, id, action))
const pos = (st, id = 'A') => st.view.pneu.cylinders[id].pos

// Mando: L+ - S1 (interruptor) - Y1 - M. Aire: 0P1 - 0Z1 - 1V1 (5/2 con -Y1 y muelle) - cilindro A
// (doble efecto, 1 s) con el regulador 1V2 en la salida 2 (lado B).
const electro = (valve = {}) => ({
  components: [
    c('Lp', 'rail', { potential: 'L+' }),
    c('M', 'rail', { potential: 'M' }),
    c('S1', 'switch', { tag: 'S1' }),
    c('Y1', 'valve', { tag: 'Y1' }),
    c('P', 'airsource', { tag: '0P1' }),
    c('Z', 'frl', { tag: '0Z1' }),
    c('V', 'pvalve', { tag: '1V1', ways: '5/2', sol14: 'Y1', ...valve }),
    c('R', 'throttle', { tag: '1V2', setting: 1 }),
    c('A', 'pcylinder', { tag: 'A', acting: 'double', time: 1 }),
  ],
  wires: [
    w('Lp', 't0', 'S1', '13'),
    w('S1', '14', 'Y1', 'A1'),
    w('Y1', 'A2', 'M', 't0'),
    w('P', '1', 'Z', '1'),
    w('Z', '2', 'V', '1'),
    w('V', '4', 'A', 'A'),
    w('V', '2', 'R', '1'),
    w('R', '2', 'A', 'B'),
  ],
})

describe('neumática: válvulas', () => {
  it('pasos ISO 5599 de la 5/2 y de la 3/2', () => {
    expect(valvePaths({ ways: '5/2' }, '12')).toEqual([['1', '2'], ['4', '5']])
    expect(valvePaths({ ways: '5/2' }, '14')).toEqual([['1', '4'], ['2', '3']])
    expect(valvePaths({ ways: '3/2' }, '12')).toEqual([['2', '3']])
    expect(valvePaths({ ways: '3/2', normally: 'NO' }, '12')).toEqual([['1', '2']])
    expect(valveBlocked({ ways: '3/2' }, '12')).toEqual(['1'])
    expect(valveBlocked({ ways: '5/3', center: 'closed' }, '0')).toEqual(['1', '2', '3', '4', '5'])
  })
  it('monoestable vuelve con el muelle; biestable se queda (memoria); 5/3 al centro', () => {
    expect(valvePosition({ ways: '5/2' }, false, false, '14')).toBe('12')
    expect(valvePosition({ ways: '5/2', sol12: 'Y2' }, false, false, '14')).toBe('14')
    expect(valvePosition({ ways: '5/2', sol12: 'Y2' }, false, true, '14')).toBe('12')
    expect(valvePosition({ ways: '5/3', sol12: 'Y2' }, false, false, '14')).toBe('0')
  })
})

describe('neumática: electroválvula y cilindro', () => {
  it('con -Y1 el cilindro sale (a1) y sin ella vuelve (a0)', () => {
    const s = electro()
    let st = run(s, elecInit())
    expect(pos(st)).toBe(0)
    expect(st.view.pneuSignals).toEqual({ a0: 1, a1: 0 })
    expect(st.view.pneu.ports['A:B']).toBe('P')
    st = act(s, st, 'S1', 'toggle')
    expect(st.view.pneu.valves.V).toBe('14')
    st = run(s, st, 1.2)
    expect(pos(st)).toBe(1)
    expect(st.view.pneuSignals).toEqual({ a0: 0, a1: 1 })
    st = run(s, act(s, st, 'S1', 'toggle'), 1.2)
    expect(pos(st)).toBe(0)
  })
  it('el regulador de caudal frena el cilindro', () => {
    const s = electro()
    let st = act(s, run(s, elecInit()), 'R', 'toggle') // 100 % -> 25 %
    st = run(s, act(s, st, 'S1', 'toggle'), 1)
    expect(pos(st)).toBeGreaterThan(0.15)
    expect(pos(st)).toBeLessThan(0.35)
  })
  it('sin aire (unidad de mantenimiento cerrada) no se mueve', () => {
    const s = electro()
    let st = act(s, run(s, elecInit()), 'Z', 'toggle')
    st = run(s, act(s, st, 'S1', 'toggle'), 1)
    expect(pos(st)).toBe(0)
  })
  it('los detectores del cilindro accionan contactos del esquema (a1 enciende un piloto)', () => {
    const s = electro()
    s.components.push(c('B', 'limit', { tag: 'B1', signal: 'a1' }), c('H', 'lamp', { tag: 'H1' }))
    s.wires.push(w('Lp', 't1', 'B', '13'), w('B', '14', 'H', 'X1'), w('H', 'X2', 'M', 't1'))
    let st = run(s, act(s, run(s, elecInit()), 'S1', 'toggle'), 1.3)
    expect(st.view.loads.H).toBe(true)
  })
  it('biestable: un impulso en -Y1 sale y otro en -Y2 entra', () => {
    const s = electro({ sol12: 'Y2' })
    s.components.push(c('S2', 'pushbutton', { tag: 'S2' }), c('Y2', 'valve', { tag: 'Y2' }))
    s.wires.push(w('Lp', 't2', 'S2', '13'), w('S2', '14', 'Y2', 'A1'), w('Y2', 'A2', 'M', 't2'))
    let st = run(s, act(s, act(s, run(s, elecInit()), 'S1', 'toggle'), 'S1', 'toggle'), 1.2)
    expect(pos(st)).toBe(1) // se queda fuera sin la orden
    st = act(s, st, 'S2', 'press')
    st = run(s, act(s, st, 'S2', 'release'), 1.2)
    expect(pos(st)).toBe(0)
  })
})

describe('neumática: casos de diagnóstico', () => {
  const base = (cyl = {}, valve = {}) => ({
    components: [c('P', 'airsource'), c('V', 'pvalve', { ways: '3/2', manual: 'button', ...valve }), c('A', 'pcylinder', { tag: 'A', acting: 'single', time: 1, ...cyl })],
    wires: [w('P', '1', 'V', '1'), w('V', '2', 'A', 'A')],
  })
  it('simple efecto con 3/2 de pulsador: sale pulsando y vuelve con el muelle', () => {
    const s = base()
    let r = pneuStep(s, null, { manual: () => true }, 1)
    expect(r.view.cylinders.A.pos).toBe(1)
    r = pneuStep(s, r.state, { manual: () => false }, 1)
    expect(r.view.cylinders.A.pos).toBe(0)
  })
  it('doble efecto con aire atrapado en un lado no se mueve', () => {
    const s = {
      components: [c('P', 'airsource'), c('V', 'pvalve', { ways: '5/3', center: 'closed', sol14: 'Y1' }), c('A', 'pcylinder', { tag: 'A', time: 1 })],
      wires: [w('P', '1', 'V', '1'), w('V', '4', 'A', 'A'), w('V', '2', 'A', 'B')],
    }
    const r = pneuStep(s, { pos: { A: 0.5 } }, {}, 1)
    expect(r.view.cylinders.A.pos).toBe(0.5) // centro cerrado: se para a media carrera
    const r2 = pneuStep(s, r.state, { solenoids: new Set(['Y1']) }, 0.2)
    expect(r2.view.cylinders.A.pos).toBeCloseTo(0.7)
  })
  it('un tubo cortado deja sin aire al cilindro', () => {
    const s = base()
    const cut = s.wires[1].id
    const r = pneuStep(s, null, { manual: () => true, faults: { [cut]: 'cut' } }, 1)
    expect(r.view.cylinders.A.pos).toBe(0)
  })
})

describe('neumática: montaje «Cilindro con electroválvula 5/2»', () => {
  const tpl = ELEC_TEMPLATES.find((t) => t.id === 'electroneumatica')
  it('pulsando S1 sale A y a1 enciende H1; al soltar vuelve', () => {
    const s = insertTemplate(tpl)
    const id = (tag) => s.components.find((x) => x.tag === tag).id
    let st = act(s, run(s, elecInit()), id('S1'), 'press')
    st = run(s, st, 2.5) // regulador al 50 %: 2 s de carrera
    expect(pos(st, id('A'))).toBe(1)
    expect(st.view.loads[id('H1')]).toBe(true)
    st = run(s, act(s, st, id('S1'), 'release'), 1.2)
    expect(pos(st, id('A'))).toBe(0)
    expect(st.view.loads[id('H1')]).toBe(false)
  })
  it('insertado otra vez: cilindro B con b1, bobina -Y2 y válvula 1V3', () => {
    const first = insertTemplate(tpl)
    const second = insertTemplate(tpl, first)
    const tags = second.components.map((x) => x.tag)
    expect(tags).toContain('B')
    expect(second.components.find((x) => x.type === 'pvalve').sol14).toBe('Y2')
    expect(second.components.find((x) => x.type === 'limit').signal).toBe('b1')
    expect(second.components.find((x) => x.type === 'valve').tag).toBe('Y2')
  })
})

describe('neumática: ejemplo «Electroneumática A+ B+ A− B− con autómata»', () => {
  it('pulsando Marcha hace el ciclo entero por los cables, las válvulas y los detectores', async () => {
    const { EXAMPLES } = await import('../../src/lib/examples')
    const { normalizeProject } = await import('../../src/lib/projectFile')
    const { buildPlcModel } = await import('../../src/lib/plcModel')
    const { compile, evolve, initialState } = await import('../../src/lib/sim/engine')
    const { sceneAction } = await import('../../src/lib/sim/scene')
    const { advanceWorld, makeWorld } = await import('../../src/lib/sim/world')
    const project = normalizeProject(EXAMPLES.find((e) => e.id === 'electroneumatica').build())
    const elec = project.plc.electrical
    expect(elec.enabled).toBe(true)
    const valves = elec.components.filter((x) => x.type === 'pvalve')
    expect(valves.map((v) => [v.sol14, v.sol12].every(Boolean))).toEqual([true, true])
    const model = buildPlcModel(project.nodes, project.edges, project.plc)
    const compiled = compile(model)
    const scene = project.plc.scene
    const world = makeWorld(scene, () => null, elec, model.variables)
    let w = sceneAction(scene, world.init(), 'marcha', 'press')
    let inputs = world.inputs(w)
    let state = evolve(compiled, initialState(compiled), inputs, 0).state
    const seen = []
    let plantMax = 0
    const cyl = (tag) => elec.components.find((x) => x.type === 'pcylinder' && x.tag === tag).id
    for (let t = 0.1; t <= 8 + 1e-9; t += 0.1) {
      const r = advanceWorld(compiled, { state, inputs, world: w }, t, { world })
      ;({ state, inputs } = r)
      w = r.world
      if (t > 0.5) w = sceneAction(scene, w, 'marcha', 'release')
      const p = w.elec.view.pneu.cylinders
      const now = `${p[cyl('A')].pos > 0.98 ? 'A1' : 'A0'}${p[cyl('B')].pos > 0.98 ? 'B1' : 'B0'}`
      if (seen.at(-1) !== now) seen.push(now)
      plantMax = Math.max(plantMax, w.pos.A ?? 0)
    }
    expect(seen).toEqual(['A0B0', 'A1B0', 'A1B1', 'A0B1', 'A0B0'])
    // La planta se ha movido con los cilindros neumáticos.
    expect(plantMax).toBeGreaterThan(0.95)
    expect(w.pos.A).toBe(0)
  })
})

describe('neumática: montajes con dos bobinas', () => {
  it('biestable: S1 la saca y se queda; S2 la mete', () => {
    const s = insertTemplate(ELEC_TEMPLATES.find((t) => t.id === 'electroneumatica-biestable'))
    const id = (tag) => s.components.find((x) => x.tag === tag).id
    let st = act(s, act(s, run(s, elecInit()), id('S1'), 'press'), id('S1'), 'release')
    st = run(s, st, 2.5)
    expect(pos(st, id('A'))).toBe(1)
    st = act(s, act(s, st, id('S2'), 'press'), id('S2'), 'release')
    st = run(s, st, 1.5)
    expect(pos(st, id('A'))).toBe(0)
  })
  it('secuencia A+ B+ A− B− con finales de carrera', () => {
    const s = insertTemplate(ELEC_TEMPLATES.find((t) => t.id === 'secuencia-ab'))
    const id = (tag) => s.components.find((x) => x.tag === tag).id
    let st = act(s, run(s, elecInit()), id('S1'), 'press')
    const seen = []
    for (let i = 0; i < 160; i++) {
      st = run(s, st, 0.05)
      if (i === 10) st = act(s, st, id('S1'), 'release')
      const now = `${pos(st, id('A')) > 0.98 ? 'A1' : 'A0'}${pos(st, id('B')) > 0.98 ? 'B1' : 'B0'}`
      if (seen.at(-1) !== now) seen.push(now)
    }
    expect(seen).toEqual(['A0B0', 'A1B0', 'A1B1', 'A0B1', 'A0B0'])
  })
})
