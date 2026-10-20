import { describe, expect, it } from 'vitest'
import { exportPcSimu, parsePcSimu } from '../../src/lib/pcsimu'
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
})
