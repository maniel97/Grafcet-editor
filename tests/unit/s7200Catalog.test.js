import { describe, expect, it } from 'vitest'
import { ioMap, suggestConfiguration } from '../../src/lib/s7200Catalog'

describe('sugerencia de CPU S7-200 (con 20 % de reserva)', () => {
  it.each([
    [{ di: 4, do: 3 }, '221', []], // 5 / 4 caben en la 221
    [{ di: 6, do: 4 }, '222', []], // 8 / 5 -> 222
    [{ di: 11, do: 8 }, '224', []], // 14 / 10 -> 224
    [{ di: 20, do: 13 }, '226', []], // 24 / 16 -> 226
    [{ di: 30, do: 10 }, '226', ['EM221-16']], // 36 / 12: 226 + 16 E (menos módulos que 224 + ...)
    [{ di: 30, do: 25 }, '222', ['EM223-32']], // 36 / 30: un solo módulo con la CPU más pequeña
    [{ di: 4, do: 2, ai: 1 }, '224XP', []], // 2 EA con reserva: las integradas de la 224XP
    [{ di: 4, do: 2, ai: 5 }, '222', ['EM231-8']], // 6 EA -> EM231 de 8
    [{ di: 4, do: 2, ai: 3, ao: 1 }, '224XP', ['EM235']], // 4 EA / 2 SA: un módulo (la 222 necesitaría dos)
  ])('%o -> CPU %s %o', (needs, cpu, modules) => {
    const s = suggestConfiguration(needs)
    expect(s.cpu).toBe(cpu)
    expect(s.modules).toEqual(modules)
  })
  it('imposible: más de 128 entradas', () => expect(suggestConfiguration({ di: 200, do: 1 })).toBeNull())
})

describe('mapa de direcciones según la configuración', () => {
  it('CPU 224 + EM223 4E/4S + EM221 8E: los módulos empiezan en el byte siguiente', () => {
    const m = ioMap({ cpu: '224', modules: ['EM223-4', 'EM221-8'] })
    expect(m.inputs.slice(13)).toEqual(['I1.5', 'I2.0', 'I2.1', 'I2.2', 'I2.3', 'I3.0', 'I3.1', 'I3.2', 'I3.3', 'I3.4', 'I3.5', 'I3.6', 'I3.7'])
    expect(m.outputs.slice(9)).toEqual(['Q1.1', 'Q2.0', 'Q2.1', 'Q2.2', 'Q2.3'])
    expect(m.parts.map((p) => p.ranges)).toEqual([['I0.0–I1.5', 'Q0.0–Q1.1'], ['I2.0–I2.3', 'Q2.0–Q2.3'], ['I3.0–I3.7']])
  })
  it('analógicas de dos en dos canales; 224XP y EM235', () => {
    const m = ioMap({ cpu: '224XP', modules: ['EM235'] })
    expect(m.analogIn).toEqual(['AIW0', 'AIW2', 'AIW4', 'AIW6', 'AIW8', 'AIW10'])
    expect(m.analogOut).toEqual(['AQW0', 'AQW4']) // la integrada reserva AQW0–AQW2
  })
})

describe('direcciones y Verificar con la configuración elegida', async () => {
  const { autoAssign, EMPTY_PLC, validatePlc } = await import('../../src/lib/addressing')
  const inputs = (n) => new Map(Array.from({ length: n }, (_, i) => [`e${i}`, { type: 'input', uses: new Set(['t']) }]))

  it('las entradas que no caben en la CPU van al módulo (I2.0…), no a I1.6', () => {
    const plc = autoAssign({ ...EMPTY_PLC, scheme: 's7200', s7200: { cpu: '224', modules: ['EM221-8'] } }, [], inputs(16))
    expect(plc.variables.e13.address).toBe('I1.5')
    expect(plc.variables.e14.address).toBe('I2.0')
    expect(plc.variables.e15.address).toBe('I2.1')
  })
  it('Verificar: direcciones que no existen y más entradas de las disponibles', () => {
    const symbols = inputs(7)
    const plc = { ...autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, [], symbols), s7200: { cpu: '221', modules: [] } }
    const messages = validatePlc(plc, [], symbols).map((i) => i.message)
    expect(messages).toContain('«e6»: I0.6 no existe en la configuración CPU 221.')
    expect(messages).toContain('El proyecto usa 7 entradas digitales y la configuración CPU 221 tiene 6.')
  })
  it('S7-200: etapas en V y palabras en VW no son avisos', () => {
    const steps = [{ id: 's', data: { label: '0' } }]
    const symbols = new Map([['N', { type: 'memory', numeric: true, uses: new Set(['t']) }]])
    const plc = autoAssign({ ...EMPTY_PLC, scheme: 's7200' }, steps, symbols)
    expect(plc.steps.s.address).toBe('V0.0')
    expect(plc.variables.N.address).toBe('VW100')
    expect(validatePlc(plc, steps, symbols)).toEqual([])
  })
})
