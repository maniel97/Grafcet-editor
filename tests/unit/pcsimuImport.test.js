import { describe, expect, it } from 'vitest'
import { exportPcSimu, parsePcSimu, pcsimuText } from '../../src/lib/pcsimu'
import { importPcSimu, isPcSimu, withPcSimuPlant } from '../../src/lib/pcsimuImport'
import { EXAMPLES } from '../../src/lib/examples'

// Los objetos de un .sim (sin los rótulos), para comparar: tipo y, en los actuadores, cuál.
const signature = (text) =>
  parsePcSimu(text)
    .filter((o) => o.type !== 1008)
    .map((o) => `${o.type}:${o.type === 19 ? o.fields[11] : ''}:${o.fields[1]}.${o.fields[3]}`)
    .sort()

describe('Importar de PC_SIMU (.sim)', () => {
  it('reconoce un .sim por su cabecera', () => {
    expect(isPcSimu(new TextEncoder().encode('PC_SIMU*  1* 50*$$$'))).toBe(true)
    expect(isPcSimu(new TextEncoder().encode('{"format":'))).toBe(false)
  })

  it('ida y vuelta: cada ejemplo exportado, importado y vuelto a exportar da los mismos objetos (salvo los displays)', () => {
    for (const ex of EXAMPLES) {
      const p = ex.build()
      const a = exportPcSimu(p)
      if (!a.count) continue
      const imp = importPcSimu(a.text)
      const b = exportPcSimu(imp.project)
      const noDisplays = (list) => list.filter((s) => !s.startsWith('12:'))
      expect(noDisplays(signature(b.text)), ex.title).toEqual(noDisplays(signature(a.text)))
    }
  })

  it('lo que no tiene equivalente, contado aparte (para el aviso)', () => {
    const p = EXAMPLES.find((e) => /Contar pulsaciones/.test(e.title)).build()
    const { skipped } = importPcSimu(exportPcSimu(p).text)
    expect(skipped).toEqual([{ what: 'display', count: 4 }])
  })

  it('las variables, con el nombre del rótulo de al lado (y su dirección)', () => {
    const p = EXAMPLES.find((e) => /Marcha y paro de un motor/.test(e.title)).build()
    const { project } = importPcSimu(exportPcSimu(p).text)
    const names = Object.fromEntries(Object.entries(project.plc.variables).map(([n, v]) => [v.address, n]))
    const original = Object.fromEntries(Object.entries(p.plc.variables).filter(([, v]) => v.address).map(([n, v]) => [v.address, n]))
    for (const [address, name] of Object.entries(original)) if (names[address]) expect(names[address]).toBe(name)
    expect(project.plc.scene.elements.filter((e) => e.place === 'desk').length).toBeGreaterThan(0)
  })

  it('el cilindro montado en otro y su ventosa, de vuelta como en el editor', () => {
    const v = (address) => ({ address })
    const variables = { X: v('Q0.0'), Z: v('Q0.1'), V: v('Q0.2'), VH: v('I0.0') }
    const elements = [
      { id: 'x', type: 'cylinder', x: 100, y: 100, extend: 'X', stroke: 150 },
      { id: 'z', type: 'cylinder', x: 188, y: 100, rot: 90, extend: 'Z', vacuum: 'V', holding: 'VH', mountedOn: 'x', stroke: 80 },
    ]
    const { project } = importPcSimu(exportPcSimu({ plc: { variables, scene: { gravity: true, elements } } }).text)
    const cyl = project.plc.scene.elements.filter((e) => e.type === 'cylinder')
    const x = cyl.find((e) => e.rot === 0)
    const z = cyl.find((e) => e.rot === 90)
    expect(z.mountedOn).toBe(x.id)
    expect([x.extend, z.extend]).toEqual(['X', 'Z']) // con el nombre de su rótulo
    // La ventosa no lleva rótulo en el .sim (pisaría el cilindro): sus variables, por su dirección.
    expect([z.vacuum, z.holding, z.tool]).toEqual(['Q0_2', 'I0_0', 'vacuum'])
    expect(Math.abs(x.stroke - 150)).toBeLessThan(5)
    expect(Math.abs(z.stroke - 80)).toBeLessThan(5)
  })

  it('cargar la planta en el proyecto abierto: las direcciones con variable conservan su nombre', () => {
    const p = EXAMPLES.find((e) => /Marcha y paro de un motor/.test(e.title)).build()
    const imported = importPcSimu(exportPcSimu(p).text).project
    const plc = { variables: { Arranque: { type: 'input', address: 'I0.0' }, Otra: { type: 'memory', address: 'M0.0' } }, cpu: { enabled: true } }
    const next = withPcSimuPlant(plc, imported)
    expect(next.cpu).toEqual({ enabled: true })
    expect(next.variables.Otra).toEqual(plc.variables.Otra)
    const uses = JSON.stringify(next.scene.elements)
    expect(uses).toContain('"Arranque"') // I0.0 se queda con su nombre
    expect(Object.values(next.variables).filter((v) => v.address === 'I0.0')).toHaveLength(1)
  })

  it('dibujos: líneas, rectángulos y elipses con su color, y el bote de pintura rellena la figura en la que cae', () => {
    const blank = Array(14).fill(0)
    const withColor = (c, f4 = 0) => blank.map((v, i) => (i === 11 ? c : i === 0 ? f4 : v))
    const text = pcsimuText([
      { type: 1002, rect: [100, 100, 200, 160], fields: withColor(0) },
      { type: 1006, rect: [150, 130, 150, 130], fields: withColor(0x808080) },
      { type: 1001, rect: [10, 10, 60, 40], fields: withColor(0xff0000, 2) },
      { type: 1005, rect: [300, 300, 340, 320], fields: withColor(0x00ff00) },
    ])
    const { project, skipped } = importPcSimu(text)
    expect(skipped).toEqual([])
    const shapes = project.plc.scene.elements.filter((e) => e.type === 'shape')
    expect(shapes).toEqual([
      expect.objectContaining({ kind: 'rect', x: 100, y: 100, width: 100, height: 60, color: '#000000', fill: '#808080' }),
      expect.objectContaining({ kind: 'line', x: 10, y: 40, width: 50, height: -30, color: '#0000ff' }),
      expect.objectContaining({ kind: 'ellipse', width: 40, height: 20, color: '#00ff00', fill: '#00ff00' }),
    ])
    // Y de vuelta: el rectángulo relleno sale relleno (1004) y con su borde (1002).
    const types = parsePcSimu(exportPcSimu(project).text).map((o) => o.type).sort()
    expect(types).toEqual([1001, 1002, 1004, 1005])
  })

  it('imágenes: fijas, con dos dibujos (salida o entrada al pulsarlas) y las que faltan, avisadas', () => {
    const fields = (set) => Array.from({ length: 14 }, (_, i) => set[i + 4] ?? 0)
    const text = pcsimuText([
      { type: 14, rect: [0, 0, 200, 100], fields: fields({ 15: 1 }), text2: String.raw`C:\Users\otro\Pupitre.bmp` },
      { type: 14, rect: [300, 0, 330, 50], fields: fields({ 4: 1, 5: 0, 7: 6, 11: 0, 12: 5 }), text2: 'Baliza_off.bmp', group: 'Baliza_on.bmp' },
      { type: 14, rect: [400, 0, 440, 40], fields: fields({ 4: 0, 5: 1, 7: 2, 13: 1, 14: 1 }), text2: 'Termico_off.bmp', group: 'Termico_on.bmp' },
    ])
    const images = { 'pupitre.bmp': 'data:p', 'baliza_off.bmp': 'data:b0', 'baliza_on.bmp': 'data:b1' }
    const { project, warnings } = importPcSimu(text, images)
    const [still, lamp, thermal] = project.plc.scene.elements
    expect(still).toMatchObject({ type: 'image', src: 'data:p', srcOn: '', width: 200, height: 100 })
    expect(lamp).toMatchObject({ src: 'data:b0', srcOn: 'data:b1', show: 'Q0_6', dy: 5 })
    expect(thermal).toMatchObject({ src: '', press: 'I1_2', contact: 'NC', latch: true })
    expect(warnings).toContain('Faltan 2 imágenes (elígelas junto al .sim, en la misma ventana): termico_off.bmp, termico_on.bmp.')
  })

  it('herramienta: un motor con su dibujo (taladro…), su parada y montado en el cilindro que la lleva, de ida y vuelta', () => {
    const v = (address) => ({ address })
    const variables = { Z: v('Q0.0'), T: v('Q0.1'), TP: v('Q0.2') }
    const elements = [
      { id: 'z', type: 'cylinder', x: 200, y: 100, rot: 90, extend: 'Z', stroke: 80 },
      { id: 't', type: 'motor', x: 200, y: 300, variable: 'T', stop: 'TP', look: 'drill2', size: 60, mountedOn: 'z' },
    ]
    const sim = exportPcSimu({ plc: { variables, scene: { gravity: true, elements } } })
    const tool = parsePcSimu(sim.text).find((o) => o.type === 19 && o.fields[11] === 400)
    expect([tool.fields[10], tool.fields[0], tool.fields[3], tool.fields[4], tool.name]).toEqual([12, 1, 1, 2, 'Grupo_1'])
    const { project } = importPcSimu(sim.text)
    const cyl = project.plc.scene.elements.find((e) => e.type === 'cylinder')
    const motor = project.plc.scene.elements.find((e) => e.type === 'motor')
    expect(motor).toMatchObject({ look: 'drill2', variable: 'T', stop: 'Q0_2', mountedOn: cyl.id }) // T: su rótulo
  })

  it('«Salidas» (f15 = 500): el contactor o la electroválvula que muestra una salida, de ida y vuelta', () => {
    const elements = [{ id: 'v', type: 'motor', x: 100, y: 100, variable: 'Y1', look: 'valvePneumatic1' }]
    const sim = exportPcSimu({ plc: { variables: { Y1: { address: 'Q1.3' } }, scene: { gravity: true, elements } } })
    const out = parsePcSimu(sim.text).find((o) => o.type === 19)
    expect([out.fields[11], out.fields[10], out.fields[1], out.fields[3]]).toEqual([500, 26, 1, 3])
    const motor = importPcSimu(sim.text).project.plc.scene.elements.find((e) => e.type === 'motor')
    expect(motor).toMatchObject({ look: 'valvePneumatic1', variable: 'Y1' })
  })
})
