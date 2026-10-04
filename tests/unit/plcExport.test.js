import { describe, expect, it } from 'vitest'
import { generateLadder } from '../../src/lib/ladder/generate'
import { toAWL, toStructuredText } from '../../src/lib/ladder/exportText'
import { autoAssign, EMPTY_PLC } from '../../src/lib/addressing'
import { projectVariables } from '../../src/lib/symbols'
import { links, step, transition } from './helpers'

const FORMULAS = {
  R: '(A + B) * (D - 1)',
  Q: 'A - (B - C)',
  S: '(C - B) / (A - (D + 1))',
  U: '((A + B) * (C - D)) - ((A - D) * (B + 2))',
}
const VALUES = { A: 7, B: 3, C: 20, D: 2 }
// Lo que debe dar cada fórmula (división entera de S7, truncando hacia cero).
const EXPECTED = { R: 10, Q: 24, S: 4, U: 155 } // S: 17 / 4 = 4,25 -> 4

// Receptividades sin comparar A–D con números (si no, serían entradas analógicas y se calcularía en REAL).
const nodes = [
  step('s0', '0', 0, { initial: true, actions: Object.entries(FORMULAS).map(([v, f]) => ({ text: `${v}:=${f}`, kind: 'stored-on' })) }),
  transition('t1', 'Marcha', 100),
  step('s1', '1', 200),
  transition('t2', 'Paro', 300),
]
const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']])
const plc = autoAssign(EMPTY_PLC, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}))
const ladder = generateLadder(nodes, edges, plc)

// Intérprete mínimo de los acumuladores de S7 (L, T, TAK, +I, -I, *I, /I).
function runAccumulators(code, memory) {
  let accu1 = 0
  let accu2 = 0
  const load = (x) => (/^-?\d+$/.test(x) ? Number(x) : memory[x.replace(/"/g, '')])
  for (const line of code) {
    const [op, arg] = line.trim().split(/\s+/)
    if (op === 'L') [accu2, accu1] = [accu1, load(arg)]
    else if (op === 'T') memory[arg.replace(/"/g, '')] = accu1
    else if (op === 'TAK') [accu1, accu2] = [accu2, accu1]
    else if (op === '+I') accu1 = accu2 + accu1
    else if (op === '-I') accu1 = accu2 - accu1
    else if (op === '*I') accu1 = accu2 * accu1
    else if (op === '/I') accu1 = Math.trunc(accu2 / accu1)
  }
  return memory
}

describe('AWL: asignaciones aritméticas anidadas (sin «REVISAR»)', () => {
  const awl = toAWL(ladder, { mnemonic: 'de', useAddresses: false })
  const lines = awl.split('\r\n')

  it('ninguna queda sin traducir y se declaran las temporales necesarias', () => {
    expect(awl).not.toContain('REVISAR')
    expect(awl).toContain('// Variables temporales (TEMP) del bloque, de tipo INT: #Arit1, #Arit2.')
  })

  it.each(Object.keys(FORMULAS))('%s calcula lo mismo que la fórmula', (target) => {
    const start = lines.findIndex((l) => l.trim() === `// ${target} := ${FORMULAS[target].replace(/\s/g, '')}` || l.trim().startsWith(`// ${target} :=`))
    expect(start).toBeGreaterThan(-1)
    const end = lines.findIndex((l, i) => i > start && l.trim() === `T "${target}"`)
    const code = lines.slice(start + 2, end + 1) // tras el comentario y el salto condicional
    const memory = runAccumulators(code, { ...VALUES })
    expect(memory[target]).toBe(EXPECTED[target])
  })
})

describe('SCL para TIA Portal', () => {
  const nodes2 = [
    step('s0', '0', 0, { initial: true }),
    transition('t1', '↑Marcha · !Paro', 100),
    step('s1', '1', 200, { actions: ['Motor'] }),
    transition('t2', '5s/X1 + Paro', 300),
  ]
  const edges2 = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']])
  const vars = projectVariables(nodes2, {})
  const plc2 = autoAssign(EMPTY_PLC, nodes2.filter((n) => n.type === 'step'), vars)
  const scl = toStructuredText(generateLadder(nodes2, edges2, plc2), plc2, { dialect: 'tia' })

  it('bloque de función importable: cabecera, interfaz y cierre', () => {
    expect(scl).toContain('FUNCTION_BLOCK "Grafcet"')
    expect(scl).toContain("{ S7_Optimized_Access := 'TRUE' }")
    expect(scl).toMatch(/VAR_INPUT\r\n {4}\(\* Entradas \*\)\r\n {4}Marcha : Bool;/)
    expect(scl).toMatch(/VAR_OUTPUT\r\n {4}\(\* Salidas \*\)\r\n {4}Motor : Bool;/)
    expect(scl).toContain('TON_5s_X1 : TON_TIME;')
    expect(scl).toContain('RT_Marcha : R_TRIG;')
    expect(scl.trim().endsWith('END_FUNCTION_BLOCK')).toBe(true)
    expect(scl).toContain('"Grafcet_DB"(Marcha := "Marcha", Paro := "Paro", Motor => "Motor");')
  })

  it('variables locales con #', () => {
    expect(scl).toContain('#PrimerCiclo := NOT #Init;')
    expect(scl).toContain('#RT_Marcha(CLK := #Marcha);')
    expect(scl).toMatch(/#TON_5s_X1\(IN := #X1, PT := T#5000MS\);/)
    expect(scl).not.toMatch(/[^#"\w]X1 :=/)
  })

  it('el ST genérico no cambia de forma', () => {
    const st = toStructuredText(generateLadder(nodes2, edges2, plc2), plc2)
    expect(st).toContain('PROGRAM Grafcet')
    expect(st).not.toMatch(/#[A-Za-z_]/) // (T#5000MS sí lleva #)
  })
})
