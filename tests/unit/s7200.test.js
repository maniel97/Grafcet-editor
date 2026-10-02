import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { generateLadder } from '../../src/lib/ladder/generate'
import { encodeAnsi, s7200Symbols, symbolName, timerBase, toS7200 } from '../../src/lib/ladder/exportS7200'
import { autoAssign, EMPTY_PLC } from '../../src/lib/addressing'
import { projectVariables } from '../../src/lib/symbols'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState, withMacros } from '../../src/lib/sim/engine'

const CRLF = '\r\n'

// CPU S7-200 mínima: ejecuta el STL generado ciclo a ciclo (pila lógica, S/R, flancos, TON, palabras).
function cpu(text) {
  const lines = text.split(CRLF)
  const start = lines.indexOf('BEGIN') + 1
  const end = lines.indexOf('END_ORGANIZATION_BLOCK')
  const program = lines.slice(start, end).filter((l) => l && !l.startsWith('//'))
  const bits = new Map()
  const words = new Map()
  const timers = new Map()
  const edges = new Map()
  let first = true
  const bit = (a) => (a === 'SM0.0' ? true : a === 'SM0.1' ? first : /^T\d+$/.test(a) ? !!timers.get(a)?.q : !!bits.get(a))
  const word = (a) => (/^[+-]?\d+$/.test(a) ? Number(a) : (words.get(a) ?? 0))
  const cmp = (op, a, b) => ({ '>': a > b, '<': a < b, '>=': a >= b, '<=': a <= b, '=': a === b, '<>': a !== b })[op]
  const scan = (dt) => {
    let stack = []
    program.forEach((line, pc) => {
      if (line.startsWith('Network')) {
        stack = []
        return
      }
      const op = line.slice(0, 6).trim()
      const args = line
        .slice(7)
        .split(',')
        .map((x) => x.trim())
      const top = () => stack[stack.length - 1]
      const setTop = (v) => (stack[stack.length - 1] = v)
      let m
      if (op === 'LD') stack.push(bit(args[0]))
      else if (op === 'LDN') stack.push(!bit(args[0]))
      else if (op === 'A') setTop(top() && bit(args[0]))
      else if (op === 'AN') setTop(top() && !bit(args[0]))
      else if (op === 'O') setTop(top() || bit(args[0]))
      else if (op === 'ON') setTop(top() || !bit(args[0]))
      else if (op === 'ALD') {
        const a = stack.pop()
        setTop(top() && a)
      } else if (op === 'OLD') {
        const a = stack.pop()
        setTop(top() || a)
      } else if (op === 'NOT') setTop(!top())
      else if (op === 'EU' || op === 'ED') {
        const now = top()
        const before = edges.get(pc) ?? false
        edges.set(pc, now)
        setTop(op === 'EU' ? now && !before : !now && before)
      } else if ((m = /^(LDW|AW|OW)(.+)$/.exec(op))) {
        const v = cmp(m[2], word(args[0]), word(args[1]))
        if (m[1] === 'LDW') stack.push(v)
        else setTop(m[1] === 'AW' ? top() && v : top() || v)
      } else if (op === '=') bits.set(args[0], top())
      else if (op === 'S') {
        if (top()) bits.set(args[0], true)
      } else if (op === 'R') {
        if (top()) bits.set(args[0], false)
      } else if (op === 'TON') {
        const t = timers.get(args[0]) ?? { acc: 0, q: false }
        const base = timerBase(Number(args[0].slice(1)))
        if (top()) t.acc += dt
        else t.acc = 0
        t.q = top() && t.acc >= Number(args[1]) * base - 1e-9
        timers.set(args[0], t)
      } else if (op === 'MOVW') {
        if (top()) words.set(args[1], word(args[0]))
      } else if (['+I', '-I', '*I', '/I'].includes(op)) {
        if (top()) {
          const a = word(args[1])
          const b = word(args[0])
          words.set(args[1], op === '+I' ? a + b : op === '-I' ? a - b : op === '*I' ? a * b : Math.trunc(a / b))
        }
      } else throw new Error(`Instrucción no soportada en la prueba: ${line}`)
    })
    first = false
  }
  return { scan, bits, words }
}

// Compara simulador y CPU con la misma secuencia de entradas: [instante, {entradas}].
function compare(example, sequence) {
  const { nodes, edges } = example.build()
  const plc = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}))
  const ladder = generateLadder(nodes, edges, plc)
  const { text, addressOf } = toS7200(ladder, plc)
  const c = compile(buildPlcModel(nodes, edges, plc))
  let state = evolve(c, initialState(c), {}, 0).state
  const plc200 = cpu(text)
  const stepAddress = new Map(c.steps.map((s) => [s.id, addressOf({ kind: 'step', label: s.label })]))
  let last = 0
  const out = []
  for (const [t, inputs] of sequence) {
    state = evolve(c, state, inputs, t).state
    // Pasa el tiempo hasta t con las entradas anteriores, en ciclos de 10 ms como un autómata real…
    for (let i = 0; i < Math.round((t - last) / 0.01); i++) plc200.scan(0.01)
    // …y en t cambian las entradas (unos ciclos más: un franqueo por ciclo en la evolución fugaz).
    for (const [name, v] of Object.entries(inputs)) plc200.bits.set(addressOf({ kind: 'var', name }), !!v)
    for (let i = 0; i < 12; i++) plc200.scan(0)
    last = t
    const sim = [...withMacros(c, state.active)].map((id) => c.steps.find((s) => s.id === id).label).sort().join(',')
    const real = c.steps.filter((s) => plc200.bits.get(stepAddress.get(s.id))).map((s) => s.label).sort().join(',')
    out.push([t, sim, real])
  }
  return out
}
const ex = (id) => EXAMPLES.find((e) => e.id === id)

describe('STL de S7-200 (Micro/WIN): mismo comportamiento que la simulación', () => {
  it.each([
    ['taladradora', [[0, {}], [0.1, { Marcha: 1, Pieza: 1 }], [1, { Fc_abajo: 1 }], [2.5, { Fc_abajo: 1 }], [3.2, { Fc_abajo: 1 }], [4, { Marcha: 0, Pieza: 0, Fc_abajo: 0, Fc_arriba: 1 }]]],
    ['mezcladora', [[0, {}], [1, { Marcha: 1 }], [2, { Nivel_A: 1 }], [3, { Nivel_A: 1, Nivel_B: 1 }], [33.5, {}], [34, { Marcha: 0, Nivel_A: 0, Nivel_B: 0, Vacio: 1 }], [35, { Vacio: 0, Limpieza: 1 }], [36, { Limpieza: 0, Fin_lavado: 1 }]]],
    ['emergencia', [[0, {}], [1, { Marcha: 1 }], [2, { Marcha: 0, Emergencia: 1 }], [3, { Emergencia: 1, Fc_delante: 1 }], [4, { Emergencia: 0, Fc_delante: 0, Rearme: 1 }]]],
    ['macroetapa', [[0, {}], [1, { Marcha: 1 }], [2, { Marcha: 0, Retirar: 1 }], [3, { Retirar: 0, Nivel: 1 }], [24, { Nivel: 0 }], [25, { Retirar: 1 }]]],
  ])('%s', (id, sequence) => {
    for (const [t, sim, real] of compare(ex(id), sequence)) expect(`${t}: ${real}`).toBe(`${t}: ${sim}`)
  })
})

describe('formato del archivo', () => {
  const { nodes, edges } = ex('taladradora').build()
  const plc = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}))
  const ladder = generateLadder(nodes, edges, plc)
  const { text, addressOf } = toS7200(ladder, plc, { title: 'Taladradora' })
  it('bloques de Micro/WIN, primer ciclo SM0.1, etapas en V y TON de 100 ms', () => {
    expect(text.startsWith(`ORGANIZATION_BLOCK MAIN:OB1${CRLF}TITLE=Taladradora · Generado por Grafcet Editor`)).toBe(true)
    expect(text).toContain(`END_ORGANIZATION_BLOCK${CRLF}SUBROUTINE_BLOCK SBR_0:SBR0`)
    expect(text).toContain('LD     SM0.1')
    expect(text).toContain('S      V0.0, 1')
    expect(text).toMatch(/TON {4}T37, \+20/) // 2 s con base de 100 ms
    expect(text).toMatch(/^Network 1 \/\/ /m)
  })
  it('tabla de símbolos para pegar (tabuladores) y nombres válidos', () => {
    const table = s7200Symbols(ladder, plc, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}), addressOf)
    expect(table.split(CRLF)).toContain('X0\tV0.0\tEtapa 0')
    expect(table).toContain('Marcha\tI0.0\t')
    expect(table).toContain('T_2s_X2\tT37\t')
    expect(symbolName('Válvula nº 1 (A+)')).toBe('Valvula_n__1__A__')
    expect(symbolName('un_nombre_muy_largo_de_mas_de_23')).toHaveLength(23)
  })
  it('archivo en ANSI (Windows-1252)', () => {
    expect([...encodeAnsi('Válvula · ↑a')]).toEqual([86, 0xe1, 108, 118, 117, 108, 97, 32, 0xb7, 32, 94, 97])
  })
})

describe('STL de S7-200: contador, comparación y flanco de una expresión', () => {
  it('cuenta 3 ciclos y sale por N >= 3 o por ↑(a · b)', async () => {
    const { links, step, transition } = await import('./helpers')
    const nodes = [
      step('s0', '0', 0, { initial: true }),
      transition('t1', 'm', 100),
      step('s1', '1', 200, { actions: [{ text: 'N:=N+1', kind: 'stored-on' }, 'Luz'] }),
      transition('t2', '↑(a · b) + N >= 3', 300),
      step('s2', '2', 400),
      transition('t3', '!m', 500),
    ]
    const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['t3', 's0']])
    const example = { build: () => ({ nodes, edges }) }
    const out = compare(example, [
      [0, {}],
      [1, { m: 1 }], // N = 1
      [2, { a: 1 }],
      [3, { a: 1, b: 1 }], // flanco de a·b: sale
      [4, { m: 0, a: 0, b: 0 }],
      [5, { m: 1 }], // N = 2
      [6, { m: 0 }],
    ])
    for (const [t, sim, real] of out) expect(`${t}: ${real}`).toBe(`${t}: ${sim}`)
  })
})

describe('STL de S7-200 con un proyecto en otro formato de direcciones', () => {
  it('el primer ciclo es SM0.1 aunque el proyecto use direcciones de S7-300', () => {
    const { nodes, edges } = ex('taladradora').build()
    const plc = autoAssign(EMPTY_PLC, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}))
    const { text } = toS7200(generateLadder(nodes, edges, plc), plc)
    expect(text).toContain('LD     SM0.1')
  })
})
