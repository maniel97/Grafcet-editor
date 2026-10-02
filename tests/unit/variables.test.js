import { describe, expect, it } from 'vitest'
import { addressExpression, extractSymbols, parseExpression, projectVariables } from '../../src/lib/symbols'
import {
  EMPTY_PLC,
  addVariable,
  autoAssign,
  changeVariableType,
  deleteVariable,
  duplicatedAddresses,
  plcToCsv,
  renameVariable,
  validatePlc,
} from '../../src/lib/addressing'
import { buildPlcModel } from '../../src/lib/plcModel'
import { links, step, transition } from './helpers'

const nodes = [
  step('s0', '0', 0, { initial: true }),
  transition('t1', 'Marcha · !Paro', 100),
  step('s1', '1', 170, { actions: ['Motor ON', { text: 'A:=1', kind: 'stored-on' }, { text: 'Luz', kind: 'conditional', condition: 'Sensor' }] }),
  transition('t2', '5s/X1', 270),
  step('s2', '2', 340, { actions: [{ text: 'A:=0', kind: 'stored-off' }, { text: 'N:=N+1', kind: 'stored-on' }] }),
  transition('t3', 'Paro + N >= 3', 440),
]
const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's2'], ['s2', 't3'], ['t3', 's0']])
const steps = nodes.filter((n) => n.type === 'step')

describe('detección de variables', () => {
  it('expresiones: entradas, temporizaciones y numéricas', () => {
    const r = parseExpression('!a · ↑b + 5s/X2 AND t1 > 5s')
    expect(r.inputs).toEqual(['a', 'b', 't1'])
    expect(r.timers).toEqual([{ key: '5s/X2', preset: '5s', step: '2' }])
    expect([...r.numeric]).toEqual(['t1'])
  })

  it('tipos según el uso', () => {
    const found = extractSymbols(nodes)
    const summary = Object.fromEntries([...found].map(([k, v]) => [k, `${v.type}${v.numeric ? '#' : ''}`]))
    expect(summary).toEqual({
      Marcha: 'input',
      Paro: 'input',
      'Motor ON': 'output',
      A: 'memory',
      Luz: 'output',
      Sensor: 'input',
      '5s/X1': 'timer',
      N: 'memory#',
    })
  })

  it('una variable escrita por una acción deja de ser entrada', () => {
    const found = extractSymbols([transition('t', 'M', 0), step('s', '1', 100, { actions: [{ text: 'M:=1', kind: 'stored-on' }] })])
    expect(found.get('M').type).toBe('memory')
  })
})

describe('asignación de direcciones', () => {
  const symbols = extractSymbols(nodes)
  const plc = autoAssign(EMPTY_PLC, steps, symbols)

  it('etapas en marcas consecutivas desde M0.0', () => {
    expect(Object.values(plc.steps).map((s) => s.address)).toEqual(['M0.0', 'M0.1', 'M0.2'])
  })
  it('entradas, salidas, marcas (bit y palabra) y temporizadores', () => {
    const a = Object.fromEntries(Object.entries(plc.variables).map(([k, v]) => [k, v.address]))
    expect(a).toMatchObject({ Marcha: 'I0.0', Paro: 'I0.1', 'Motor ON': 'Q0.0', A: 'M10.0', '5s/X1': 'T1', N: 'MW100' })
  })
  it('formato IEC 61131-3', () => {
    const iec = autoAssign({ ...EMPTY_PLC, scheme: 'iec' }, steps, symbols)
    expect(iec.steps.s0.address).toBe('%MX0.0')
    expect(iec.variables.N.address).toBe('%MW100')
  })
  it('rellenar vacías respeta lo escrito a mano', () => {
    const manual = { ...plc, variables: { ...plc.variables, Marcha: { ...plc.variables.Marcha, address: 'I0.5' } } }
    const refilled = autoAssign(manual, [...steps, step('s3', '3', 600)], symbols)
    expect(refilled.variables.Marcha.address).toBe('I0.5')
    expect(refilled.steps.s3.address).toBe('M0.3')
  })
  it('cambiar de tipo reasigna una dirección libre del área nueva', () => {
    const changed = changeVariableType(plc, 'Sensor', 'memory', steps, symbols)
    expect(changed.variables.Sensor.address).toBe('M10.1')
    expect(changeVariableType(plc, 'Luz', 'output', steps, symbols).variables.Luz.address).toBe(plc.variables.Luz.address)
  })
  it('añadir, renombrar y borrar variables a mano', () => {
    const vars = () => projectVariables(nodes, current.variables)
    let current = plc
    const added = addVariable(current, 'input', steps, vars())
    current = added.plc
    expect(added.name).toBe('Entrada1')
    expect(current.variables.Entrada1.address).toBe('I0.3')
    expect(renameVariable(current, 'Entrada1', 'Marcha', vars())).toBe(null)
    const renamed = renameVariable(current, 'Entrada1', 'Emergencia', vars())
    expect(renamed.variables.Emergencia.address).toBe('I0.3')
    expect(deleteVariable(renamed, 'Emergencia').variables.Emergencia).toBeUndefined()
  })
  it('comprobaciones: duplicados y tipo incoherente', () => {
    const bad = { ...plc, variables: { ...plc.variables, Paro: { type: 'input', address: 'I0.0' }, Sensor: { type: 'input', address: 'Q0.3' } } }
    expect([...duplicatedAddresses(bad, steps, symbols)]).toEqual(['I0.0'])
    const issues = validatePlc(bad, steps, symbols).map((i) => i.severity)
    expect(issues).toEqual(expect.arrayContaining(['error', 'warning']))
  })
  it('CSV con separador ";"', () => {
    const csv = plcToCsv(plc, steps, symbols).split('\r\n')
    expect(csv[0]).toBe('Nombre;Tipo;Dirección;Preselección;Comentario')
    expect(csv).toContain('X0;Etapa;M0.0;;')
    expect(csv).toContain('5s/X1;Temporizador;T1;5s;')
  })
  it('receptividades con direcciones', () => {
    const lookup = { symbol: (n) => plc.variables[n]?.address, step: (l) => ({ 1: 'M0.1' })[l] }
    expect(addressExpression('Marcha · !Paro', lookup)).toBe('I0.0 · !I0.1')
    expect(addressExpression('5s/X1 + X1', lookup)).toBe('T1 + M0.1')
  })
})

describe('modelo para PLC', () => {
  it('transiciones con etapas anteriores, siguientes, entradas y temporizaciones', () => {
    const model = buildPlcModel(nodes, edges, autoAssign(EMPTY_PLC, steps, extractSymbols(nodes)))
    expect(model.transitions[1]).toMatchObject({ condition: '5s/X1', from: ['s1'], to: ['s2'], timers: ['5s/X1'] })
    expect(model.steps[1].actions.map((a) => `${a.kind}:${a.symbol}@${a.address}`)).toEqual([
      'continuous:Motor ON@Q0.0',
      'stored-on:A@M10.0',
      'conditional:Luz@Q0.1',
    ])
  })
})

describe('prefijo de las variables de etapa', () => {
  const symbols = extractSymbols(nodes)
  const plc = { ...autoAssign(EMPTY_PLC, steps, symbols), stepPrefix: 'E' }

  it('CSV y modelo para PLC con E', () => {
    expect(plcToCsv(plc, steps, symbols).split('\r\n')).toContain('E0;Etapa;M0.0;;')
    expect(buildPlcModel(nodes, edges, plc).steps.map((s) => s.variable)).toEqual(['E0', 'E1', 'E2'])
  })
  it('por defecto X (norma)', () => {
    expect(buildPlcModel(nodes, edges, EMPTY_PLC).steps[0].variable).toBe('X0')
  })
  it('error si una variable se llama igual que una variable de etapa', () => {
    const withE1 = [...nodes, transition('tE', 'E1', 600)]
    const issues = validatePlc(plc, steps, extractSymbols(withE1))
    expect(issues.some((i) => i.severity === 'error' && /«E1» se llama igual que la variable de la etapa 1/.test(i.message))).toBe(true)
    // Con X no hay choque.
    expect(validatePlc({ ...plc, stepPrefix: 'X' }, steps, extractSymbols(withE1)).some((i) => /se llama igual/.test(i.message))).toBe(false)
  })
})
