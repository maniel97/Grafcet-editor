// Maquetación de documentos PDF por páginas (mm): lo comparten el dossier de la práctica
// (lib/dossier.js) y la hoja del ejercicio (lib/exerciseSheet.js). Describe las páginas como
// listas de elementos; de esa descripción salen la vista previa y el PDF (lib/dossierPdf.js).
// Elementos de una página:
//   { t: 'text', x, y, text, size, style: 'normal' | 'bold', font: 'helvetica' | 'courier', color, align }
//   { t: 'line', x1, y1, x2, y2, width, color, dash }
//   { t: 'rect', x, y, w, h, fill, stroke }
//   { t: 'figure', x, y, w, h, figure, top, bottom, scale }  (franja [top, bottom] px de la figura)
// La medida del texto la da quien llama (measure(text, size, style, font) -> mm), normalmente jsPDF.
import { parseNote } from './notes'

export const PAGES = { a4: [210, 297], a3: [297, 420] }
export const PX_TO_MM = 25.4 / 96
export const M = { left: 18, right: 18, top: 18, bottom: 20 } // márgenes (abajo, el pie)
export const INK = [15, 23, 42]
export const MUTED = [100, 116, 139]
export const RULE = [203, 213, 225]
const LINE = 1.35 // interlineado (× tamaño en mm)
export const PT = 0.3528 // 1 pt en mm

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
export function fit(text, maxWidth, size, style, measure, font = 'helvetica') {
  let t = String(text ?? '')
  if (measure(t, size, style, font) <= maxWidth) return t
  while (t.length > 1 && measure(`${t}…`, size, style, font) > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

// Escritor de páginas: va colocando texto, tablas y figuras de arriba abajo y abre páginas nuevas
// cuando no cabe. w.y es la altura actual en la página (mm).
export function pageWriter(measure, [PW, PH] = PAGES.a4) {
  const pages = []
  const w = { pages, page: null, y: 0, size: { w: PW, h: PH } }
  w.width = () => w.size.w - M.left - M.right
  w.bottom = () => w.size.h - M.bottom
  w.push = (item) => w.page.items.push(item)
  w.newPage = (landscape = false) => {
    w.size = landscape ? { w: PH, h: PW } : { w: PW, h: PH }
    w.page = { w: w.size.w, h: w.size.h, items: [] }
    pages.push(w.page)
    w.y = M.top
    return w.page
  }
  w.ensure = (h) => {
    if (!w.page || w.y + h > w.bottom()) w.newPage()
  }
  w.text = (t, x, yy, sz, style = 'normal', extra = {}) => w.push({ t: 'text', x, y: yy, text: t, size: sz, style, font: 'helvetica', color: INK, ...extra })
  w.rule = (yy, width = 0.4, color = INK) => w.push({ t: 'line', x1: M.left, y1: yy, x2: w.size.w - M.right, y2: yy, width, color })

  w.paragraph = (spans, sz = 10.5, indent = 0) => {
    const lh = sz * PT * LINE
    for (const line of wrapSpans(spans, w.width() - indent, sz, measure)) {
      w.ensure(lh)
      for (const seg of line) {
        w.push({ t: 'text', x: M.left + indent + seg.x, y: w.y + sz * PT, text: seg.text, size: sz, style: seg.bold ? 'bold' : 'normal', font: seg.code ? 'courier' : 'helvetica', color: INK })
      }
      w.y += lh
    }
  }
  // Texto con el formato de las notas (títulos, listas, negrita, código).
  w.richText = (source) => {
    for (const b of parseNote(source)) {
      if (b.kind === 'blank') w.y += 2.5
      else if (b.kind === 'title') {
        w.ensure(9)
        w.y += 1
        w.paragraph(b.spans.map((s) => ({ ...s, bold: true })), 12.5)
        w.y += 1
      } else if (b.kind === 'item') w.bullet(b.spans)
      else w.paragraph(b.spans)
    }
  }
  w.bullet = (spans, sz = 10.5) => {
    w.ensure(sz * PT * LINE)
    w.text('•', M.left + 1.5, w.y + sz * PT, sz)
    w.paragraph(spans, sz, 6)
  }
  // Subtítulo dentro de la página. keep: alto (mm) de lo que va justo detrás y no debe quedar en
  // otra página (si no cabe con él, los dos pasan a la siguiente).
  w.subheading = (title, sz = 12.5, keep = 0) => {
    w.ensure(14 + Math.min(keep, w.bottom() - M.top - 14))
    w.y += 3
    w.text(title, M.left, w.y + 5, sz, 'bold')
    w.rule(w.y + 7.5, 0.25, RULE)
    w.y += 11
  }
  // maxScale: tope de escala (p. ej. un ladder largo, más pequeño que 1:1 para que ocupe menos páginas).
  const figureScale = (fig, { minScale = 0.45, maxHeight, maxScale = 1 } = {}) => {
    const hmm = fig.height * PX_TO_MM
    const room = Math.min(w.bottom() - M.top - 15, maxHeight ?? Infinity)
    let scale = Math.min(maxScale, w.width() / (fig.width * PX_TO_MM))
    if (hmm * scale > room && room / hmm >= minScale) scale = room / hmm
    return scale
  }
  // Alto (mm) con que saldrá una figura.
  w.figureHeight = (fig, options) => fig.height * PX_TO_MM * figureScale(fig, options)
  // Figura: a la escala que quepa a lo ancho (máx. 1:1), troceada entre páginas si es alta. Los
  // cortes, entre bloques (segmentos del ladder) si la figura los tiene.
  w.figure = (fig, { minScale = 0.45, caption, maxHeight, maxScale } = {}) => {
    if (!fig) return
    if (caption) {
      w.ensure(8)
      w.text(caption, M.left, w.y + 4, 10, 'bold', { color: MUTED })
      w.y += 7
    }
    // Escala: 1:1 como máximo y a lo ancho de la página; si así no cabe en una página (o en
    // maxHeight), se reduce hasta caber (sin bajar de minScale: más pequeño no se lee y se trocea).
    const scale = figureScale(fig, { minScale, maxHeight, maxScale })
    const kk = scale * PX_TO_MM
    // Si cabe entera en una página pero no en lo que queda de esta, a la siguiente.
    if (fig.height * kk <= w.bottom() - M.top - 15 && w.y + fig.height * kk > w.bottom()) w.newPage()
    let top = 0
    while (top < fig.height - 0.5) {
      let available = (w.bottom() - w.y) / kk
      if (available < 40 / kk) {
        w.newPage()
        available = (w.bottom() - w.y) / kk
      }
      let end = Math.min(fig.height, top + available)
      if (end < fig.height && fig.blocks?.length) {
        // Corte en el último final de bloque que quepa.
        const cut = fig.blocks.map((b) => b.bottom).filter((b) => b > top + 10 && b <= end).sort((a, b) => b - a)[0]
        if (cut) end = cut
      }
      const h = (end - top) * kk
      w.push({ t: 'figure', x: M.left + (w.width() - fig.width * kk) / 2, y: w.y, w: fig.width * kk, h, figure: fig, top, bottom: end, scale })
      w.y += h + 4
      top = end
      if (top < fig.height - 0.5) w.newPage()
    }
  }
  // Tabla: columnas { label, width (fracción) }; filas de texto.
  w.table = (columns, rows, { mono = [] } = {}) => {
    const sz = 9
    const rh = 6
    const widths = columns.map((c) => c.width * w.width())
    const head = () => {
      w.ensure(rh * 2)
      w.push({ t: 'rect', x: M.left, y: w.y, w: w.width(), h: rh, fill: [241, 245, 249] })
      let x = M.left
      columns.forEach((c, i) => {
        w.text(fit(c.label, widths[i] - 2, sz, 'bold', measure), x + 1, w.y + 4.2, sz, 'bold')
        x += widths[i]
      })
      w.y += rh
    }
    head()
    for (const row of rows) {
      if (w.y + rh > w.bottom()) {
        w.newPage()
        head()
      }
      let x = M.left
      row.forEach((cell, i) => {
        const font = mono.includes(i) ? 'courier' : 'helvetica'
        w.push({ t: 'text', x: x + 1, y: w.y + 4.2, text: fit(cell, widths[i] - 2, sz, 'normal', measure, font), size: sz, style: 'normal', font, color: INK })
        x += widths[i]
      })
      w.push({ t: 'line', x1: M.left, y1: w.y + rh, x2: M.left + w.width(), y2: w.y + rh, width: 0.15, color: RULE })
      w.y += rh
    }
    w.y += 4
  }
  // Pie de página: texto a la izquierda y «página i de n» a la derecha (salvo las saltadas).
  w.footer = (left, pageLabel, skip = () => false) => {
    const total = pages.length
    pages.forEach((p, i) => {
      if (skip(i)) return
      p.items.push({ t: 'line', x1: M.left, y1: p.h - 13, x2: p.w - M.right, y2: p.h - 13, width: 0.15, color: RULE })
      if (left) p.items.push({ t: 'text', x: M.left, y: p.h - 9, text: fit(left, p.w - M.left - M.right - 35, 8, 'normal', measure), size: 8, style: 'normal', font: 'helvetica', color: MUTED })
      p.items.push({ t: 'text', x: p.w - M.right, y: p.h - 9, text: pageLabel(i + 1, total), size: 8, style: 'normal', font: 'helvetica', color: MUTED, align: 'right' })
    })
  }
  return w
}
