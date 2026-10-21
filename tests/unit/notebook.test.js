import { describe, expect, it } from 'vitest'
import { dossierOptions } from '../../src/lib/dossier'
import { buildNotebook, notebookTitle, practiceNumber, sortByNumber } from '../../src/lib/notebook'
import { pickSubmissions } from '../../src/lib/classReview'
import { withNotebookCover } from '../../src/lib/notebookContent'
import { pageWriter } from '../../src/lib/pageWriter'

const measure = (text, size) => String(text).length * size * 0.18
const texts = (page) => page.items.filter((i) => i.t === 'text').map((i) => i.text)
const practice = (title, statement, summary = { passed: 0, total: 0, errors: 0, warnings: 0 }) => ({
  title,
  summary,
  options: dossierOptions({ sections: { verification: true } }),
  content: {
    title,
    today: '21/10/2026',
    cover: {},
    statement,
    figures: { grafcet: [], ladder: null, plant: null, chronogram: null },
    tables: { steps: [['X0', 'M0.0', 'Reposo']], variables: [['Marcha', 'Entrada', 'I0.0', '']], plantIO: [] },
    issues: [],
    notes: [],
  },
})

describe('cuaderno de prácticas', () => {
  it('número de práctica del título, orden y título sin el número', () => {
    expect(practiceNumber('Práctica 3. Cinta')).toBe(3)
    expect(practiceNumber('Práctica nº 12: Semáforo')).toBe(12)
    expect(practiceNumber('P4 Taladro')).toBe(4)
    expect(practiceNumber('Ejercicio 2')).toBe(2)
    expect(practiceNumber('Semáforo')).toBe(null)
    const list = ['Semáforo', 'Práctica 3. C', 'Práctica 1. A', 'Práctica 2. B']
    expect(sortByNumber(list, (x) => x)).toEqual(['Práctica 1. A', 'Práctica 2. B', 'Práctica 3. C', 'Semáforo'])
    expect(notebookTitle('Práctica 3. Cinta transportadora')).toBe('Cinta transportadora')
  })

  it('portada común, índice con la página de cada práctica, resumen y secciones numeradas', () => {
    const { pages, starts } = buildNotebook(
      {
        today: '21/10/2026',
        cover: { student: 'Ana López', group: '2º MEC' },
        practices: [practice('Práctica 1. Semáforo', '# Objetivo\nUn semáforo.', { passed: 7, total: 8, errors: 0, warnings: 1 }), practice('Práctica 2. Taladro', 'Un taladro.')],
      },
      measure,
    )
    expect(texts(pages[0])).toEqual(expect.arrayContaining(['Cuaderno de prácticas', 'Grafcet (IEC 60848) · 2 prácticas', 'Ana López', '2º MEC']))
    // Índice: el resumen y cada práctica con su página.
    const toc = texts(pages[1])
    expect(toc).toEqual(expect.arrayContaining(['Índice', 'Resumen', '3', 'Práctica nº 1. Semáforo', 'Práctica nº 2. Taladro', String(starts[0]), String(starts[1])]))
    // Resumen: autocorrección y verificación de cada una.
    const summary = texts(pages[2])
    expect(summary).toEqual(expect.arrayContaining(['Resumen', 'Semáforo', '7 de 8', '1 aviso', 'Taladro', '—', 'Conforme']))
    // Cada práctica empieza con su título y su primera sección en la misma página.
    const first = texts(pages[starts[0] - 1])
    expect(first).toEqual(expect.arrayContaining(['PRÁCTICA Nº 1', 'Semáforo', '1.1. Enunciado']))
    const all = pages.flatMap(texts)
    expect(all).toEqual(expect.arrayContaining(['1.2. Tabla de variables', '1.3. Verificación IEC 60848', '2.1. Enunciado']))
    // Pie en todas menos la portada.
    expect(all.filter((s) => /^página \d+ de \d+$/.test(s))).toHaveLength(pages.length - 1)
    expect(all).toContain('Cuaderno de prácticas · Ana López')
  })
})

describe('cuaderno de prácticas: secciones juntas', () => {
  it('con compact, las secciones siguen en la misma página y salen menos páginas', () => {
    const content = (compact) => ({ today: '21/10/2026', compact, cover: {}, practices: [practice('Práctica 1. Semáforo', 'Un semáforo.'), practice('Práctica 2. Taladro', 'Un taladro.')] })
    const apart = buildNotebook(content(false), measure)
    const together = buildNotebook(content(true), measure)
    expect(together.pages.length).toBeLessThan(apart.pages.length)
    const first = texts(together.pages[together.starts[0] - 1])
    expect(first).toEqual(expect.arrayContaining(['1.1. Enunciado', '1.2. Tabla de variables', '1.3. Verificación IEC 60848']))
    // Cada práctica sigue empezando en su página.
    expect(texts(together.pages[together.starts[1] - 1])).toContain('PRÁCTICA Nº 2')
  })
})

describe('cuaderno de prácticas: corrección', () => {
  const ex = (title, sealed) => ({ file: `${title}.json`, project: { nodes: [], edges: [], plc: { exercise: { student: true, title, sealed } } } })
  it('con el ejercicio abierto, de un cuaderno se corrige solo esa práctica', () => {
    const items = [ex('Práctica 1', 'aaa'), ex('Práctica 2', 'bbb'), ex('Práctica 3', 'ccc')]
    expect(pickSubmissions(items, { title: 'Práctica 2', sealed: 'bbb' }).items.map((i) => i.project.plc.exercise.title)).toEqual(['Práctica 2'])
    // Mismas comprobaciones aunque el título haya cambiado.
    expect(pickSubmissions(items, { title: 'Otro título', sealed: 'ccc' }).items).toHaveLength(1)
    const none = pickSubmissions(items, { title: 'Práctica 9', sealed: 'zzz' })
    expect(none.items).toEqual([])
    expect(none.error).toMatch(/Práctica 1, Práctica 2, Práctica 3/)
    // Una sola entrega o sin ejercicio abierto: como siempre.
    expect(pickSubmissions([items[0]], { title: 'Práctica 2', sealed: 'bbb' }).items).toHaveLength(1)
    expect(pickSubmissions(items, null).items).toHaveLength(3)
  })

  it('el proyecto adjunto toma de la portada del cuaderno lo que le falte', () => {
    const project = { nodes: [], edges: [], plc: { dossier: { cover: { group: '1º A' } } } }
    const out = withNotebookCover(project, { student: 'Ana', group: '2º B', course: '' })
    expect(out.plc.dossier.cover).toEqual({ group: '1º A', student: 'Ana' })
  })
})

describe('cuaderno de prácticas: títulos y secciones', () => {
  const pageOf = (pages, pred) => pages.findIndex((p) => p.items.some(pred))
  const tall = (heightPx) => ({ dataUrl: '', width: 600, height: heightPx, scene: null })
  const withLadder = (rows, heightPx) => {
    const p = practice('Práctica 1. Prensa', '')
    p.content.tables.variables = Array.from({ length: rows }, (_, i) => [`V${i}`, 'Entrada', `I${i}.0`, ''])
    p.content.figures.ladder = tall(heightPx)
    return p
  }

  it('el título nunca queda solo al pie: va a la página de su dibujo', () => {
    for (const rows of [10, 20, 28, 34]) {
      for (const h of [300, 600, 800, 1500]) {
        const { pages } = buildNotebook({ today: '', compact: true, cover: {}, practices: [withLadder(rows, h)] }, measure)
        const head = pageOf(pages, (i) => i.t === 'text' && /^1\.\d+\. Ladder$/.test(i.text))
        const fig = pageOf(pages, (i) => i.t === 'figure')
        expect(head, `${rows} filas, ${h} px`).toBe(fig)
      }
    }
  })

  it('un dibujo que casi cabe se reduce un poco en vez de saltar de página', () => {
    const place = (room) => {
      const w = pageWriter(measure)
      w.newPage()
      w.y = w.bottom() - room
      w.figure(tall(760)) // unos 201 mm de alto a 1:1
      return { pages: w.pages.length, fig: w.pages.flatMap((p) => p.items).find((i) => i.t === 'figure') }
    }
    const near = place(180) // cabe al 90 %: se reduce y se queda
    expect(near.pages).toBe(1)
    expect(near.fig.scale).toBeCloseTo(180 / 201.1, 1)
    const far = place(120) // haría falta reducirla al 60 %: a la página siguiente, entera
    expect(far.pages).toBe(2)
    expect(far.fig.scale).toBe(1)
  })

  it('las secciones elegidas valen para todas las prácticas', () => {
    const content = { today: '', compact: true, cover: {}, practices: [practice('Práctica 1. A', 'Uno.'), practice('Práctica 2. B', 'Dos.')] }
    const all = buildNotebook({ ...content, sections: { ...dossierOptions().sections, verification: false } }, measure).pages.flatMap(texts)
    expect(all.some((s) => /Verificación IEC 60848$/.test(s) && /^\d+\.\d+\./.test(s))).toBe(false)
    expect(all).toEqual(expect.arrayContaining(['1.1. Enunciado', '2.2. Tabla de variables']))
  })
})
