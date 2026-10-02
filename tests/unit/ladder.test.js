import { describe, expect, it } from 'vitest'
import { generateLadder } from '../../src/lib/ladder/generate'
import { toAWL, toStructuredText } from '../../src/lib/ladder/exportText'
import { autoAssign, EMPTY_PLC } from '../../src/lib/addressing'
import { projectVariables } from '../../src/lib/symbols'
import { links, step, transition } from './helpers'

const nodes = [
  step('s0', '0', 0, { initial: true }),
  transition('t1', '↑Marcha · !(Paro + Emergencia)', 100),
  step('s1', '1', 170, { actions: ['Motor', { text: 'N:=N+1', kind: 'stored-on' }, { text: 'Luz', kind: 'conditional', condition: 'Sensor' }] }),
  transition('t2', '3s/X1', 270),
  step('s2', '2', 340, { actions: ['Motor', 'Valvula'] }),
  step('s3', '3', 340, {}, 240),
  transition('t3', '↑(a · b) + N >= 3', 470),
]
const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['t2', 's3'], ['s2', 't3'], ['s3', 't3'], ['t3', 's0']])
const plc = autoAssign(EMPTY_PLC, nodes.filter((n) => n.type === 'step'), projectVariables(nodes, {}))
const ladder = generateLadder(nodes, edges, plc)

describe('paso a ladder', () => {
  it('secciones en el orden de ejecución', () => {
    expect(ladder.sections.map((s) => s.title)).toEqual([
      'Inicialización',
      'Auxiliares',
      'Condiciones de franqueo',
      'Desactivación de etapas',
      'Activación de etapas',
      'Temporizaciones',
      'Acciones memorizadas',
      'Salidas',
    ])
    expect(ladder.sections.flatMap((s) => s.rungs)).toHaveLength(16)
    expect(ladder.warnings).toEqual([])
  })

  it('marcas internas a partir de M20.0', () => {
    expect(Object.fromEntries(ladder.resolver.internal)).toEqual({
      Aux1: 'M20.0',
      FP_Marcha: 'M20.1',
      Tr1: 'M20.2',
      Tr2: 'M20.3',
      FP_Aux1: 'M20.4',
      Tr3: 'M20.5',
    })
  })

  it('salida con todas sus etapas en paralelo', () => {
    const motor = ladder.sections.find((s) => s.id === 'outputs').rungs[0]
    expect(motor.comment).toBe('Salida Motor: X1 + X2')
    expect(motor.network.type).toBe('parallel')
  })
})

describe('texto estructurado', () => {
  const st = toStructuredText(ladder, plc)
  it.each([
    'Tr1 := X0 AND RT_Marcha.Q AND NOT Paro AND NOT Emergencia;',
    'Tr3 := X2 AND X3 AND (RT_Aux1.Q OR (N >= 3));',
    'TON_3s_X1(IN := X1, PT := T#3000MS);',
    'Motor := (X1 OR X2);',
    'N : INT;   (* MW100 *)',
  ])('contiene «%s»', (line) => expect(st).toContain(line))
})

describe('AWL de S7', () => {
  it('nemotécnica alemana con direcciones', () => {
    const awl = toAWL(ladder, { mnemonic: 'de' })
    for (const line of ['U M0.0', 'FP M20.1', 'UN I0.1', 'L S5T#3S', 'SE T1', 'SPBN M001', 'L MW100', '>=I', 'T MW100']) {
      expect(awl).toContain(line)
    }
  })
  it('nemotécnica inglesa con símbolos', () => {
    const awl = toAWL(ladder, { mnemonic: 'en', useAddresses: false })
    expect(awl).toContain('A "X0"')
    expect(awl).toContain('JCN M001')
    expect(awl).toContain('SD "T1"')
  })
})

describe('variables de etapa con prefijo E (E1 en vez de X1)', () => {
  const plcE = { ...plc, stepPrefix: 'E' }
  const ladderE = generateLadder(nodes, edges, plcE)

  it('ladder: nombres y comentarios con E; las receptividades siguen con X (norma)', () => {
    expect(ladderE.resolver.name({ kind: 'step', label: '1' })).toBe('E1')
    const comments = ladderE.sections.flatMap((s) => s.rungs.map((r) => r.comment)).join('\n')
    expect(comments).toContain('Tr2: E1 · «3s/X1»  →  E2, E3')
    expect(comments).toContain('Salida Motor: E1 + E2')
    expect(comments).not.toMatch(/\bX0\b/)
  })
  it('ST y AWL con E', () => {
    const st = toStructuredText(ladderE, plcE)
    expect(st).toContain('E0 : BOOL;   (* M0.0 *)')
    expect(st).toContain('Tr1 := E0 AND RT_Marcha.Q')
    expect(toAWL(ladderE, { mnemonic: 'de', useAddresses: false })).toContain('U "E0"')
  })
})
