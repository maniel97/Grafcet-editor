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
import { INK, M, MUTED, PAGES, PT, RULE, fit, pageWriter } from './pageWriter'

export { wrapSpans } from './pageWriter'

export const DOSSIER_SECTIONS = [
  { id: 'cover', label: 'Portada' },
  { id: 'toc', label: 'Índice' },
  { id: 'statement', label: 'Enunciado / memoria' },
  { id: 'theory', label: 'Contenido teórico' },
  { id: 'grafcet', label: 'Grafcet' },
  { id: 'variables', label: 'Tabla de variables' },
  { id: 'verification', label: 'Verificación IEC 60848' },
  { id: 'ladder', label: 'Ladder' },
  { id: 'plant', label: 'Planta virtual' },
  { id: 'electrical', label: 'Esquema eléctrico' },
  { id: 'chronogram', label: 'Cronograma' },
  { id: 'spacePhase', label: 'Diagrama espacio-fase' },
  { id: 'improvements', label: 'Mejoras y aportaciones' },
  { id: 'problems', label: 'Problemas encontrados y cómo se resolvieron' },
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
  sections: { cover: true, toc: true, statement: true, theory: true, improvements: true, problems: true, grafcet: true, variables: true, verification: true, ladder: true, plant: true, electrical: true, chronogram: true, spacePhase: true, notes: false },
  cover: {},
  statement: '',
  // Apartados de texto que suelen pedir los guiones de prácticas (salen si tienen algo escrito).
  theory: '',
  improvements: '',
  problems: '',
  ladderListing: '',
  scenario: '',
}

export const dossierOptions = (saved) => ({
  ...DEFAULT_DOSSIER,
  ...saved,
  sections: { ...DEFAULT_DOSSIER.sections, ...saved?.sections },
  cover: { ...saved?.cover },
})

// --- Maquetación ------------------------------------------------------------------------------

// content: { title, today, cover: {campos}, statement, figures: { grafcet: [fig], ladder, plant,
//   chronogram }, tables: { steps: [[...]], variables: [[...]], plantIO: [[...]] },
//   issues: [{ severity, message }], listing: { title, lines }, notes: [texto] }
// figure: { dataUrl, width, height (px), scene, blocks?, name? }
export function buildDossier(content, options, measure) {
  const w = pageWriter(measure, PAGES[options.page] ?? PAGES.a4)
  const { pages, text, paragraph, richText, figure, table } = w
  const sectionsAt = [] // { title, page }

  let number = 0
  const heading = (title, { landscape = false } = {}) => {
    w.newPage(landscape)
    number++
    sectionsAt.push({ title: `${number}. ${title}`, page: pages.length })
    text(`${number}. ${title}`, M.left, w.y + 6, 16, 'bold')
    w.rule(w.y + 9)
    w.y += 15
  }

  const S = options.sections
  // Portada
  if (S.cover) {
    const page = w.newPage()
    text(content.title || 'Práctica de automatización', page.w / 2, 80, 24, 'bold', { align: 'center' })
    text('Dossier de la práctica · Grafcet (IEC 60848)', page.w / 2, 92, 12, 'normal', { align: 'center', color: MUTED })
    let yy = 130
    for (const f of COVER_FIELDS) {
      const value = f.id === 'date' ? content.cover.date || content.today : content.cover[f.id]
      if (!value?.trim()) continue
      text(f.label, page.w / 2 - 55, yy, 10, 'normal', { color: MUTED })
      text(fit(value, 75, 12, 'bold', measure), page.w / 2 - 15, yy, 12, 'bold')
      w.push({ t: 'line', x1: page.w / 2 - 55, y1: yy + 3, x2: page.w / 2 + 60, y2: yy + 3, width: 0.15, color: RULE })
      yy += 11
    }
    text('Generado con Grafcet Editor', page.w / 2, page.h - 25, 8, 'normal', { align: 'center', color: MUTED })
  }
  // Índice: una página reservada; se rellena al final.
  let tocPage = null
  if (S.toc) tocPage = w.newPage()
  if (S.statement && content.statement?.trim()) {
    heading('Enunciado')
    richText(content.statement)
  }
  if (S.theory && content.theory?.trim()) {
    heading('Contenido teórico')
    richText(content.theory)
  }
  if (S.grafcet && content.figures.grafcet?.length) {
    const sheets = content.figures.grafcet
    sheets.forEach((fig, i) => {
      const wide = fig.width > fig.height * 1.25
      if (i === 0) heading('Grafcet', { landscape: wide })
      else w.newPage(wide)
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
      w.y += 2
      for (const issue of problems) {
        w.ensure(6)
        text(issue.severity === 'error' ? 'Error' : 'Aviso', M.left, w.y + 3.7, 10, 'bold', { color: issue.severity === 'error' ? [185, 28, 28] : [180, 83, 9] })
        const before = w.y
        paragraph([{ text: issue.message }], 10, 14)
        if (w.y === before) w.y += 5
      }
    }
  }
  if (S.ladder && content.figures.ladder) {
    heading('Ladder')
    figure(content.figures.ladder)
    if (content.listing?.lines?.length) {
      w.ensure(10)
      text(content.listing.title, M.left, w.y + 4, 10, 'bold', { color: MUTED })
      w.y += 7
      const sz = 7.5
      const lh = sz * PT * 1.3
      for (const line of content.listing.lines) {
        w.ensure(lh)
        w.push({ t: 'text', x: M.left, y: w.y + sz * PT, text: fit(line.replace(/\t/g, '  '), w.width(), sz, 'normal', measure, 'courier'), size: sz, style: 'normal', font: 'courier', color: INK })
        w.y += lh
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
  if (S.electrical && content.figures.electrical?.length) {
    heading('Esquema eléctrico')
    for (const fig of content.figures.electrical) figure(fig, { caption: content.figures.electrical.length > 1 ? fig.name : undefined })
  }
  if (S.chronogram && content.figures.chronogram) {
    heading('Cronograma')
    if (content.figures.chronogram.name) paragraph([{ text: `Escenario: ${content.figures.chronogram.name}` }], 10)
    w.y += 2
    figure(content.figures.chronogram)
  }
  // Diagrama espacio-fase: el esperado (la secuencia del proyecto) y el de la planta con el
  // escenario, con el resultado de compararlos.
  if (S.spacePhase && content.figures.spacePhase?.length) {
    heading('Diagrama espacio-fase')
    for (const fig of content.figures.spacePhase) figure(fig, { caption: fig.name })
    if (content.figures.spacePhaseResult) paragraph([{ text: content.figures.spacePhaseResult }], 10)
  }
  if (S.improvements && content.improvements?.trim()) {
    heading('Mejoras y aportaciones')
    richText(content.improvements)
  }
  if (S.problems && content.problems?.trim()) {
    heading('Problemas encontrados y cómo se resolvieron')
    richText(content.problems)
  }
  // Datos del proceso de un ejercicio que los pide: siempre a la vista, en su propia página.
  if (content.process) {
    const p = content.process
    heading('Datos del proceso')
    paragraph([{ text: 'El ejercicio pedía anotar estos datos (solo totales, nunca lo que se hace en cada momento). Los ha anotado el editor mientras se hacía el ejercicio.' }], 10)
    w.y += 2
    table(
      [
        { label: 'Dato', width: 0.6 },
        { label: 'Total', width: 0.4 },
      ],
      [
        ['Ejercicio', p.title || '—'],
        ['Veces que se ha comprobado', String(p.checks ?? 0)],
        ['Minutos con actividad', String(p.minutes ?? 0)],
        ['Simulaciones', String(p.simulations ?? 0)],
        ['Pistas vistas', p.hintsTotal ? `${p.hintsShown ?? 0} de ${p.hintsTotal}` : 'sin pistas'],
        ['Última comprobación', p.lastTotal ? `${p.lastPassed} de ${p.lastTotal} correctas` : 'ninguna'],
      ],
    )
  }
  if (S.notes && content.notes?.length) {
    heading('Notas del lienzo')
    content.notes.forEach((n, i) => {
      if (i) {
        w.ensure(6)
        w.push({ t: 'line', x1: M.left, y1: w.y + 2, x2: M.left + 40, y2: w.y + 2, width: 0.2, color: RULE })
        w.y += 5
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
      items.push({ t: 'line', x1: M.left + measure(s.title, 11, 'normal', 'helvetica') + 2, y1: yy, x2: tocPage.w - M.right - 8, y2: yy, width: 0.15, color: RULE, dash: true })
    })
  }
  // Pie de página (salvo la portada)
  w.footer(
    [content.title, content.cover.student].filter((v) => v?.trim()).join(' · '),
    (i, total) => `página ${i} de ${total}`,
    (i) => S.cover && i === 0,
  )
  return { pages, sections: sectionsAt }
}
