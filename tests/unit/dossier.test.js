import { describe, expect, it } from 'vitest'
import { buildDossier, dossierOptions, wrapSpans } from '../../src/lib/dossier'

// Medida aproximada (mm): 0,18 × tamaño por carácter (como Helvetica de media).
const measure = (text, size) => String(text).length * size * 0.18
const texts = (page) => page.items.filter((i) => i.t === 'text').map((i) => i.text)
const base = {
  title: 'Taladradora',
  today: '03/10/2026',
  cover: { student: 'Ana', subject: 'Automatismos' },
  statement: '',
  figures: { grafcet: [], ladder: null, plant: null, chronogram: null },
  tables: { steps: [], variables: [], plantIO: [] },
  issues: [],
  notes: [],
}

describe('dossier: maquetación', () => {
  it('ajusta el texto al ancho, con negrita y variables', () => {
    const lines = wrapSpans([{ text: 'uno dos tres ' }, { text: 'cuatro', bold: true }, { text: ' cinco seis' }], 30, 10, measure)
    expect(lines.map((l) => l.map((s) => s.text).join(''))).toEqual(['uno dos tres', 'cuatro cinco', 'seis'])
    expect(lines[1][0]).toMatchObject({ text: 'cuatro', bold: true, x: 0 })
  })

  it('portada, índice con sus páginas, enunciado largo y pie «página X de Y»', () => {
    const statement = `# Enunciado\n${'Una frase bastante larga que ocupa espacio en la página. '.repeat(120)}`
    const { pages, sections } = buildDossier({ ...base, statement }, dossierOptions({ sections: { verification: true } }), measure)
    expect(texts(pages[0])).toContain('Taladradora') // portada
    expect(texts(pages[0])).toContain('Automatismos')
    expect(texts(pages[0]).some((t) => t.startsWith('página'))).toBe(false) // la portada, sin pie
    expect(sections.map((s) => [s.title, s.page])).toEqual([
      ['1. Enunciado', 3],
      ['2. Verificación IEC 60848', sections[1].page],
    ])
    expect(sections[1].page).toBeGreaterThan(3) // el enunciado ocupa más de una página
    expect(texts(pages[1])).toContain('1. Enunciado') // índice
    expect(texts(pages[1])).toContain('3')
    expect(texts(pages.at(-1))).toContain(`página ${pages.length} de ${pages.length}`)
    expect(texts(pages.at(-1)).join('')).toContain('El grafcet es conforme: la verificación no ha encontrado errores ni avisos.')
  })

  it('una figura alta se trocea entre páginas por los bloques (segmentos del ladder)', () => {
    const blocks = Array.from({ length: 40 }, (_, i) => ({ top: i * 100, bottom: i * 100 + 90 }))
    const ladder = { width: 600, height: 4000, blocks, dataUrl: '' }
    const { pages } = buildDossier({ ...base, figures: { ...base.figures, ladder } }, dossierOptions({ sections: { cover: false, toc: false, verification: false } }), measure)
    const parts = pages.flatMap((p) => p.items.filter((i) => i.t === 'figure'))
    expect(parts.length).toBeGreaterThan(2)
    expect(parts[0].top).toBe(0)
    expect(parts.at(-1).bottom).toBe(4000)
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].top).toBe(parts[i - 1].bottom) // sin huecos ni solapes
      expect(blocks.some((b) => b.bottom === parts[i].top)).toBe(true) // corte entre segmentos
    }
  })

  it('una figura algo más alta que la página se reduce para caber en una', () => {
    const grafcet = [{ width: 500, height: 1150, dataUrl: '' }]
    const { pages } = buildDossier({ ...base, figures: { ...base.figures, grafcet } }, dossierOptions({ sections: { cover: false, toc: false, verification: false } }), measure)
    const parts = pages.flatMap((p) => p.items.filter((i) => i.t === 'figure'))
    expect(parts).toHaveLength(1)
    expect(parts[0].scale).toBeLessThan(1)
  })

  it('tablas largas: siguen en la página siguiente repitiendo la cabecera', () => {
    const variables = Array.from({ length: 70 }, (_, i) => [`V${i}`, 'Entrada', `I${i}.0`, ''])
    const { pages } = buildDossier({ ...base, tables: { ...base.tables, variables } }, dossierOptions({ sections: { cover: false, toc: false, verification: false } }), measure)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.filter((p) => texts(p).includes('Símbolo'))).toHaveLength(pages.length)
    expect(texts(pages.at(-1))).toContain('V69')
  })
})
