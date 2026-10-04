import { describe, expect, it } from 'vitest'
import { rawRange, toRaw } from '../../src/lib/analog'
import { extractSymbols } from '../../src/lib/symbols'
import { generateLadder } from '../../src/lib/ladder/generate'
import { toAWL, toStructuredText } from '../../src/lib/ladder/exportText'
import { createCpu, parseProgram } from '../../src/lib/plc/s7200cpu'
import { EXAMPLES } from '../../src/lib/examples'
import { normalizeProject } from '../../src/lib/projectFile'
import { toS7200 } from '../../src/lib/ladder/exportS7200'
import { autoAssign, EMPTY_PLC } from '../../src/lib/addressing'
import { projectVariables } from '../../src/lib/symbols'
import { links, step, transition } from './helpers'

describe('escalado de analógicas', () => {
  it('valor bruto según señal y autómata', () => {
    expect(rawRange('4-20mA', 's7200')).toEqual([6400, 32000])
    expect(rawRange('0-10V', 's7200')).toEqual([0, 32000])
    expect(rawRange('4-20mA', 'siemens')).toEqual([0, 27648])
    const temp = { signal: '4-20mA', min: 0, max: 100 }
    expect(toRaw(60, temp, 's7200')).toBe(6400 + 0.6 * 25600) // 21760
    expect(toRaw(0, temp, 's7200')).toBe(6400)
    expect(toRaw(150, temp, 's7200')).toBe(32000) // fuera de rango: se recorta
    expect(toRaw(2.5, { signal: '0-10V', min: 0, max: 5 }, 'siemens')).toBe(13824)
  })
  it('una entrada comparada con números es analógica', () => {
    const symbols = extractSymbols([transition('t', 'Temperatura > 60 · Marcha', 0)])
    expect(symbols.get('Temperatura').type).toBe('analogIn')
    expect(symbols.get('Marcha').type).toBe('input')
  })
})

// 0 -Marcha-> 1 (Calentar) -Temperatura >= 60-> 2 (Velocidad := 50 al activarse) -Temperatura < 30-> 0
const nodes = [
  step('s0', '0', 0, { initial: true }),
  transition('t1', 'Marcha', 100),
  step('s1', '1', 200, { actions: ['Calentar'] }),
  transition('t2', 'Temperatura >= 60', 300),
  step('s2', '2', 400, { actions: [{ text: 'Velocidad:=50', kind: 'stored-on' }] }),
  transition('t3', 'Temperatura < 30', 500),
]
const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['t3', 's0']])

describe('umbrales precalculados en el programa', () => {
  const symbols = projectVariables(nodes, {})
  const base = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, nodes.filter((n) => n.type === 'step'), symbols)
  const plc = {
    ...base,
    variables: {
      ...base.variables,
      Temperatura: { ...base.variables.Temperatura, signal: '4-20mA', min: 0, max: 100 },
      Velocidad: { ...base.variables.Velocidad, type: 'analogOut', signal: '0-10V', min: 0, max: 100, address: 'AQW0' },
    },
  }
  const ladder = generateLadder(nodes, edges, plc)
  it('direcciones AIW y comparaciones en bruto (S7-200)', () => {
    expect(plc.variables.Temperatura.address).toBe('AIW0')
    const { text } = toS7200(ladder, plc)
    expect(text).toContain('AW>=   AIW0, +21760') // 60 °C con 4–20 mA (en serie con la etapa)
    expect(text).toContain('AW<    AIW0, +14080') // 30 °C
    expect(text).toContain('MOVW   +16000, VW900') // Velocidad := 50 % con 0–10 V
    expect(text).toContain('MOVW   VW900, AQW0')
    expect(ladder.warnings).toEqual([])
  })
  it('también en el ST (los umbrales en bruto, la receptividad física en el comentario)', () => {
    const st = toStructuredText(ladder, plc)
    expect(st).toContain('(Temperatura >= 21760)')
    expect(st).toContain('«Temperatura >= 60»')
  })
})

// Escalado en el autómata (C2): calcular con analógicas y compararlas entre sí, en REAL.
describe('escalado en el autómata', () => {
  const symbols = projectVariables(nodes, {})
  const base = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, nodes.filter((n) => n.type === 'step'), symbols)
  const plc = {
    ...base,
    variables: {
      ...base.variables,
      Temperatura: { ...base.variables.Temperatura, signal: '4-20mA', min: 0, max: 100 },
      Velocidad: { ...base.variables.Velocidad, type: 'analogOut', signal: '0-10V', min: 0, max: 100, address: 'AQW0' },
    },
  }
  // Paso 2: Velocidad := Temperatura / 2 (un cálculo con una analógica hacia una salida analógica).
  const calc = nodes.map((n) => (n.id === 's2' ? step('s2', '2', 400, { actions: [{ text: 'Velocidad:=Temperatura/2', kind: 'stored-on' }] }) : n))
  const ladder = generateLadder(calc, edges, plc)
  const run = (text, scans) => {
    const { blocks, errors } = parseProgram(text)
    expect(errors).toEqual([])
    const cpu = createCpu({ blocks })
    for (const f of scans) {
      f(cpu)
      for (let i = 0; i < 5; i++) cpu.scan(0.01)
    }
    return cpu
  }

  it('sin avisos: se calcula en REAL', () => {
    expect(ladder.warnings).toEqual([])
  })
  it('ST: pasa a REAL, calcula en unidades físicas y vuelve a valor bruto recortado', () => {
    const st = toStructuredText(ladder, plc)
    expect(st).toContain('INT_TO_REAL(Temperatura)')
    expect(st).toMatch(/Velocidad := REAL_TO_INT\(LIMIT\(0\.0, .*, 32000\.0\)\);/)
  })
  it('AWL S7-300: ITD, DTR, operaciones R y RND', () => {
    const awl = toAWL(ladder, { mnemonic: 'en' })
    for (const ins of ['ITD', 'DTR', '/R', '*R', 'RND', '>R', '<R']) expect(awl).toContain(ins)
    expect(awl).toContain('de tipo REAL: #RealOut')
  })
  it('S7-200: el programa generado calcula la salida en la CPU simulada', () => {
    const { text } = toS7200(ladder, plc)
    expect(text).toContain('ITD    AIW0, VD940')
    expect(text).toContain('DTI    VD940, AQW0')
    const marcha = plc.variables.Marcha.address
    const cpu = run(text, [
      () => {},
      (c) => c.bits.set(marcha, true),
      (c) => c.words.set('AIW0', toRaw(60, plc.variables.Temperatura, 's7200')),
    ])
    // 60 °C / 2 = 30 % de 0–10 V -> 9600 de 32000.
    expect(cpu.words.get('AQW0')).toBe(9600)
  })
  it('S7-200: comparar dos analógicas de distinta escala (Nivel > Consigna)', () => {
    const n2 = [
      step('s0', '0', 0, { initial: true }),
      transition('t1', 'Nivel > Consigna', 100),
      step('s1', '1', 200, { actions: ['Bomba'] }),
      transition('t2', 'Nivel < 10', 300),
    ]
    const e2 = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']])
    const b2 = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, n2.filter((n) => n.type === 'step'), projectVariables(n2, {}))
    const p2 = {
      ...b2,
      variables: {
        ...b2.variables,
        Nivel: { ...b2.variables.Nivel, type: 'analogIn', signal: '4-20mA', min: 0, max: 100, address: 'AIW0' },
        Consigna: { ...b2.variables.Consigna, type: 'analogIn', signal: '0-10V', min: 0, max: 50, address: 'AIW2' },
      },
    }
    const l2 = generateLadder(n2, e2, p2)
    expect(l2.warnings).toEqual([])
    const { text } = toS7200(l2, p2)
    expect(text).toMatch(/LDR>\s+VD960, VD964|AR>\s+VD960, VD964/)
    const bomba = p2.variables.Bomba.address
    const level = (v) => (c) => c.words.set('AIW0', toRaw(v, p2.variables.Nivel, 's7200'))
    const setpoint = (c) => c.words.set('AIW2', toRaw(30, p2.variables.Consigna, 's7200'))
    // Consigna 30 (de 0–50): con Nivel 25 no arranca; con 40, sí.
    expect(run(text, [setpoint, level(25)]).bits.get(bomba)).toBeFalsy()
    expect(run(text, [setpoint, level(40)]).bits.get(bomba)).toBe(true)
    expect(toStructuredText(l2, p2)).toMatch(/\(\(\(INT_TO_REAL\(Nivel\) - 6400\.0\) \* 0\.00390625\) > \(INT_TO_REAL\(Consigna\) \* 0\.0015625\)\)/)
  })
})

// Todos los ejemplos: su programa S7-200 (con el escalado REAL donde lo hay) lo entiende la CPU
// simulada sin errores y corre unos ciclos.
describe('programa S7-200 de cada ejemplo en la CPU simulada', () => {
  for (const ex of EXAMPLES) {
    it(ex.id, () => {
      const project = normalizeProject(ex.build())
      const ladder = generateLadder(project.nodes, project.edges, project.plc)
      const { text } = toS7200(ladder, project.plc)
      const { blocks, errors } = parseProgram(text)
      expect(errors.map((e) => e.message)).toEqual([])
      const cpu = createCpu({ blocks })
      for (let i = 0; i < 20; i++) cpu.scan(0.05)
    })
  }
  it('los ejemplos que comparan dos analógicas lo hacen en REAL', () => {
    for (const id of ['dosificacion-peso']) {
      const project = normalizeProject(EXAMPLES.find((e) => e.id === id).build())
      const { text } = toS7200(generateLadder(project.nodes, project.edges, project.plc), project.plc)
      expect(text, id).toMatch(/LDR>=|AR>=|OR>=/)
    }
  })
})
