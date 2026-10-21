// Cuaderno de prácticas (Exportar > Entregar varias prácticas): las prácticas de un alumno en un
// solo PDF, con una portada común, el índice, una hoja resumen y, después, cada práctica con las
// secciones de su dossier (lib/dossier.js: dossierBody), numeradas 1.1, 1.2… Cada proyecto va
// dentro del PDF como adjunto (components/NotebookDialog.jsx), como en el dossier.
// Como el dossier, describe las páginas: de ahí salen la vista previa y el PDF.
import { COVER_FIELDS, dossierBody } from './dossier'
import { INK, M, MUTED, PAGES, RULE, fit, pageWriter } from './pageWriter'

// «Práctica 4. Cinta…» -> «Cinta…»: el número ya lo pone el cuaderno.
export const notebookTitle = (title) => (title || 'Práctica').replace(/^(Práctica|Practice|Pratique|Prática)\s*(nº\s*)?\d+\s*(\([^)]*\))?\s*[.:-]\s*/i, '')

// Número de práctica que lleva el título («Práctica 3…», «P3 …», «Ejercicio 3»), para ordenar.
export function practiceNumber(title) {
  const m = String(title ?? '').match(/^\s*(?:pr[aá]ctica|practice|pratique|ejercicio|exercise|p)\s*(?:n[ºo°.]\s*)?(\d+)/i)
  return m ? Number(m[1]) : null
}

// Orden por número de práctica (las que no lo llevan, al final, en el orden en que estaban).
export function sortByNumber(list, titleOf) {
  return list
    .map((p, i) => ({ p, i, n: practiceNumber(titleOf(p)) }))
    .sort((a, b) => (a.n ?? Infinity) - (b.n ?? Infinity) || a.i - b.i)
    .map((x) => x.p)
}

// content: { today, page: 'a4' | 'a3', compact (las secciones siguen en la misma página si caben),
//   cover: {campos de COVER_FIELDS},
//   practices: [{ title, content (el del dossier), options (las del dossier), summary: { passed,
//   total (autocorrección; total 0 si no es un ejercicio), errors, warnings } }] }
export function buildNotebook(content, measure) {
  const w = pageWriter(measure, PAGES[content.page] ?? PAGES.a4)
  const { pages, text } = w
  const practices = content.practices

  // Portada
  const cover = w.newPage()
  text('Cuaderno de prácticas', cover.w / 2, 80, 24, 'bold', { align: 'center' })
  text(`Grafcet (IEC 60848) · ${practices.length === 1 ? '1 práctica' : `${practices.length} prácticas`}`, cover.w / 2, 92, 12, 'normal', { align: 'center', color: MUTED })
  let yy = 130
  for (const f of COVER_FIELDS) {
    const value = f.id === 'date' ? content.cover.date || content.today : content.cover[f.id]
    if (!value?.trim()) continue
    text(f.label, cover.w / 2 - 55, yy, 10, 'normal', { color: MUTED })
    text(fit(value, 75, 12, 'bold', measure), cover.w / 2 - 15, yy, 12, 'bold')
    w.push({ t: 'line', x1: cover.w / 2 - 55, y1: yy + 3, x2: cover.w / 2 + 60, y2: yy + 3, width: 0.15, color: RULE })
    yy += 11
  }
  text('Generado con Grafcet Editor', cover.w / 2, cover.h - 25, 8, 'normal', { align: 'center', color: MUTED })

  // Índice (se rellena al final, con la página de cada práctica) y resumen.
  const tocPage = w.newPage()
  w.newPage()
  text('Resumen', M.left, w.y + 6, 16, 'bold')
  w.rule(w.y + 9)
  w.y += 15
  w.table(
    [
      { label: 'Nº', width: 0.08 },
      { label: 'Práctica', width: 0.5 },
      { label: 'Autocorrección', width: 0.2 },
      { label: 'Verificación IEC 60848', width: 0.22 },
    ],
    practices.map((p, i) => {
      const s = p.summary ?? {}
      const verification = !s.errors && !s.warnings ? 'Conforme' : [s.errors ? `${s.errors} ${s.errors === 1 ? 'error' : 'errores'}` : '', s.warnings ? `${s.warnings} ${s.warnings === 1 ? 'aviso' : 'avisos'}` : ''].filter(Boolean).join(', ')
      return [String(i + 1), notebookTitle(p.title), s.total ? `${s.passed} de ${s.total}` : '—', verification]
    }),
  )
  w.y += 2
  w.paragraph([{ text: 'Autocorrección: criterios del ejercicio que se cumplen al generar el cuaderno («—»: la práctica no es un ejercicio con autocorrección). Cada práctica va dentro de este PDF como archivo adjunto: se abre en el editor de Grafcet (Abrir > Abrir archivo).' }], 9)

  // Prácticas
  const starts = []
  practices.forEach((p, i) => {
    const n = i + 1
    w.newPage()
    starts.push(pages.length)
    text(`PRÁCTICA Nº ${n}`, M.left, w.y + 5, 12, 'bold', { color: MUTED })
    text(fit(notebookTitle(p.title), w.width(), 16, 'bold', measure), M.left, w.y + 13, 16, 'bold')
    w.rule(w.y + 16)
    w.y += 22
    // La primera sección empieza en la página del título; las demás, cada una en la suya (o,
    // juntas, a continuación si cabe el título con algo debajo). Las apaisadas, siempre aparte.
    let fresh = true
    let k = 0
    const heading = (title, { landscape = false } = {}) => {
      if (landscape || (!fresh && !content.compact)) w.newPage(landscape)
      else if (!fresh) {
        w.y += 6
        w.ensure(50)
      }
      fresh = false
      k++
      text(`${n}.${k}. ${title}`, M.left, w.y + 6, 14, 'bold')
      w.rule(w.y + 9, 0.3)
      w.y += 14
    }
    dossierBody(w, p.content, p.options, measure, heading)
  })

  // Índice
  const items = tocPage.items
  items.push({ t: 'text', x: M.left, y: M.top + 6, text: 'Índice', size: 16, style: 'bold', font: 'helvetica', color: INK })
  items.push({ t: 'line', x1: M.left, y1: M.top + 9, x2: tocPage.w - M.right, y2: M.top + 9, width: 0.4, color: INK })
  const entries = [{ title: 'Resumen', page: 3 }, ...practices.map((p, i) => ({ title: `Práctica nº ${i + 1}. ${notebookTitle(p.title)}`, page: starts[i] }))]
  entries.forEach((e, i) => {
    const y = M.top + 22 + i * 8
    const label = fit(e.title, tocPage.w - M.left - M.right - 20, 11, 'normal', measure)
    items.push({ t: 'text', x: M.left, y, text: label, size: 11, style: 'normal', font: 'helvetica', color: INK })
    items.push({ t: 'text', x: tocPage.w - M.right, y, text: String(e.page), size: 11, style: 'normal', font: 'helvetica', color: INK, align: 'right' })
    items.push({ t: 'line', x1: M.left + measure(label, 11, 'normal', 'helvetica') + 2, y1: y, x2: tocPage.w - M.right - 8, y2: y, width: 0.15, color: RULE, dash: true })
  })

  w.footer(
    ['Cuaderno de prácticas', content.cover.student].filter((v) => v?.trim()).join(' · '),
    (i, total) => `página ${i} de ${total}`,
    (i) => i === 0,
  )
  return { pages, starts }
}
