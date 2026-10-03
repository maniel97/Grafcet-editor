// Dossier de la práctica: un PDF con portada, índice, enunciado, grafcet, tabla de variables,
// verificación, ladder, planta, cronograma y notas.
//
// buildDossier() describe las páginas (mm) y de esa descripción salen la vista previa
// (components/DossierPreview.jsx) y el PDF (lib/dossierPdf.js): lo que se ve es lo que sale.
// Elementos de una página:
//   { t: 'text', x, y, text, size, style: 'normal' | 'bold', font: 'helvetica' | 'courier', color, align }
//   { t: 'line', x1, y1, x2, y2, width, color }
//   { t: 'rect', x, y, w, h, fill, stroke }
//   { t: 'figure', x, y, w, h, figure, top, bottom, scale }  (franja [top, bottom] px de la figura)
// La medida del texto la da quien llama (measure(text, size, style, font) -> mm), normalmente jsPDF.
import { parseNote } from './notes'

export const DOSSIER_SECTIONS = [
  { id: 'cover', label: 'Portada' },
  { id: 'toc', label: 'Índice' },
  { id: 'statement', label: 'Enunciado / memoria' },
  { id: 'grafcet', label: 'Grafcet' },
  { id: 'variables', label: 'Tabla de variables' },
  { id: 'verification', label: 'Verificación IEC 60848' },
  { id: 'ladder', label: 'Ladder' },
  { id: 'plant', label: 'Planta virtual' },
  { id: 'chronogram', label: 'Cronograma' },
  { id: 'notes', label: 'Notas del lienzo' },
]

export const COVER_FIELDS = [
  { id: 'subject', label: 'Asignatura' },
  { id: 'student', label: 'Alumno/a' },
  { id: 'group', label: 'Grupo' },
  { id: 'course', label: 'Curso' },
  { id: 'teacher', label: 'Profesor/a' },
  { id: 'date', label: 'Fecha' },
]

export const LADDER_LISTINGS = [
  { id: '', label: 'Solo el esquema' },
  { id: 'st', label: 'Y texto estructurado (ST)' },
  { id: 'awl', label: 'Y AWL / STL (S7)' },
  { id: 's7200', label: 'Y STL S7-200 (Micro/WIN)' },
]

export const DEFAULT_DOSSIER = {
  page: 'a4',
  sections: { cover: true, toc: true, statement: true, grafcet: true, variables: true, verification: true, ladder: true, plant: true, chronogram: true, notes: false },
  cover: {},
  statement: '',
  ladderListing: '',
  scenario: '',
}

export const dossierOptions = (saved) => ({
  ...DEFAULT_DOSSIER,
  ...saved,
  sections: { ...DEFAULT_DOSSIER.sections, ...saved?.sections },
  cover: { ...saved?.cover },
})

const PAGES = { a4: [210, 297], a3: [297, 420] }
const PX_TO_MM = 25.4 / 96
const M = { left: 18, right: 18, top: 18, bottom: 20 } // márgenes (abajo, el pie)
const INK = [15, 23, 42]
const MUTED = [100, 116, 139]
const LINE = 1.35 // interlineado (× tamaño en mm)
const PT = 0.3528 // 1 pt en mm

// Texto con formato (spans: [{ text, bold, code }]) en líneas de un ancho máximo.
export function wrapSpans(spans, maxWidth, size, measure) {
  const words = []
  for (const s of spans) {
    const parts = s.text.split(/(\s+)/)
    for (const p of parts) if (p) words.push({ text: p, bold: s.bold, code: s.code })
  }
  const lines = []
  let line = []
  let width = 0
  const w = (word) => measure(word.text, size, word.bold ? 'bold' : 'normal', word.code ? 'courier' : 'helvetica')
  for (const word of words) {
    const ww = w(word)
    if (/^\s+$/.test(word.text)) {
      if (line.length) {
        line.push(word)
        width += ww
      }
      continue
    }
    if (width + ww > maxWidth && line.length) {
      while (line.length && /^\s+$/.test(line.at(-1).text)) line.pop()
      lines.push(line)
      line = []
      width = 0
    }
    line.push(word)
    width += ww
  }
  if (line.length) lines.push(line)
  return lines.map((ws) => {
    let x = 0
    return ws.map((word) => {
      const seg = { ...word, x }
      x += w(word)
      return seg
    })
  })
}

// Recorta un texto con «…» para que quepa.
function fit(text, maxWidth, size, style, measure, font = 'helvetica') {
  let t = String(text ?? '')
  if (measure(t, size, style, font) <= maxWidth) return t
  while (t.length > 1 && measure(`${t}…`, size, style, font) > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

// --- Maquetación ------------------------------------------------------------------------------

// content: { title, today, cover: {campos}, statement, figures: { grafcet: [fig], ladder, plant,
//   chronogram }, tables: { steps: [[...]], variables: [[...]], plantIO: [[...]] },
//   issues: [{ severity, message }], listing: { title, lines }, notes: [texto] }
// figure: { dataUrl, width, height (px), scene, blocks?, name? }
export function buildDossier(content, options, measure) {
  const [PW, PH] = PAGES[options.page] ?? PAGES.a4
  const pages = []
  const sectionsAt = [] // { title, page }
  let page = null
  let y = 0
  let size = { w: PW, h: PH }
  const W = () => size.w - M.left - M.right
  const bottom = () => size.h - M.bottom
  const newPage = (landscape = false) => {
    size = landscape ? { w: PH, h: PW } : { w: PW, h: PH }
    page = { w: size.w, h: size.h, items: [] }
    pages.push(page)
    y = M.top
    return page
  }
  const ensure = (h) => {
    if (!page || y + h > bottom()) newPage()
  }
  const text = (t, x, yy, sz, style = 'normal', extra = {}) => page.items.push({ t: 'text', x, y: yy, text: t, size: sz, style, font: 'helvetica', color: INK, ...extra })

  let number = 0
  const heading = (title, { landscape = false } = {}) => {
    newPage(landscape)
    number++
    sectionsAt.push({ title: `${number}. ${title}`, page: pages.length })
    text(`${number}. ${title}`, M.left, y + 6, 16, 'bold')
    page.items.push({ t: 'line', x1: M.left, y1: y + 9, x2: size.w - M.right, y2: y + 9, width: 0.4, color: INK })
    y += 15
  }
  const paragraph = (spans, sz = 10.5, indent = 0) => {
    const lh = sz * PT * LINE
    for (const line of wrapSpans(spans, W() - indent, sz, measure)) {
      ensure(lh)
      for (const seg of line) {
        page.items.push({ t: 'text', x: M.left + indent + seg.x, y: y + sz * PT, text: seg.text, size: sz, style: seg.bold ? 'bold' : 'normal', font: seg.code ? 'courier' : 'helvetica', color: INK })
      }
      y += lh
    }
  }
  const richText = (source) => {
    for (const b of parseNote(source)) {
      if (b.kind === 'blank') y += 2.5
      else if (b.kind === 'title') {
        ensure(9)
        y += 1
        paragraph(b.spans.map((s) => ({ ...s, bold: true })), 12.5)
        y += 1
      } else if (b.kind === 'item') {
        const lh = 10.5 * PT * LINE
        ensure(lh)
        text('•', M.left + 1.5, y + 10.5 * PT, 10.5)
        paragraph(b.spans, 10.5, 6)
      } else paragraph(b.spans)
    }
  }
  // Figura: a la escala que quepa a lo ancho (máx. 1:1), troceada entre páginas si es alta. Los
  // cortes, entre bloques (segmentos del ladder) si la figura los tiene.
  const figure = (fig, { minScale = 0.45, caption } = {}) => {
    if (!fig) return
    if (caption) {
      ensure(8)
      text(caption, M.left, y + 4, 10, 'bold', { color: MUTED })
      y += 7
    }
    // Escala: 1:1 como máximo y a lo ancho de la página; si así no cabe en una página, se reduce
    // hasta caber (sin bajar de minScale: más pequeño no se lee y se trocea).
    const hmm = fig.height * PX_TO_MM
    const room = bottom() - M.top - 15
    let scale = Math.min(1, W() / (fig.width * PX_TO_MM))
    if (hmm * scale > room && room / hmm >= minScale) scale = room / hmm
    const kk = scale * PX_TO_MM
    // Si cabe entera en una página pero no en lo que queda de esta, a la siguiente.
    if (fig.height * kk <= room && y + fig.height * kk > bottom()) newPage()
    let top = 0
    while (top < fig.height - 0.5) {
      let available = (bottom() - y) / kk
      if (available < 40 / kk) {
        newPage()
        available = (bottom() - y) / kk
      }
      let end = Math.min(fig.height, top + available)
      if (end < fig.height && fig.blocks?.length) {
        // Corte en el último final de bloque que quepa.
        const cut = fig.blocks.map((b) => b.bottom).filter((b) => b > top + 10 && b <= end).sort((a, b) => b - a)[0]
        if (cut) end = cut
      }
      const h = (end - top) * kk
      page.items.push({ t: 'figure', x: M.left + (W() - fig.width * kk) / 2, y, w: fig.width * kk, h, figure: fig, top, bottom: end, scale })
      y += h + 4
      top = end
      if (top < fig.height - 0.5) newPage()
    }
  }
  // Tabla: columnas { label, width (fracción) }; filas de texto.
  const table = (columns, rows, { mono = [] } = {}) => {
    const sz = 9
    const rh = 6
    const widths = columns.map((c) => c.width * W())
    const head = () => {
      ensure(rh * 2)
      page.items.push({ t: 'rect', x: M.left, y, w: W(), h: rh, fill: [241, 245, 249] })
      let x = M.left
      columns.forEach((c, i) => {
        text(fit(c.label, widths[i] - 2, sz, 'bold', measure), x + 1, y + 4.2, sz, 'bold')
        x += widths[i]
      })
      y += rh
    }
    head()
    for (const row of rows) {
      if (y + rh > bottom()) {
        newPage()
        head()
      }
      let x = M.left
      row.forEach((cell, i) => {
        const font = mono.includes(i) ? 'courier' : 'helvetica'
        page.items.push({ t: 'text', x: x + 1, y: y + 4.2, text: fit(cell, widths[i] - 2, sz, 'normal', measure, font), size: sz, style: 'normal', font, color: INK })
        x += widths[i]
      })
      page.items.push({ t: 'line', x1: M.left, y1: y + rh, x2: M.left + W(), y2: y + rh, width: 0.15, color: [203, 213, 225] })
      y += rh
    }
    y += 4
  }

  const S = options.sections
  // Portada
  if (S.cover) {
    newPage()
    text(content.title || 'Práctica de automatización', size.w / 2, 80, 24, 'bold', { align: 'center' })
    text('Dossier de la práctica · Grafcet (IEC 60848)', size.w / 2, 92, 12, 'normal', { align: 'center', color: MUTED })
    let yy = 130
    for (const f of COVER_FIELDS) {
      const value = f.id === 'date' ? content.cover.date || content.today : content.cover[f.id]
      if (!value?.trim()) continue
      text(f.label, size.w / 2 - 55, yy, 10, 'normal', { color: MUTED })
      text(fit(value, 75, 12, 'bold', measure), size.w / 2 - 15, yy, 12, 'bold')
      page.items.push({ t: 'line', x1: size.w / 2 - 55, y1: yy + 3, x2: size.w / 2 + 60, y2: yy + 3, width: 0.15, color: [203, 213, 225] })
      yy += 11
    }
    text('Generado con Grafcet Editor', size.w / 2, size.h - 25, 8, 'normal', { align: 'center', color: MUTED })
  }
  // Índice: una página reservada; se rellena al final.
  let tocPage = null
  if (S.toc) {
    newPage()
    tocPage = page
  }
  if (S.statement && content.statement?.trim()) {
    heading('Enunciado')
    richText(content.statement)
  }
  if (S.grafcet && content.figures.grafcet?.length) {
    const sheets = content.figures.grafcet
    sheets.forEach((fig, i) => {
      const wide = fig.width > fig.height * 1.25
      if (i === 0) heading('Grafcet', { landscape: wide })
      else newPage(wide)
      figure(fig, { caption: sheets.length > 1 ? `Hoja: ${fig.name ?? i + 1}` : null })
    })
  }
  if (S.variables && (content.tables.steps.length || content.tables.variables.length)) {
    heading('Tabla de variables')
    if (content.tables.variables.length) {
      table(
        [
          { label: 'Símbolo', width: 0.22 },
          { label: 'Tipo', width: 0.2 },
          { label: 'Dirección', width: 0.14 },
          { label: 'Comentario / rango', width: 0.44 },
        ],
        content.tables.variables,
        { mono: [0, 2] },
      )
    }
    if (content.tables.steps.length) {
      table(
        [
          { label: 'Etapa', width: 0.22 },
          { label: 'Dirección', width: 0.14 },
          { label: 'Comentario', width: 0.64 },
        ],
        content.tables.steps,
        { mono: [0, 1] },
      )
    }
  }
  if (S.verification) {
    heading('Verificación IEC 60848')
    const problems = content.issues.filter((i) => i.severity === 'error' || i.severity === 'warning')
    if (!problems.length) paragraph([{ text: 'El grafcet es conforme: la verificación no ha encontrado errores ni avisos.', bold: true }])
    else {
      paragraph([{ text: `${problems.filter((i) => i.severity === 'error').length} errores · ${problems.filter((i) => i.severity === 'warning').length} avisos`, bold: true }])
      y += 2
      for (const issue of problems) {
        ensure(6)
        text(issue.severity === 'error' ? 'Error' : 'Aviso', M.left, y + 3.7, 10, 'bold', { color: issue.severity === 'error' ? [185, 28, 28] : [180, 83, 9] })
        const before = y
        paragraph([{ text: issue.message }], 10, 14)
        if (y === before) y += 5
      }
    }
  }
  if (S.ladder && content.figures.ladder) {
    heading('Ladder')
    figure(content.figures.ladder)
    if (content.listing?.lines?.length) {
      ensure(10)
      text(content.listing.title, M.left, y + 4, 10, 'bold', { color: MUTED })
      y += 7
      const sz = 7.5
      const lh = sz * PT * 1.3
      for (const line of content.listing.lines) {
        ensure(lh)
        page.items.push({ t: 'text', x: M.left, y: y + sz * PT, text: fit(line.replace(/\t/g, '  '), W(), sz, 'normal', measure, 'courier'), size: sz, style: 'normal', font: 'courier', color: INK })
        y += lh
      }
    }
  }
  if (S.plant && content.figures.plant) {
    heading('Planta virtual')
    figure(content.figures.plant)
    if (content.tables.plantIO.length) {
      table(
        [
          { label: 'Variable', width: 0.2 },
          { label: 'Dirección', width: 0.14 },
          { label: 'Sentido', width: 0.22 },
          { label: 'Elementos', width: 0.44 },
        ],
        content.tables.plantIO,
        { mono: [0, 1] },
      )
    }
  }
  if (S.chronogram && content.figures.chronogram) {
    heading('Cronograma')
    if (content.figures.chronogram.name) paragraph([{ text: `Escenario: ${content.figures.chronogram.name}` }], 10)
    y += 2
    figure(content.figures.chronogram)
  }
  if (S.notes && content.notes?.length) {
    heading('Notas del lienzo')
    content.notes.forEach((n, i) => {
      if (i) {
        ensure(6)
        page.items.push({ t: 'line', x1: M.left, y1: y + 2, x2: M.left + 40, y2: y + 2, width: 0.2, color: [203, 213, 225] })
        y += 5
      }
      richText(n)
    })
  }

  // Índice
  if (tocPage) {
    const items = tocPage.items
    items.push({ t: 'text', x: M.left, y: M.top + 6, text: 'Índice', size: 16, style: 'bold', font: 'helvetica', color: INK })
    items.push({ t: 'line', x1: M.left, y1: M.top + 9, x2: tocPage.w - M.right, y2: M.top + 9, width: 0.4, color: INK })
    sectionsAt.forEach((s, i) => {
      const yy = M.top + 22 + i * 8
      items.push({ t: 'text', x: M.left, y: yy, text: s.title, size: 11, style: 'normal', font: 'helvetica', color: INK })
      items.push({ t: 'text', x: tocPage.w - M.right, y: yy, text: String(s.page), size: 11, style: 'normal', font: 'helvetica', color: INK, align: 'right' })
      items.push({ t: 'line', x1: M.left + measure(s.title, 11, 'normal', 'helvetica') + 2, y1: yy, x2: tocPage.w - M.right - 8, y2: yy, width: 0.15, color: [203, 213, 225], dash: true })
    })
  }
  // Pie de página (salvo la portada)
  const total = pages.length
  const footer = [content.title, content.cover.student].filter((v) => v?.trim()).join(' · ')
  pages.forEach((p, i) => {
    if (S.cover && i === 0) return
    p.items.push({ t: 'line', x1: M.left, y1: p.h - 13, x2: p.w - M.right, y2: p.h - 13, width: 0.15, color: [203, 213, 225] })
    if (footer) p.items.push({ t: 'text', x: M.left, y: p.h - 9, text: fit(footer, p.w - M.left - M.right - 35, 8, 'normal', measure), size: 8, style: 'normal', font: 'helvetica', color: MUTED })
    p.items.push({ t: 'text', x: p.w - M.right, y: p.h - 9, text: `página ${i + 1} de ${total}`, size: 8, style: 'normal', font: 'helvetica', color: MUTED, align: 'right' })
  })
  return { pages, sections: sectionsAt }
}
