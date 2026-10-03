import { describe, expect, it } from 'vitest'
import { createCpu, parseProgram } from '../../src/lib/plc/s7200cpu'
import { advanceCpu, makeCpuRunner } from '../../src/lib/plc/cpuRun'
import { makeWorld } from '../../src/lib/sim/world'
import { sceneAction } from '../../src/lib/sim/scene'

const run = (text, resolve) => {
  const { blocks, errors } = parseProgram(text, resolve)
  if (errors.length) throw errors[0]
  return createCpu({ blocks })
}

describe('CPU S7-200 simulada', () => {
  it('formato de exportación de Micro/WIN, pila lógica (LPS/LRD/LPP) y S con varios bits', () => {
    const cpu = run(`ORGANIZATION_BLOCK MAIN:OB1
TITLE=Prueba
BEGIN
Network 1 // Dos salidas con condiciones distintas
LD     I0.0
LPS
A      I0.1
=      Q0.0
LRD
AN     I0.1
=      Q0.1
LPP
=      Q0.2
Network 2
LD     I0.2
S      Q1.0, 3
END_ORGANIZATION_BLOCK
SUBROUTINE_BLOCK SBR_0:SBR0
BEGIN
END_SUBROUTINE_BLOCK`)
    cpu.bits.set('I0.0', true)
    cpu.scan(0.01)
    expect(['Q0.0', 'Q0.1', 'Q0.2'].map((a) => cpu.bits.get(a))).toEqual([false, true, true])
    cpu.bits.set('I0.1', true)
    cpu.bits.set('I0.2', true)
    cpu.scan(0.01)
    expect(['Q0.0', 'Q0.1', 'Q0.2', 'Q1.0', 'Q1.1', 'Q1.2', 'Q1.3'].map((a) => Boolean(cpu.bits.get(a)))).toEqual([true, false, true, true, true, true, false])
  })

  it('TON, TOF y contador CTU con reset', () => {
    const cpu = run(`LD I0.0
TON T37, 10
LD T37
= Q0.0
LD I0.1
TOF T38, 5
LD T38
= Q0.1
LD I0.2
LD I0.3
CTU C0, 3
LD C0
= Q0.2`)
    const scan = (ms) => {
      for (let t = 0; t < ms; t += 10) cpu.scan(0.01)
    }
    cpu.bits.set('I0.0', true)
    scan(900)
    expect(cpu.bits.get('Q0.0')).toBe(false)
    scan(200) // 1 s (10 × 100 ms)
    expect(cpu.bits.get('Q0.0')).toBe(true)
    cpu.bits.set('I0.1', true)
    scan(20)
    cpu.bits.set('I0.1', false)
    scan(400)
    expect(cpu.bits.get('Q0.1')).toBe(true) // TOF: sigue 0,5 s tras soltar
    scan(200)
    expect(cpu.bits.get('Q0.1')).toBe(false)
    for (let i = 0; i < 3; i++) {
      cpu.bits.set('I0.2', true)
      scan(20)
      cpu.bits.set('I0.2', false)
      scan(20)
    }
    expect(cpu.bits.get('Q0.2')).toBe(true)
    cpu.bits.set('I0.3', true)
    scan(20)
    expect(cpu.bits.get('Q0.2')).toBe(false)
  })

  it('símbolos de la tabla de variables y errores con su línea', () => {
    const resolve = (s) => ({ marcha: 'I0.0', motor: 'Q0.0' })[s.toLowerCase()]
    const cpu = run('LD "Marcha"\n= Motor', resolve)
    cpu.bits.set('I0.0', true)
    cpu.scan(0.01)
    expect(cpu.bits.get('Q0.0')).toBe(true)
    expect(parseProgram('LD I0.0\n= Bomba', resolve).errors[0].message).toBe('Línea 2: «Bomba» no es una dirección ni un símbolo de la tabla de variables.')
    expect(() => run('LD I0.0\nFOO Q0.0').scan(0.01)).toThrow('Línea 2: la instrucción «FOO» no está en la CPU simulada.')
    expect(() => run('A I0.0').scan(0.01)).toThrow('Línea 1: la pila lógica está vacía (falta un LD).')
  })
})

describe('el programa del autómata mueve la planta', () => {
  // A+ con Marcha y a0; A− con a1 (cilindro de doble efecto), escrito a mano con direcciones.
  const program = `Network 1
LD     I0.0
A      I0.1
S      M0.0, 1
Network 2
LD     I0.2
R      M0.0, 1
Network 3
LD     M0.0
=      Q0.0
Network 4
LDN    M0.0
=      Q0.1`
  const variables = [
    { name: 'Marcha', type: 'input', address: 'I0.0', uses: ['x'] },
    { name: 'a0', type: 'input', address: 'I0.1', uses: ['x'] },
    { name: 'a1', type: 'input', address: 'I0.2', uses: ['x'] },
    { name: 'A+', type: 'output', address: 'Q0.0', uses: ['x'] },
    { name: 'A-', type: 'output', address: 'Q0.1', uses: ['x'] },
  ]
  const scene = {
    elements: [
      { id: 'm', type: 'button', variable: 'Marcha', contact: 'NO' },
      { id: 'A', type: 'cylinder', x: 0, y: 0, rot: 0, extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1', stroke: 100, time: 0.5 },
    ],
  }

  it('Marcha -> el cilindro sale, llega a a1 y vuelve solo', () => {
    const { runner, errors } = makeCpuRunner(program, variables)
    expect(errors).toEqual([])
    const world = makeWorld(scene)
    let w = sceneAction(scene, world.init(), 'm', 'press')
    let state = { time: 0, values: {}, active: new Set(), activatedAt: new Map() }
    let inputs = world.inputs(w)
    const positions = []
    let reachedA1 = false
    for (let t = 0.1; t <= 2; t += 0.01) {
      const r = advanceCpu(runner, { state, inputs, world: w }, t, { world })
      expect(r.error).toBe(null)
      ;({ state, inputs } = r)
      w = t > 0.2 ? sceneAction(scene, r.world, 'm', 'release') : r.world
      positions.push(w.pos.A)
      if (inputs.a1) reachedA1 = true
    }
    expect(reachedA1).toBe(true) // salió del todo
    expect(positions.at(-1)).toBe(0) // y volvió
  })

  it('variables sin dirección: aviso', () => {
    const { warnings } = makeCpuRunner(program, [...variables, { name: 'Luz', type: 'output', address: '', uses: ['x'] }])
    expect(warnings[0]).toMatch(/Sin dirección.*Luz/)
  })
})

describe('tabla de símbolos pegada desde Micro/WIN', () => {
  it('nombre, dirección y comentario; tipo por la zona; cabecera y líneas raras', async () => {
    const { applySymbols, parseSymbolTable } = await import('../../src/lib/plc/symbolTable')
    const text = 'Símbolo\tDirección\tComentario\n\tMarcha\tI0.0\tPulsador verde\n\tA+\tQ0.0\t\nNivel\tAIW0\nesto no vale'
    const { symbols, skipped } = parseSymbolTable(text)
    expect(symbols).toEqual([
      { name: 'Marcha', address: 'I0.0', comment: 'Pulsador verde' },
      { name: 'A+', address: 'Q0.0', comment: '' },
      { name: 'Nivel', address: 'AIW0', comment: '' },
    ])
    expect(skipped).toEqual(['esto no vale'])
    const vars = applySymbols({ Marcha: { type: 'input', comment: 'ya tenía' } }, symbols)
    expect(vars).toEqual({
      Marcha: { type: 'input', comment: 'ya tenía', address: 'I0.0' },
      'A+': { type: 'output', address: 'Q0.0' },
      Nivel: { type: 'analogIn', address: 'AIW0' },
    })
  })
})
