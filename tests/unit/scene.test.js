import { describe, expect, it } from 'vitest'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { buildPlcModel } from '../../src/lib/plcModel'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { detectScene, measuredDistance, rotate, sceneAction, sceneFaults, sceneFromPlant, sceneInit, sceneInputNames, sceneInputs, sceneStep, worldRect } from '../../src/lib/sim/scene'
import { normalizeProject } from '../../src/lib/projectFile'
import { advanceWorld, makeWorld } from '../../src/lib/sim/world'
import { links, step, transition } from './helpers'

const run = (scene, state, values, seconds) => {
  let s = state
  for (let t = 0; t < seconds - 1e-9; t += 0.05) s = sceneStep(scene, s, values, 0.05)
  return s
}

describe('escena: geometría', () => {
  it('giros en sentido horario y rectángulos de la escena', () => {
    expect(rotate(10, 0, 90)).toEqual([-0, 10])
    expect(rotate(10, 0, 180)).toEqual([-10, -0])
    expect(worldRect({ x: 100, y: 100, rot: 90 }, 0, -15, 200, 30)).toEqual({ x: 85, y: 100, w: 30, h: 200 })
  })
})

describe('escena: elementos que interactúan', () => {
  // Cilindro horizontal en (100, 100), carrera 100 px: la placa llega a x = 280.
  const cylinder = { id: 'A', type: 'cylinder', x: 100, y: 100, rot: 0, extend: 'A+', retract: 'A-', stroke: 100, time: 1 }
  const front = { id: 'fc1', type: 'limit', x: 290, y: 100, rot: 0, variable: 'a1', contact: 'NO' } // la placa lo pisa fuera
  const back = { id: 'fc0', type: 'limit', x: 190, y: 100, rot: 0, variable: 'a0', contact: 'NO' } // y este, dentro

  it('el vástago pisa los finales de carrera colocados donde se quiera', () => {
    const scene = { elements: [cylinder, front, back] }
    let s = sceneInit(scene)
    expect(sceneInputs(scene, s)).toEqual({ a0: 1, a1: 0 }) // en reposo, la placa pisa fc0
    s = run(scene, s, { 'A+': 1 }, 0.5)
    expect(sceneInputs(scene, s)).toEqual({ a0: 0, a1: 0 }) // a medio camino
    s = run(scene, s, { 'A+': 1 }, 1)
    expect(sceneInputs(scene, s)).toEqual({ a0: 0, a1: 1 })
  })

  it('pulsadores NA/NC, interruptor y seta de emergencia (NC)', () => {
    const scene = {
      elements: [
        { id: 'm', type: 'button', variable: 'Marcha', contact: 'NO' },
        { id: 'p', type: 'button', variable: 'Paro', contact: 'NC' },
        { id: 'e', type: 'emergency', variable: 'Emerg' },
      ],
    }
    let s = sceneInit(scene)
    expect(sceneInputs(scene, s)).toEqual({ Marcha: 0, Paro: 1, Emerg: 1 })
    s = sceneAction(scene, s, 'm', 'press')
    s = sceneAction(scene, s, 'p', 'press')
    s = sceneAction(scene, s, 'e', 'toggle')
    expect(sceneInputs(scene, s)).toEqual({ Marcha: 1, Paro: 0, Emerg: 0 })
    expect([...sceneInputNames(scene)]).toEqual(['Marcha', 'Paro', 'Emerg'])
  })

  it('cinta: lleva las piezas del alimentador al detector y a la recogida', () => {
    const scene = {
      elements: [
        { id: 'f', type: 'feeder', x: 30, y: 100, rot: 0, auto: false, sizes: 'small' },
        { id: 'c', type: 'conveyor', x: 0, y: 100, rot: 0, motor: 'M', length: 300, time: 3 },
        { id: 's', type: 'sensor', x: 200, y: 140, rot: 270, variable: 'S', contact: 'NO', range: 60 }, // haz hacia arriba
        { id: 'r', type: 'sink', x: 330, y: 100, rot: 0 },
      ],
    }
    let s = sceneAction(scene, sceneInit(scene), 'f', 'feed')
    expect(s.pieces).toHaveLength(1)
    expect(sceneInputs(scene, s).S).toBe(0)
    s = run(scene, s, {}, 1) // motor parado: no se mueve
    expect(s.pieces[0].x).toBe(16)
    s = run(scene, s, { M: 1 }, 1.7) // 100 px/s: la pieza pasa por el haz en x ≈ 200
    expect(sceneInputs(scene, s).S).toBe(1)
    s = run(scene, s, { M: 1 }, 2)
    expect(s.pieces).toHaveLength(0)
    expect(s.counts.r).toBe(1)
  })

  it('el cilindro empuja las piezas que encuentra; la cinta no amontona piezas', () => {
    const pusher = { ...cylinder, y: 120 }
    const scene = { elements: [pusher] }
    let s = { ...sceneInit(scene), pieces: [{ id: 1, x: 200, y: 106, w: 28, h: 28 }] }
    s = run(scene, s, { 'A+': 1 }, 1.2)
    expect(s.pieces[0].x).toBe(288) // delante de la placa al final de la carrera (280 + 8)

    const belt = { elements: [{ id: 'c', type: 'conveyor', x: 0, y: 100, rot: 0, motor: 'M', length: 300, time: 3 }] }
    let b = { ...sceneInit(belt), pieces: [{ id: 1, x: 100, y: 86, w: 28, h: 28 }, { id: 2, x: 60, y: 86, w: 28, h: 28 }] }
    b = sceneStep(belt, b, { M: 1 }, 0.1)
    expect(b.pieces.map((p) => p.x)).toEqual([110, 70])
  })

  it('alimentador con orden: una pieza por cada flanco de subida', () => {
    const scene = { elements: [{ id: 'f', type: 'feeder', x: 50, y: 50, trigger: 'Soltar', sizes: 'mixed' }] }
    let s = sceneInit(scene)
    s = run(scene, s, { Soltar: 1 }, 0.5)
    expect(s.pieces.map((p) => p.w)).toEqual([28])
    s = { ...s, pieces: [] }
    s = run(scene, s, { Soltar: 0 }, 0.1)
    s = run(scene, s, { Soltar: 1 }, 0.1)
    expect(s.pieces.map((p) => p.w)).toEqual([44]) // tamaños alternos
  })
})

describe('escena en la simulación', () => {
  it('pulsador de la escena y cilindro con sus finales de carrera: el ciclo funciona solo', () => {
    const nodes = [
      step('s0', '0', 0, { initial: true }),
      transition('t1', 'Marcha · a0', 80),
      step('s1', '1', 120, { actions: ['A+'] }),
      transition('t2', 'a1', 200),
      step('s2', '2', 240, { actions: ['A-'] }),
      transition('t3', 'a0', 320),
    ]
    const compiled = compile(buildPlcModel(nodes, links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['t3', 's0']]), EMPTY_PLC))
    const scene = {
      elements: [
        { id: 'm', type: 'button', x: 0, y: 0, variable: 'Marcha', contact: 'NO' },
        { id: 'A', type: 'cylinder', x: 100, y: 100, rot: 0, extend: 'A+', retract: 'A-', retracted: 'a0', stroke: 100, time: 0.5 },
        { id: 'fc1', type: 'limit', x: 290, y: 100, rot: 0, variable: 'a1' },
      ],
    }
    const world = makeWorld(scene)
    let w = sceneAction(scene, world.init(), 'm', 'press')
    let inputs = world.inputs(w)
    let state = evolve(compiled, initialState(compiled), inputs, 0).state
    const seen = []
    for (let t = 0.1; t <= 2; t += 0.1) {
      const r = advanceWorld(compiled, { state, inputs, world: w }, t, { world })
      ;({ state, inputs } = r)
      w = t > 0.2 ? sceneAction(scene, r.world, 'm', 'release') : r.world
      const label = compiled.steps.find((s) => state.active.has(s.id)).label
      if (seen.at(-1) !== label) seen.push(label)
    }
    expect(seen).toEqual(['1', '2', '0'])
  })
})

describe('escena: depósito, averías, detección y proyectos antiguos', () => {
  it('depósito: sensores de nivel y nivel analógico en unidades físicas', () => {
    const scene = { elements: [{ id: 'd', type: 'tank', x: 0, y: 0, fill: 'EV1', drain: 'EV2', low: 'Nb', high: 'Na', level: 'Nivel', fillTime: 10, drainTime: 5 }] }
    const range = () => ({ min: 0, max: 2000 })
    let s = sceneInit(scene)
    expect(sceneInputs(scene, s, range)).toEqual({ Nb: 0, Na: 0, Nivel: 0 })
    s = run(scene, s, { EV1: 1 }, 5)
    expect(sceneInputs(scene, s, range)).toEqual({ Nb: 1, Na: 0, Nivel: 1000 })
    s = run(scene, s, { EV1: 1 }, 5)
    expect(sceneInputs(scene, s, range)).toEqual({ Nb: 1, Na: 1, Nivel: 2000 })
    s = run(scene, s, { EV2: 1 }, 5)
    expect(s.level.d).toBeCloseTo(0)
    expect([...sceneInputNames(scene)]).toEqual(['Nb', 'Na', 'Nivel'])
  })

  it('averías: cilindro atascado, detector roto y final de carrera roto', () => {
    const cyl = { id: 'A', type: 'cylinder', x: 0, y: 0, rot: 0, extend: 'A+', retracted: 'a0', extended: 'a1', stroke: 100, time: 1 }
    const fc = { id: 'f', type: 'limit', x: 190, y: 0, rot: 0, variable: 'fc' }
    const scene = { elements: [cyl, fc] }
    expect(sceneFaults(cyl).map((f) => f.label)).toEqual(['Atascado', 'Detector a0 roto', 'Detector a1 roto'])
    let s = sceneAction(scene, sceneInit(scene), 'A', 'fault:stuck')
    s = run(scene, s, { 'A+': 1 }, 2)
    expect(s.pos.A).toBe(0)
    s = sceneAction(scene, s, 'A', 'fault:sensor:extended')
    s = run(scene, s, { 'A+': 1 }, 2)
    expect(sceneInputs(scene, s)).toEqual({ a0: 0, a1: 0, fc: 1 }) // fuera, pero a1 no lo detecta
    s = sceneAction(scene, s, 'f', 'fault:broken')
    expect(sceneInputs(scene, s).fc).toBe(0)
    s = sceneAction(scene, sceneAction(scene, s, 'A', 'fault:'), 'f', 'fault:')
    expect(sceneInputs(scene, s)).toEqual({ a0: 0, a1: 1, fc: 1 })
  })

  it('detecta cilindros por los nombres (A+, A−, a0, a1) sin repetir los que ya hay', () => {
    const vars = ['A+', 'A-', 'a0', 'a1', 'B+', 'b1', 'Marcha'].map((name) => ({ name }))
    const found = detectScene(vars, { elements: [] })
    expect(found.map((e) => [e.text, e.extend, e.retract, e.retracted, e.extended])).toEqual([
      ['A', 'A+', 'A-', 'a0', 'a1'],
      ['B', 'B+', '', '', 'b1'], // simple efecto, sin detector dentro
    ])
    expect(detectScene(vars, { elements: [found[0]] }).map((e) => e.text)).toEqual(['B'])
  })

  it('los proyectos con la planta anterior (plc.plant) se abren con su escena', () => {
    const plant = [
      { id: 'A', type: 'cylinder', name: 'A', extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1', time: 1 },
      { id: 'C', type: 'conveyor', name: 'Cinta', motor: 'M', sensor: 'S', entry: '', time: 3 },
      { id: 'L', type: 'lamp', name: 'Luz', output: 'H1' },
    ]
    expect(sceneFromPlant(plant).elements.map((e) => e.type)).toEqual(['cylinder', 'conveyor', 'feeder', 'sensor', 'lamp'])
    const project = normalizeProject({ nodes: [], edges: [], plc: { plant } })
    expect(project.plc.plant).toBeUndefined()
    expect(project.plc.scene.elements).toHaveLength(5)
  })
})

describe('escena: detectores típicos y sensores analógicos', () => {
  // Cinta parada con dos piezas: una de plástico ámbar y otra de metal.
  const pieces = [
    { id: 1, x: 100, y: 86, w: 28, h: 28, color: 'amber', material: 'plastic' },
    { id: 2, x: 200, y: 86, w: 28, h: 28, color: 'metal', material: 'metal' },
  ]
  // Detector debajo de cada pieza, mirando hacia arriba.
  const under = (kind, x, extra = {}) => ({ id: `${kind}${x}`, type: 'sensor', x, y: 130, rot: 270, variable: `${kind}${x}`, kind, range: 30, ...extra })

  it('óptico y capacitivo ven todas las piezas; inductivo solo el metal; de color solo su color', () => {
    const elements = ['optical', 'capacitive', 'inductive', 'color'].flatMap((kind) => [under(kind, 114), under(kind, 214)])
    const scene = { elements }
    const inputs = sceneInputs(scene, { ...sceneInit(scene), pieces })
    expect(inputs).toEqual({
      optical114: 1, optical214: 1,
      capacitive114: 1, capacitive214: 1,
      inductive114: 0, inductive214: 1,
      color114: 1, color214: 0, // ámbar por defecto
    })
  })

  it('el alimentador alterna tamaño y material (todas las combinaciones)', () => {
    const scene = { elements: [{ id: 'f', type: 'feeder', x: 50, y: 50, sizes: 'mixed', material: 'mixed', color: 'red' }] }
    let s = sceneInit(scene)
    const made = []
    for (let i = 0; i < 4; i++) {
      s = sceneAction(scene, { ...s, pieces: [] }, 'f', 'feed')
      made.push(`${s.pieces[0].w}-${s.pieces[0].material}-${s.pieces[0].color}`)
    }
    expect(made).toEqual(['28-plastic-red', '44-plastic-red', '28-metal-metal', '44-metal-metal'])
  })

  it('sensor de distancia: valor analógico proporcional a la distancia al primer objeto', () => {
    const e = { id: 'd', type: 'distance', x: 0, y: 100, rot: 0, variable: 'Dist', range: 200 }
    const scene = { elements: [e] }
    const range = () => ({ min: 0, max: 1000 })
    let s = sceneInit(scene)
    expect(sceneInputs(scene, s, range)).toEqual({ Dist: 1000 }) // nada delante: el máximo
    s = { ...s, pieces: [{ id: 1, x: 62, y: 86, w: 28, h: 28 }, { id: 2, x: 150, y: 86, w: 28, h: 28 }] }
    expect(measuredDistance(scene, s, e)).toBe(50)
    expect(sceneInputs(scene, s, range)).toEqual({ Dist: 250 })
  })

  it('báscula: peso de las piezas que tiene encima (el metal pesa más)', () => {
    const scene = { elements: [{ id: 'b', type: 'scale', x: 100, y: 100, rot: 0, variable: 'Peso' }] }
    const s = { ...sceneInit(scene), pieces: [{ id: 1, x: 72, y: 70, w: 28, h: 28, material: 'plastic' }, { id: 2, x: 100, y: 62, w: 44, h: 44, material: 'metal' }] }
    expect(sceneInputs(scene, s)).toEqual({ Peso: 7 }) // 1 + 2·3
  })

  it('potenciómetro: valor manual dentro del rango de la variable', () => {
    const scene = { elements: [{ id: 'p', type: 'potentiometer', x: 0, y: 0, variable: 'Consigna', initial: 0.5 }] }
    const range = () => ({ min: 4, max: 20 })
    let s = sceneInit(scene)
    expect(sceneInputs(scene, s, range)).toEqual({ Consigna: 12 })
    s = sceneAction(scene, s, 'p', 'set:0.25')
    expect(sceneInputs(scene, s, range)).toEqual({ Consigna: 8 })
  })

  it('calentador: la temperatura sube con la resistencia y el termostato salta en la consigna', () => {
    const scene = { elements: [{ id: 'h', type: 'heater', x: 0, y: 0, heat: 'R', temperature: 'T', thermostat: 'TS', setpoint: 60, ambient: 20, maxTemp: 120, tau: 10 }] }
    let s = sceneInit(scene)
    expect(sceneInputs(scene, s)).toEqual({ T: 20, TS: 0 })
    s = run(scene, s, { R: 1 }, 10) // una constante de tiempo: 20 + 100·(1 − 1/e) ≈ 83 °C
    expect(sceneInputs(scene, s).T).toBeCloseTo(83.2, 0)
    expect(sceneInputs(scene, s).TS).toBe(1)
    s = run(scene, s, {}, 30)
    expect(sceneInputs(scene, s).T).toBeLessThan(25)
    s = sceneAction(scene, s, 'h', 'fault:stuck')
    s = run(scene, s, { R: 1 }, 10)
    expect(sceneInputs(scene, s).T).toBeLessThan(25) // resistencia fundida
  })

  it('posición analógica del cilindro y encoder del motor', () => {
    const scene = {
      elements: [
        { id: 'A', type: 'cylinder', x: 0, y: 0, rot: 0, extend: 'A+', position: 'PosA', stroke: 100, time: 1 },
        { id: 'm', type: 'motor', x: 0, y: 0, variable: 'M', pulses: 'Enc' },
      ],
    }
    const range = () => ({ min: 0, max: 100 })
    let s = run(scene, sceneInit(scene), { 'A+': 1, M: 1 }, 0.25)
    expect(sceneInputs(scene, s, range)).toEqual({ PosA: 25, Enc: 1 })
    s = run(scene, s, { 'A+': 1, M: 1 }, 0.5)
    expect(sceneInputs(scene, s, range)).toEqual({ PosA: 75, Enc: 0 })
  })
})

describe('escena: entradas y salidas de la planta', () => {
  it('qué está conectado, qué falta y qué no se usa', async () => {
    const { sceneIO } = await import('../../src/lib/sim/scene')
    const v = (name, type, uses = ['n1'], address = '') => ({ name, type, uses, address })
    const variables = [v('Marcha', 'input', ['n1'], 'I0.0'), v('Paro', 'input'), v('a1', 'input'), v('A+', 'output', ['n2'], 'Q0.0'), v('Luz', 'output'), v('Extra', 'input', [])]
    const scene = {
      elements: [
        { id: 'm', type: 'button', variable: 'Marcha' },
        { id: 'c', type: 'cylinder', extend: 'A+', extended: 'a1' },
        { id: 'x', type: 'sensor', variable: 'Extra' },
        { id: 'l', type: 'lamp', variable: '' }, // sin variable
        { id: 's', type: 'sink' }, // no la necesita
      ],
    }
    const io = sceneIO(scene, variables)
    expect(io.signals.map((s) => [s.name, s.dir, s.address, s.elements])).toEqual([
      ['A+', 'out', 'Q0.0', ['c']],
      ['a1', 'in', '', ['c']],
      ['Extra', 'in', '', ['x']],
      ['Marcha', 'in', 'I0.0', ['m']],
    ])
    expect(io.unassigned).toEqual(['l'])
    expect(io.manual).toEqual(['Paro']) // la escena no la da: se pulsa en el panel
    expect(io.unusedOutputs).toEqual(['Luz'])
    expect(io.notInGrafcet).toEqual(['Extra'])
  })
})

describe('escena: desviador y rampa', () => {
  // Cinta horizontal (x 0..300, y 85..115); desviador en x 150 que empuja hacia abajo (rot 90),
  // rampa bajo él que lleva las piezas a la derecha y una recogida al final.
  const belt = { id: 'c', type: 'conveyor', x: 0, y: 100, rot: 0, motor: 'M', length: 300, time: 3 }
  const diverter = { id: 'd', type: 'diverter', x: 150, y: 100, rot: 90, gate: 'D', length: 80, time: 0.5 }
  const piece = (x) => ({ id: 1, x, y: 86, w: 28, h: 28, color: 'amber', material: 'plastic' })

  it('inactivo, la pieza sigue por la cinta; activo, la saca de lado', () => {
    const scene = { elements: [belt, diverter] }
    let s = { ...sceneInit(scene), pieces: [piece(120)] }
    s = run(scene, s, { M: 1 }, 1)
    expect(s.pieces[0].y).toBe(86) // sigue en la cinta
    s = { ...sceneInit(scene), pieces: [piece(120)] }
    s = run(scene, s, { M: 1, D: 1 }, 1.5)
    expect(s.pieces[0].y).toBeGreaterThan(130) // fuera de la cinta, hacia abajo
  })

  it('la rampa lleva las piezas hasta su extremo y allí se quedan', () => {
    const ramp = { id: 'r', type: 'ramp', x: 0, y: 200, rot: 0, length: 120, time: 1 }
    const scene = { elements: [ramp] }
    let s = { ...sceneInit(scene), pieces: [{ id: 1, x: 0, y: 186, w: 28, h: 28 }] }
    s = run(scene, s, {}, 2)
    // El centro sale de la rampa al llegar al final (x = 120): ahí se para.
    expect(s.pieces[0].x + 14).toBeGreaterThan(119)
    expect(s.pieces[0].x + 14).toBeLessThan(130)
  })

  it('clasificadora: el detector inductivo manda el metal por el desviador a su recogida', () => {
    // Cinta más larga (x −200..300, 100 px/s) para que quepan dos piezas separadas.
    const longBelt = { ...belt, x: -200, length: 500, time: 5 }
    const scene = {
      elements: [
        longBelt,
        diverter,
        { id: 'ind', type: 'sensor', x: 110, y: 130, rot: 270, variable: 'Metal', kind: 'inductive', range: 20 },
        { id: 'rm', type: 'sink', x: 150, y: 200, rot: 0 }, // bajo el desviador
        { id: 'rp', type: 'sink', x: 320, y: 100, rot: 0 }, // al final de la cinta
      ],
    }
    const pieces = [
      { ...piece(40), id: 1, material: 'metal', color: 'metal' },
      { ...piece(-120), id: 2 },
    ]
    let s = { ...sceneInit(scene), pieces }
    let gate = 0
    // Lógica de la clasificadora: el desviador se activa mientras el inductivo ve metal y un poco después.
    for (let t = 0; t < 8; t += 0.05) {
      if (sceneInputs(scene, s).Metal) gate = 0.6
      s = sceneStep(scene, s, { M: 1, D: gate > 0 ? 1 : 0 }, 0.05)
      gate -= 0.05
    }
    expect(s.counts).toEqual({ rm: 1, rp: 1 }) // el metal por el desviador; el plástico, al final
  })
})
