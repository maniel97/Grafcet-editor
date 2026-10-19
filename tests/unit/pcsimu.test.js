import { describe, expect, it } from 'vitest'
import { exportPcSimu, parsePcSimu, pcsimuText, PCSIMU_COLORS, PCSIMU_SETA, withAuxOutputs } from '../../src/lib/pcsimu'
import { PRACTICE_GUIDES } from '../../src/lib/practiceGuides'
import { EXAMPLES } from '../../src/lib/examples'
import { generateLadder } from '../../src/lib/ladder/generate'
import { toS7200 } from '../../src/lib/ladder/exportS7200'

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

  it('las setas salen como la seta de PC_SIMU (pulsador con f15 = 12, NC)', () => {
    const { text, warnings } = exportPcSimu(practice('p4'))
    const seta = parsePcSimu(text).filter((o) => o.type === 2 && o.fields[11] === PCSIMU_SETA)
    expect(seta).toHaveLength(2)
    expect(seta.every((o) => o.fields[5] === 1 && o.fields[12] === 0)).toBe(true) // NC y redonda
    expect(warnings.some((w) => /seta/.test(w))).toBe(false)
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
    expect(count).toBe(6)
    expect(warnings).toEqual(['Motor: en PC_SIMU, Atras es la salida de giro a la izquierda (en el editor invierte el giro de la marcha).'])
    const objects = parsePcSimu(text)
    const of = (type) => objects.filter((o) => o.type === type)
    // f4 (1 salida, 0 entrada), byte, bit y NC
    const io = (o) => [o.fields[0], o.fields[1], o.fields[3], o.fields[5]]
    expect(of(6).map(io)).toEqual([[0, 0, 2, 1]])
    expect(of(7).map(io)).toEqual([[0, 0, 3, 0]])
    expect(of(15).map(io)).toEqual([[1, 0, 2, 0]])
    // El motor: derecha en Q0.0, izquierda (el giro inverso) en Q0.1 y las dos activas (f16 = 11).
    const [motor] = of(18)
    expect([motor.fields[1], motor.fields[3], motor.fields[2], motor.fields[4], motor.fields[12]]).toEqual([0, 0, 0, 1, 11])
    // Su nombre, más abajo: PC_SIMU escribe la velocidad («3000 r.p.m.») justo debajo del motor.
    const motorLabel = objects.find((o) => o.type === 1008 && o.text === 'Motor')
    expect(motorLabel.rect[1] - motor.rect[3]).toBeGreaterThanOrEqual(28)
    // El semáforo, como baliza: rojo f5.f7, ámbar f6.f8 y verde f14.f15.
    const [baliza] = of(29)
    expect([baliza.fields[1], baliza.fields[3], baliza.fields[2], baliza.fields[4], baliza.fields[10], baliza.fields[11]]).toEqual([1, 0, 1, 1, 1, 2])
    // Salidas arriba, mandos en medio y detectores abajo.
    const top = (type) => Math.min(...of(type).map((o) => o.rect[1]))
    const bottom = (type) => Math.max(...of(type).map((o) => o.rect[3]))
    expect(bottom(29)).toBeLessThan(top(2))
    expect(bottom(2)).toBeLessThan(Math.min(top(6), top(7)))
    // Ni los nombres largos se pisan.
    objects.forEach((a, i) => objects.slice(i + 1).forEach((b) => expect(overlap(a.rect, b.rect)).toBe(false)))
  })

  it('un semáforo sin las tres luces sale como leds; un detector inductivo lleva su tipo (f12 = 0)', () => {
    const variables = { R: { address: 'Q0.0' }, V: { address: 'Q0.2' }, Pieza: { address: 'I0.0' } }
    const elements = [
      { id: '1', type: 'trafficlight', red: 'R', amber: '', green: 'V' },
      { id: '2', type: 'sensor', variable: 'Pieza', kind: 'inductive' },
    ]
    const objects = parsePcSimu(exportPcSimu({ plc: { variables, scene: { elements } } }).text)
    expect(objects.filter((o) => o.type === 29)).toHaveLength(0)
    expect(objects.filter((o) => o.type === 11).map((o) => [o.fields[3], o.fields[11]])).toEqual([[0, PCSIMU_COLORS.red], [2, PCSIMU_COLORS.green]])
    expect(objects.find((o) => o.type === 7).fields[8]).toBe(0)
  })

  it('cilindro: A+ / A− o solo A+ (vuelta por muelle), sus captadores a0 y a1, orientación y estado inicial', () => {
    const v = (address) => ({ address })
    const variables = { 'A+': v('Q0.6'), 'A-': v('Q0.7'), a0: v('I2.7'), a1: v('I3.1'), 'B+': v('Q1.0'), b1: v('I1.2') }
    const elements = [
      { id: '1', type: 'cylinder', extend: 'A+', retract: 'A-', retracted: 'a0', extended: 'a1' },
      { id: '2', type: 'cylinder', extend: 'B+', extended: 'b1', rot: 90, initial: 1, vacuum: 'V' },
    ]
    const { text, warnings } = exportPcSimu({ plc: { variables, scene: { elements } } })
    expect(warnings).toEqual([
      'B+: V no pasa a PC_SIMU (posición analógica y ventosa).',
      'B+: vuelve por muelle; PC_SIMU lo recoge con su propia salida, así que el .awl pone Q0.0 = NOT Q1.0.',
    ])
    const [a, b] = parsePcSimu(text).filter((o) => o.type === 19)
    // f4 biestable, expandir Q0.6, contraer Q0.7, a0 I2.7 y a1 I3.1 (bit en «a»), derecha, gráfico 1 contraído, las dos salidas
    expect(a.fields).toEqual([1, 0, 0, 6, 7, 1, 1, 2, 3, 7, 0, 11, 11, 50])
    expect(a.a).toBe(1)
    expect(a.text).toBe('. 50.  0.  0.0.  0.0.0')
    expect(a.rect[2] - a.rect[0]).toBe(60)
    // Con vuelta por muelle (sin A−): PC_SIMU solo lo recoge con su salida «contraer», así que lleva una
    // libre (Q0.0) que el .awl pone a NOT B+. Solo a1, hacia abajo (vertical) y empieza fuera.
    expect(b.fields).toEqual([1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 3, 21, 11, 50])
    expect(b.a).toBe(2)
    expect(b.rect[3] - b.rect[1]).toBe(60)
  })

  it('la salida auxiliar de un cilindro con muelle: libre (ni de la tabla ni del programa) y como red al final del OB1', () => {
    const variables = { 'A+': { address: 'Q0.0' }, L: { address: 'Q0.2' } }
    const elements = [{ id: '1', type: 'cylinder', extend: 'A+' }, { id: '2', type: 'lamp', variable: 'L' }]
    const { aux } = exportPcSimu({ plc: { variables, scene: { elements } } }, { reserved: ['Q0.1'] })
    expect(aux).toEqual([{ from: 'Q0.0', to: 'Q0.3', name: 'A+' }])
    const awl = ['ORGANIZATION_BLOCK MAIN:OB1', 'BEGIN', 'Network 1 // x', 'LD     I0.0', '=      Q0.0', 'END_ORGANIZATION_BLOCK', 'SUBROUTINE_BLOCK SBR_0:SBR0', 'Network 1 // ', 'END_SUBROUTINE_BLOCK'].join('\r\n')
    const out = withAuxOutputs(awl, aux).split('\r\n')
    expect(out.slice(5, 9)).toEqual(['Network 2 // PC_SIMU: Q0.3 recoge A+ (vuelta por muelle)', 'LDN    Q0.0', '=      Q0.3', 'END_ORGANIZATION_BLOCK'])
    expect(withAuxOutputs(awl, [])).toBe(awl)
  })

  it('planta de frente: la máquina a escala (cinta, alimentador, detectores, recogida) y el panel a su derecha', () => {
    const { text, warnings } = exportPcSimu(practice('p4'))
    // «Caja» suelta la caja sin pasar por el autómata: PC_SIMU los une por una entrada libre.
    expect(warnings).toEqual(['Caja: no pasa por el autómata; en PC_SIMU el pulsador y el alimentador usan la entrada libre I0.4.'])
    const objects = parsePcSimu(text)
    const one = (type) => objects.filter((o) => o.type === type)
    const [cinta] = one(20)
    // Marcha a la derecha con M (Q0.0), sin marcha atrás; 420 px en 5 s.
    expect([cinta.fields[1], cinta.fields[3], cinta.fields[12], cinta.fields[11], cinta.fields[13]]).toEqual([0, 0, 1, 0, 50])
    expect([cinta.rect[2] - cinta.rect[0], cinta.rect[3] - cinta.rect[1]]).toEqual([420, 30])
    // El alimentador: grande (44 px), por una entrada (f4 = 0) I0.4, suelta hacia abajo, piezas de plástico.
    const [alim] = one(25)
    expect([alim.fields[0], alim.fields[1], alim.fields[3], alim.fields[6], alim.fields[10], alim.fields[12]]).toEqual([0, 0, 4, 1, 3, 6])
    expect(alim.rect[2] - alim.rect[0]).toBe(44)
    // La pieza sale justo encima de la cinta: su base (debajo del alimentador + 44) queda por encima de ella.
    expect(alim.rect[3] + 44).toBeLessThanOrEqual(cinta.rect[1])
    // Pulsador «Caja» en el panel con esa misma entrada.
    expect(one(2).find((o) => o.fields[1] === 0 && o.fields[3] === 4)).toBeTruthy()
    // Detectores: S1 mira hacia arriba (f14 = 2) a 70 px; S2 a la derecha a 80.
    expect(one(7).map((o) => [o.fields[3], o.fields[10], o.fields[9]])).toEqual([[0, 2, 70], [3, 0, 80]])
    // La recogida, un perfil que destruye las piezas.
    expect(one(19).map((o) => [o.fields[10], o.fields[9]])).toEqual([[1, 0]])
    // El panel, a la derecha de la máquina.
    const machineRight = Math.max(...[...one(20), ...one(25), ...one(7), ...one(19)].map((o) => o.rect[2]))
    expect(Math.min(...[...one(2), ...one(11)].map((o) => o.rect[0]))).toBeGreaterThan(machineRight)
    objects.forEach((a, i) => objects.slice(i + 1).forEach((b) => expect(overlap(a.rect, b.rect)).toBe(false)))
  })

  it('planta de frente: una pieza por orden y sin cruzar detectores al caer, cilindros con su recorrido y nombres fuera de las franjas', () => {
    const example = (re) => parsePcSimu(exportPcSimu(EXAMPLES.find((e) => re.test(e.title)).build()).text)
    const clasif = example(/Clasificación por tamaño con cinta reversible/)
    // Con orden (Soltar): una sola pieza por activación.
    expect(clasif.find((o) => o.type === 25).fields[13]).toBe(30000)
    // Ningún nombre pisa la franja que vigila un detector (PC_SIMU la dibuja).
    const zone = (o) => {
      const [x1, y1, x2, y2] = o.rect
      const d = o.fields[9]
      return [[x2, y1, x2 + d, y2], [x1 - d, y1, x1, y2], [x1, y1 - d, x2, y1], [x1, y2, x2, y2 + d]][o.fields[10]]
    }
    const zones = clasif.filter((o) => o.type === 7).map(zone)
    for (const l of clasif.filter((o) => o.type === 1008)) for (const z of zones) expect(overlap(l.rect, z), l.text).toBe(false)
    // La pieza aparece ya sobre la cinta: al caer cruzaría la franja de «Alta» (PC_SIMU la daría por alta).
    const cinta = clasif.find((o) => o.type === 20)
    const pieza = clasif.find((o) => o.type === 25)
    expect(cinta.rect[1] - (pieza.rect[3] + 28)).toBe(1)
    // El elevador (160 px de recorrido): gráfico 1 (el que empuja y sube piezas en PC_SIMU), con el cuerpo de
    // 160 · 19 / 11 = 276 px y 28 de ancho (el de la placa del editor).
    const estacion = example(/Estación de elevación/)
    const elevador = estacion.find((o) => o.type === 19 && o.fields[10] === 2)
    expect(elevador.fields[11]).toBe(11)
    expect([elevador.rect[2] - elevador.rect[0], elevador.rect[3] - elevador.rect[1]]).toEqual([28, 276])
  })

  it('horno: potenciómetro en su AIW y visualizadores en BCD, con las direcciones del programa del S7-200', () => {
    const p = EXAMPLES.find((e) => /Horno con consigna/.test(e.title)).build()
    const program = toS7200(generateLadder(p.nodes, p.edges, p.plc), p.plc, { title: 'Horno' })
    const sim = exportPcSimu(p, { reserved: program.text.match(/\bQ\d+\.\d\b/g) ?? [], addressOf: program.addressOf })
    const objects = parsePcSimu(sim.text)
    // La consigna (IW66 en la tabla, de S7-300) es una AIW en el programa del S7-200: el potenciómetro, en esa.
    const consigna = program.addressOf({ kind: 'var', name: 'Consigna' })
    expect(consigna).toMatch(/^AIW\d+$/)
    // (y otro en la de la temperatura: PC_SIMU no simula el calentador, se pone a mano)
    const temp = program.addressOf({ kind: 'var', name: 'Temp' })
    expect(objects.filter((o) => o.type === 17).map((o) => o.fields[1]).sort()).toEqual([Number(consigna.slice(3)), Number(temp.slice(3))].sort())
    expect(sim.warnings.some((w) => /no simula la temperatura/.test(w))).toBe(true)
    // Dos visualizadores: 4 displays de una cifra cada uno, unidades a la derecha (QBn.0) y millares a la izquierda.
    const digits = objects.filter((o) => o.type === 12)
    expect(digits).toHaveLength(8)
    expect(sim.aux.filter((x) => x.kind === 'display').map((x) => x.word)).toEqual([consigna, program.addressOf({ kind: 'var', name: 'Temp' })])
    const [first] = sim.aux
    const row = digits.slice(0, 4).map((o) => [o.fields[1], o.fields[3]])
    expect(row).toEqual([[first.qb[1], 4], [first.qb[1], 0], [first.qb[0], 4], [first.qb[0], 0]])
    // Las salidas de los displays, libres: ni de la tabla ni del programa.
    for (const qb of sim.aux.flatMap((x) => x.qb)) expect(program.text).not.toMatch(new RegExp(`\bQ${qb}\.`))
    // Y su red en el .awl: el valor en BCD, unidades y decenas en el primer byte.
    const awl = withAuxOutputs(program.text, sim.aux)
    expect(awl).toContain(`MOVW   ${consigna}, VW990\r\nIBCD   VW990\r\nMOVB   VB991, QB${first.qb[0]}\r\nMOVB   VB990, QB${first.qb[1]}`)
    expect(sim.warnings.some((w) => /en bruto/.test(w))).toBe(true)
    objects.forEach((a, i) => objects.slice(i + 1).forEach((b) => expect(overlap(a.rect, b.rect)).toBe(false)))
  })

  it('planta de frente: los rótulos, como texto en su sitio', () => {
    const plc = { scene: { gravity: true, elements: [{ id: 'r', type: 'label', x: 100, y: 50, text: 'Zona de carga' }, { id: 'c', type: 'conveyor', x: 100, y: 200, rot: 0, motor: '', length: 200 }] }, variables: {} }
    const objects = parsePcSimu(exportPcSimu({ plc }).text)
    const rotulo = objects.find((o) => o.type === 1008 && o.text === 'Zona de carga')
    const cinta = objects.find((o) => o.type === 20)
    expect(rotulo.rect[0]).toBe(cinta.rect[0])
    expect(cinta.rect[1] - rotulo.rect[1]).toBe(135) // 200 − 15 − 50
  })

  it('depósitos: con su válvula de llenado apoyada en el borde de arriba y la de vaciado pegada por debajo', () => {
    const objects = parsePcSimu(exportPcSimu(EXAMPLES.find((e) => /Mezcladora/.test(e.title)).build()).text)
    const tanks = objects.filter((o) => o.type === 22)
    const valves = objects.filter((o) => o.type === 23)
    expect(tanks).toHaveLength(2)
    // A: llenar Q0.1 (4 s: caudal 250), vaciar Q0.4 (3 s: 333); alto I0.3 como máximo y vacío I0.5 como mínimo.
    const [a] = tanks
    expect([a.fields[11], a.fields[1], a.fields[3], a.fields[5], a.fields[6], a.fields[7], a.fields[13]]).toEqual([1, 0, 3, 1, 0, 5, 0])
    expect([a.fields[12], a.a, a.b]).toEqual([2, 1, 0]) // líquidos, con el nivel a la vista, vacío
    const over = valves.filter((v) => v.rect[0] >= a.rect[0] && v.rect[2] <= a.rect[2])
    const fill = over.find((v) => v.rect[3] <= a.rect[1] + 10 && v.rect[3] >= a.rect[1])
    const drain = over.find((v) => v.rect[1] === a.rect[3])
    expect([fill.fields[1], fill.fields[3], fill.fields[6], fill.fields[7]]).toEqual([0, 1, 250, 1])
    expect([drain.fields[1], drain.fields[3], drain.fields[6], drain.fields[7]]).toEqual([0, 4, 333, 0])
  })

  it('barrera: abre con su salida, sus finales de carrera, y si cierra por su peso, una salida para cerrarla', () => {
    const { text, warnings, aux } = exportPcSimu(EXAMPLES.find((e) => /Apilador con trampilla/.test(e.title)).build())
    const door = parsePcSimu(text).find((o) => o.type === 21)
    // Abrir Q0.1; abierta b1 = I0.2 (f16.f9) y cerrada b0 = I0.3 (f14.f15); dibujo «Barrera».
    expect([door.fields[1], door.fields[3], door.fields[8]]).toEqual([0, 1, 6])
    expect([door.fields[7], door.fields[12], door.fields[5]]).toEqual([1, 0, 2])
    expect([door.fields[6], door.fields[10], door.fields[11]]).toEqual([1, 0, 3])
    // Sin salida de cerrar: una libre, NOT abrir.
    const shut = aux.find((x) => x.from === 'Q0.1')
    expect(shut).toBeTruthy()
    expect(`Q${door.fields[2]}.${door.fields[4]}`).toBe(shut.to)
    expect(warnings.some((w) => /cierra por su peso/.test(w))).toBe(true)
    expect(warnings.some((w) => /no sostiene ni frena piezas/.test(w))).toBe(true)
  })

  it('todos los ejemplos del editor se exportan sin pisarse', () => {
    for (const example of EXAMPLES) {
      const objects = parsePcSimu(exportPcSimu(example.build()).text)
      objects.forEach((a, i) => objects.slice(i + 1).forEach((b) => expect(overlap(a.rect, b.rect), example.title).toBe(false)))
    }
  })
})
