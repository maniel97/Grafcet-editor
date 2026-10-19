import { describe, expect, it } from 'vitest'
import { exportPcSimu, parsePcSimu, pcsimuText, PCSIMU_COLORS } from '../../src/lib/pcsimu'
import { PRACTICE_GUIDES } from '../../src/lib/practiceGuides'
import { EXAMPLES } from '../../src/lib/examples'

const practice = (id) => PRACTICE_GUIDES[0].practices.find((p) => p.id === id).teacher()
const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

describe('PC_SIMU (.sim)', () => {
  it('lee y escribe el formato: objetos separados por «**», cierre «*$$$» y basura detrás ignorada', () => {
    const sample = 'PC_SIMU*  1* 50*0*2#Pulsador*40*40*65*65*0*0*0*3*0*1*0*0*0*0*0*4*0*0###*0*0**1*1008#*45*77*61*94*0*0*0*0*0*0*0*0*0*0*0*0*0*0#PP##*0*0*$$$basura'
    const objects = parsePcSimu(sample)
    expect(objects).toHaveLength(2)
    expect(objects[0]).toMatchObject({ type: 2, name: 'Pulsador', rect: [40, 40, 65, 65] })
    expect(objects[0].fields[3]).toBe(3)
    expect(objects[1]).toMatchObject({ type: 1008, text: 'PP' })
    expect(pcsimuText(objects)).toBe(sample.split('basura')[0])
    expect(parsePcSimu(pcsimuText([]))).toEqual([]) // sin objetos
    expect(() => parsePcSimu('hola')).toThrow()
  })

  it('práctica 7: tres leds en Q0.0–Q0.2 con sus colores y PM / PP en I0.0–I0.1, con su nombre debajo', () => {
    const { text, bytes, warnings, count } = exportPcSimu(practice('p7'))
    expect(warnings).toEqual([])
    expect(count).toBe(5)
    expect(bytes.length).toBe(text.length)
    const objects = parsePcSimu(text)
    const leds = objects.filter((o) => o.type === 11)
    expect(leds.map((o) => [o.fields[0], o.fields[1], o.fields[3], o.fields[11]])).toEqual([
      [1, 0, 0, PCSIMU_COLORS.green],
      [1, 0, 1, PCSIMU_COLORS.red],
      [1, 0, 2, PCSIMU_COLORS.yellow],
    ])
    const buttons = objects.filter((o) => o.type === 2)
    // byte, bit, NC, color
    expect(PCSIMU_COLORS).toMatchObject({ green: 0, black: 1, red: 4, yellow: 6 }) // comprobados en PC_SIMU
    expect(buttons.map((o) => [o.fields[1], o.fields[3], o.fields[5], o.fields[11]])).toEqual([
      [0, 0, 0, PCSIMU_COLORS.black],
      [0, 1, 0, PCSIMU_COLORS.red],
    ])
    expect(objects.filter((o) => o.type === 1008).map((o) => o.text)).toEqual(['LV', 'LR', 'LA', 'PM', 'PP'])
    // Los pilotos arriba y los mandos debajo; nada se pisa.
    expect(Math.max(...leds.map((o) => o.rect[3]))).toBeLessThan(Math.min(...buttons.map((o) => o.rect[1])))
    objects.forEach((a, i) => objects.slice(i + 1).forEach((b) => expect(overlap(a.rect, b.rect)).toBe(false)))
  })

  it('las setas salen como pulsador rojo NC, y lo que no es del panel se avisa con su tipo', () => {
    const { text, warnings } = exportPcSimu(practice('p4'))
    const seta = parsePcSimu(text).filter((o) => o.type === 2 && o.fields[5] === 1)
    expect(seta).toHaveLength(2)
    expect(seta.every((o) => o.fields[11] === PCSIMU_COLORS.red)).toBe(true)
    expect(warnings.some((w) => /Seta1: la seta sale como un pulsador rojo/.test(w))).toBe(true)
    expect(warnings.at(-1)).toMatch(/Todavía no pasan a PC_SIMU: .*Cinta \(1\)/)
  })

  it('un mando sin dirección de entrada se avisa y no se exporta; los separadores no llegan al archivo', () => {
    const project = {
      plc: {
        variables: { 'A*B': { address: 'I0.0' }, L: { address: 'MW10' } },
        scene: { elements: [{ id: 'b', type: 'button', variable: 'A*B', color: 'green' }, { id: 'l', type: 'lamp', variable: 'L' }] },
      },
    }
    const { text, warnings, count } = exportPcSimu(project)
    expect(count).toBe(1)
    expect(warnings).toEqual(['L: sin una dirección Q de bit; no se exporta.'])
    expect(parsePcSimu(text).find((o) => o.type === 1008).text).toBe('A B')
  })

  it('detectores, finales de carrera, motor, sirena y semáforo: cada uno en su fila y con su dirección', () => {
    const variables = {
      Fc_abajo: { address: 'I0.2' }, Det: { address: 'I0.3' }, Motor: { address: 'Q0.0' }, Atras: { address: 'Q0.1' },
      Sirena: { address: 'Q0.2' }, R: { address: 'Q1.0' }, A: { address: 'Q1.1' }, V: { address: 'Q1.2' }, Marcha_general: { address: 'I0.0' },
    }
    const elements = [
      { id: '1', type: 'limit', variable: 'Fc_abajo', contact: 'NC' },
      { id: '2', type: 'sensor', variable: 'Det' },
      { id: '3', type: 'motor', variable: 'Motor', reverse: 'Atras' },
      { id: '4', type: 'siren', variable: 'Sirena' },
      { id: '5', type: 'trafficlight', red: 'R', amber: 'A', green: 'V' },
      { id: '6', type: 'button', variable: 'Marcha_general', color: 'green' },
    ]
    const { text, warnings, count } = exportPcSimu({ plc: { variables, scene: { elements } } })
    expect(count).toBe(8)
    expect(warnings).toEqual(['Motor: el giro inverso (Atras) no pasa a PC_SIMU.'])
    const objects = parsePcSimu(text)
    const of = (type) => objects.filter((o) => o.type === type)
    // f4 (0 entrada, 1 salida), byte, bit y NC
    const io = (o) => [o.fields[0], o.fields[1], o.fields[3], o.fields[5]]
    expect(of(6).map(io)).toEqual([[0, 0, 2, 1]])
    expect(of(7).map(io)).toEqual([[0, 0, 3, 0]])
    expect(of(18).map(io)).toEqual([[1, 0, 0, 0]])
    expect(of(15).map(io)).toEqual([[1, 0, 2, 0]])
    expect(of(11).map((o) => [o.fields[1], o.fields[3], o.fields[11]])).toEqual([
      [1, 0, PCSIMU_COLORS.red],
      [1, 1, PCSIMU_COLORS.yellow],
      [1, 2, PCSIMU_COLORS.green],
    ])
    // Salidas arriba, mandos en medio y detectores abajo.
    const top = (type) => Math.min(...of(type).map((o) => o.rect[1]))
    const bottom = (type) => Math.max(...of(type).map((o) => o.rect[3]))
    expect(bottom(11)).toBeLessThan(top(2))
    expect(bottom(2)).toBeLessThan(Math.min(top(6), top(7)))
    // Ni los nombres largos se pisan.
    objects.forEach((a, i) => objects.slice(i + 1).forEach((b) => expect(overlap(a.rect, b.rect)).toBe(false)))
  })

  it('todos los ejemplos del editor se exportan sin pisarse', () => {
    for (const example of EXAMPLES) {
      const objects = parsePcSimu(exportPcSimu(example.build()).text)
      objects.forEach((a, i) => objects.slice(i + 1).forEach((b) => expect(overlap(a.rect, b.rect), example.title).toBe(false)))
    }
  })
})
