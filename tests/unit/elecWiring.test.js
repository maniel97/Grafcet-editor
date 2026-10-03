import { describe, expect, it } from 'vitest'
import { junctions, nextTerminalNumber, wireNumbers } from '../../src/lib/elec/wiring'
import { elecAction, elecInit, elecStep } from '../../src/lib/elec/solve'
import { ELEC_TEMPLATES } from '../../src/lib/elec/templates'

const build = (id) => {
  const b = ELEC_TEMPLATES.find((t) => t.id === id).build(0, 0, 'p')
  return { components: b.components, wires: b.wires }
}

describe('cableado de plano', () => {
  it('números de cable: uno por red; los de un embarrado, su potencial', () => {
    const s = build('marcha-paro')
    const nums = wireNumbers(s)
    const byEnds = (a, b) => nums[s.wires.find((w) => (w.from.c === a && w.to.c === b) || (w.from.c === b && w.to.c === a)).id]
    expect(byEnds('p-L', 'p-S0')).toBe('L')
    expect(byEnds('p-KM1', 'p-N')).toBe('N')
    // S0:12 sale hacia S1 y hacia el 13-14 de KM1: misma red, mismo número.
    expect(byEnds('p-S0', 'p-S1')).toBe(byEnds('p-S0', 'p-KM1h'))
    expect(byEnds('p-S0', 'p-S1')).toMatch(/^\d+$/)
    expect(byEnds('p-S1', 'p-KM1')).not.toBe(byEnds('p-S0', 'p-S1'))
  })

  it('puntos de unión: en un borne con dos cables y en las tomas de un embarrado', () => {
    const s = build('marcha-paro')
    const j = junctions(s)
    expect(j['p-S0:12']).toBe(true) // sale a S1 y al contacto de KM1
    expect(j['p-L:t2']).toBe(true) // toma del embarrado
    expect(j['p-S1:13']).toBeUndefined()
  })

  it('bornas: unen arriba y abajo (el cable sigue por la regleta) y se numeran solas', () => {
    const s = {
      components: [
        { id: 'L', type: 'rail', x: 0, y: 0, potential: 'L' },
        { id: 'N', type: 'rail', x: 0, y: 0, potential: 'N' },
        { id: 'X', type: 'terminal', x: 0, y: 0, tag: 'X1', n: 1 },
        { id: 'H', type: 'lamp', x: 0, y: 0, tag: 'H1' },
      ],
      wires: [
        { id: 'a', from: { c: 'L', t: 't0' }, to: { c: 'X', t: '1' } },
        { id: 'b', from: { c: 'X', t: '2' }, to: { c: 'H', t: 'X1' } },
        { id: 'c', from: { c: 'H', t: 'X2' }, to: { c: 'N', t: 't0' } },
      ],
    }
    expect(elecStep(s, elecInit(), {}, 0.05).state.view.loads.H).toBe(true)
    expect(wireNumbers(s)).toMatchObject({ a: 'L', b: 'L' }) // misma red a los dos lados de la borna
    expect(nextTerminalNumber(s.components, 'X1')).toBe(2)
    expect(nextTerminalNumber(s.components, 'X2')).toBe(1)
    expect(elecAction(s, elecInit(), 'X', 'toggle')).toEqual(expect.objectContaining({ pressed: {} }))
  })
})

describe('hojas, columnas y referencias cruzadas', async () => {
  const { locate, crossReferenceMap, elecSheetsOf } = await import('../../src/lib/elec/sheet')
  const { contactNumbers } = await import('../../src/lib/elec/catalog')
  const sch = {
    sheets: [
      { id: 'e1', name: 'Potencia' },
      { id: 'e2', name: 'Mando' },
    ],
    components: [
      { id: 'k', type: 'coil', tag: 'KM1', x: 340, y: 400, sheet: 'e2' }, // columna 3 (centro en x 360)
      { id: 'a', type: 'contact', ref: 'KM1', contact: 'NO', x: 500, y: 260, sheet: 'e2' }, // columna 4
      { id: 'm', type: 'maincontacts', ref: 'KM1', x: 0, y: 200 }, // hoja 1 (sin hoja = la primera), columna 1
    ],
    wires: [],
  }
  it('cada aparato en su hoja y columna', () => {
    expect(elecSheetsOf(sch)).toHaveLength(2)
    expect(locate(sch, sch.components[0]).label).toBe('/2.3')
    expect(locate(sch, sch.components[2]).label).toBe('/1.1')
  })
  it('bajo la bobina, sus contactos con su sitio; bajo el contacto, el de la bobina', () => {
    const { byTag, ownerOf } = crossReferenceMap(sch, contactNumbers(sch.components))
    expect(byTag.KM1).toEqual(expect.arrayContaining([expect.objectContaining({ numbers: ['13', '14'], where: '/2.4' }), expect.objectContaining({ kind: 'principal', where: '/1.1' })]))
    expect(ownerOf.a).toBe('/2.3')
  })
})

describe('insertar plantillas sin repetir identificadores', async () => {
  const { insertTemplate } = await import('../../src/lib/elec/templates')
  const { elecAction, elecInit, elecStep } = await import('../../src/lib/elec/solve')
  it('la segunda marcha-paro lleva -KM2, -S2…, y cada una funciona por su cuenta', () => {
    const t = ELEC_TEMPLATES.find((x) => x.id === 'marcha-paro')
    const first = insertTemplate(t, { components: [] })
    const second = insertTemplate(t, { components: first.components }, first.components)
    const tags = second.components.filter((c) => c.tag).map((c) => c.tag)
    expect(tags).toEqual(expect.arrayContaining(['KM2', 'H2']))
    expect(tags).not.toContain('KM1')
    expect(second.components.filter((c) => c.type === 'contact').every((c) => c.ref === 'KM2')).toBe(true)
    const s = { components: [...first.components, ...second.components], wires: [...first.wires, ...second.wires] }
    const s1 = first.components.find((c) => c.type === 'pushbutton' && c.contact === 'NO').id
    let st = elecAction(s, elecInit(), s1, 'press')
    st = elecStep(s, st, {}, 0.05).state
    expect(st.coils.KM1).toBe(true)
    expect(st.coils.KM2).toBe(false)
  })
})
