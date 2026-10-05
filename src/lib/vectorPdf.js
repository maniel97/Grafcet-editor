// PDF vectorial: en vez de una imagen, se recorre lo que ya está dibujado en el lienzo y se
// traza en el PDF como líneas, rectángulos y texto reales (nítidos a cualquier zoom y con el
// texto seleccionable). Lo que sale es lo que se ve: bordes y fondos de las cajas, trazos SVG
// (enlaces, flechas) con sus transformaciones y el texto con su posición medida carácter a
// carácter (incluida la barra de negación).
//
// captureScene() lee el DOM y devuelve una escena en px del dibujo (con margen); drawScene() la
// pinta en un jsPDF con la escala de la maquetación (lib/pdfLayout.js).

const PX_TO_MM = 25.4 / 96

// --- Colores ---------------------------------------------------------------------------------
// El navegador puede dar los colores en oklch (Tailwind 4): se convierten pintando un píxel.
const colorCache = new Map()
let colorCtx = null
export function toRgb(css) {
  if (!css || css === 'transparent' || css === 'none') return null
  if (colorCache.has(css)) return colorCache.get(css)
  colorCtx ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
  colorCtx.clearRect(0, 0, 1, 1)
  colorCtx.fillStyle = '#000'
  colorCtx.fillStyle = css
  colorCtx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = colorCtx.getImageData(0, 0, 1, 1).data
  const rgb = a < 8 ? null : [r, g, b]
  colorCache.set(css, rgb)
  return rgb
}

// --- Texto -----------------------------------------------------------------------------------
// Las fuentes estándar del PDF solo tienen los caracteres de WinAnsi (sirven los acentos, la ñ,
// «», ·); el resto se sustituye. ↑ y ↓ (flancos) se dibujan como flechas.
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const REPLACE = { '≥': '>=', '≤': '<=', '≠': '<>', '→': '->', '←': '<-', '×': 'x', '−': '-', '‑': '-', '⁄': '/' }
export const ARROW_GLYPHS = { '↑': 'up', '↓': 'down' }
const encodable = (ch) => ch.charCodeAt(0) < 256 || WINANSI_EXTRA.includes(ch)
export const pdfSafe = (text) => [...text].map((ch) => (encodable(ch) ? ch : (REPLACE[ch] ?? '?'))).join('')

// Trozos de una línea de texto: texto normal y flechas, cada uno con su posición medida.
// chars: [{ ch, left, right }] de una misma línea.
export function splitRuns(chars) {
  const runs = []
  let current = null
  for (const c of chars) {
    if (ARROW_GLYPHS[c.ch]) {
      current = null
      runs.push({ glyph: ARROW_GLYPHS[c.ch], left: c.left, right: c.right })
      continue
    }
    if (!current) {
      current = { text: '', left: c.left, right: c.right }
      runs.push(current)
    }
    current.text += c.ch
    current.right = c.right
  }
  // Sin espacios sueltos a los lados (se miden aparte y no deben desplazar el texto).
  return runs.filter((r) => r.glyph || r.text.trim())
}

// --- Trazados SVG ----------------------------------------------------------------------------
// Los enlaces solo usan M, L, H, V y Z (lib/grafcetRouting.js); otros comandos se aproximan
// muestreando la curva.
export function parsePath(d) {
  const tokens = d.match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  if (/[^MLHVZmlhvz\d\s.,eE-]/.test(d)) return null
  const subpaths = []
  let current = null
  let x = 0
  let y = 0
  let cmd = null
  for (let i = 0; i < tokens.length; ) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++]
    const n = () => Number(tokens[i++])
    switch (cmd) {
      case 'M':
      case 'm':
        x = cmd === 'm' ? x + n() : n()
        y = cmd === 'm' ? y + n() : n()
        current = { points: [[x, y]], closed: false }
        subpaths.push(current)
        cmd = cmd === 'm' ? 'l' : 'L'
        break
      case 'L':
      case 'l':
        x = cmd === 'l' ? x + n() : n()
        y = cmd === 'l' ? y + n() : n()
        current.points.push([x, y])
        break
      case 'H':
      case 'h':
        x = cmd === 'h' ? x + n() : n()
        current.points.push([x, y])
        break
      case 'V':
      case 'v':
        y = cmd === 'v' ? y + n() : n()
        current.points.push([x, y])
        break
      case 'Z':
      case 'z':
        if (current) current.closed = true
        ;[x, y] = current?.points[0] ?? [x, y]
        break
      default:
        return null
    }
  }
  return subpaths
}

function sampledPath(el) {
  const total = el.getTotalLength()
  const steps = Math.max(8, Math.ceil(total / 2))
  const points = []
  for (let i = 0; i <= steps; i++) {
    const p = el.getPointAtLength((total * i) / steps)
    points.push([p.x, p.y])
  }
  return [{ points, closed: false }]
}

function shapeSubpaths(el) {
  const num = (name) => Number(el.getAttribute(name) ?? 0)
  switch (el.tagName.toLowerCase()) {
    case 'path':
      return parsePath(el.getAttribute('d') ?? '') ?? sampledPath(el)
    case 'line':
      return [{ points: [[num('x1'), num('y1')], [num('x2'), num('y2')]], closed: false }]
    case 'polyline':
    case 'polygon': {
      const values = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number)
      const points = []
      for (let i = 0; i + 1 < values.length; i += 2) points.push([values[i], values[i + 1]])
      return [{ points, closed: el.tagName.toLowerCase() === 'polygon' }]
    }
    case 'rect': {
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map(num)
      return [{ points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true }]
    }
    case 'circle':
    case 'ellipse':
      return sampledPath(el)
    default:
      return null
  }
}

// --- Captura ---------------------------------------------------------------------------------
const visible = (el) =>
  el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : getComputedStyle(el).visibility !== 'hidden'

// viewportEl: .react-flow__viewport; viewport: { x, y, zoom }; bounds: drawnBounds(); margin en px.
// skip: selector de lo que no se exporta (conectores, botones de edición...).
export function captureScene(viewportEl, viewport, bounds, margin, skip) {
  const origin = viewportEl.parentElement.getBoundingClientRect()
  const { x: vx, y: vy, zoom } = viewport
  const toX = (cx) => (cx - origin.left - vx) / zoom - bounds.minX + margin
  const toY = (cy) => (cy - origin.top - vy) / zoom - bounds.minY + margin
  const items = []

  const svgShape = (el) => {
    if (el.classList.contains('react-flow__edge-interaction')) return
    const style = getComputedStyle(el)
    const stroke = style.stroke !== 'none' ? toRgb(style.stroke) : null
    const fill = style.fill !== 'none' ? toRgb(style.fill) : null
    if (!stroke && !fill) return
    const ctm = el.getScreenCTM()
    const subpaths = shapeSubpaths(el)
    if (!ctm || !subpaths) return
    const map = ([x, y]) => [toX(ctm.a * x + ctm.c * y + ctm.e), toY(ctm.b * x + ctm.d * y + ctm.f)]
    const scale = Math.hypot(ctm.a, ctm.b) / zoom
    items.push({
      t: 'path',
      subpaths: subpaths.map((s) => ({ points: s.points.map(map), closed: s.closed })),
      stroke,
      fill,
      width: (parseFloat(style.strokeWidth) || 1) * scale,
    })
  }

  const textNode = (node, style) => {
    const text = node.textContent
    if (!text.trim()) return
    const range = document.createRange()
    const lines = []
    let i = 0
    for (const ch of text) {
      range.setStart(node, i)
      range.setEnd(node, i + ch.length)
      i += ch.length
      const r = range.getClientRects()[0]
      if (!r) continue
      const top = toY(r.top)
      const bottom = toY(r.bottom)
      let line = lines.find((l) => Math.abs(l.top - top) < 2)
      if (!line) lines.push((line = { top, bottom, chars: [] }))
      line.chars.push({ ch, left: toX(r.left), right: toX(r.right) })
    }
    const size = parseFloat(style.fontSize)
    const color = toRgb(style.color) ?? [0, 0, 0]
    const bold = Number(style.fontWeight) >= 600
    const mono = /mono|consolas|courier/i.test(style.fontFamily)
    const overline = style.textDecorationLine.includes('overline')
    const transform = { uppercase: (t) => t.toLocaleUpperCase('es'), lowercase: (t) => t.toLocaleLowerCase('es') }[style.textTransform]
    for (const line of lines) {
      for (const run of splitRuns(line.chars)) {
        const text = run.text && transform ? transform(run.text) : run.text
        items.push({ t: 'text', ...run, text, top: line.top, bottom: line.bottom, size, color, bold, mono, overline })
      }
    }
  }

  const walk = (el) => {
    if (skip && el.matches?.(skip)) return
    if (el instanceof SVGElement) {
      if (el.tagName.toLowerCase() === 'svg' || el.tagName.toLowerCase() === 'g') {
        if (el.tagName.toLowerCase() === 'svg' && !visible(el)) return
        for (const child of el.children) walk(child)
      } else if (!['defs', 'marker', 'title'].includes(el.tagName.toLowerCase())) svgShape(el)
      return
    }
    if (!(el instanceof HTMLElement) || !visible(el)) return
    const style = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (r.width || r.height) {
      const box = { x: toX(r.left), y: toY(r.top), w: r.width / zoom, h: r.height / zoom }
      const bg = toRgb(style.backgroundColor)
      const radius = parseFloat(style.borderTopLeftRadius) || 0
      if (bg) items.push({ t: 'fill', ...box, radius, color: bg })
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const width = parseFloat(style[`border${side}Width`])
        const kind = style[`border${side}Style`]
        const color = toRgb(style[`border${side}Color`])
        if (!width || kind === 'none' || kind === 'hidden' || !color) continue
        if (radius && side === 'Top') {
          // Caja redondeada con el mismo borde en todos los lados (notas): un solo trazo.
          items.push({ t: 'box', ...box, radius, color, width, dash: kind === 'dashed' })
          break
        }
        const h = width / 2
        const [x1, y1, x2, y2] = {
          Top: [box.x, box.y + h, box.x + box.w, box.y + h],
          Bottom: [box.x, box.y + box.h - h, box.x + box.w, box.y + box.h - h],
          Left: [box.x + h, box.y, box.x + h, box.y + box.h],
          Right: [box.x + box.w - h, box.y, box.x + box.w - h, box.y + box.h],
        }[side]
        items.push({ t: 'line', x1, y1, x2, y2, width, color, dash: kind === 'dashed' })
      }
    }
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) textNode(child, style)
      else if (child.nodeType === Node.ELEMENT_NODE) walk(child)
    }
  }

  for (const child of viewportEl.children) walk(child)
  return items
}

// Texto tal como lo dibuja el SVG por defecto: sin saltos de línea, tabuladores como espacios,
// sin espacios al principio ni al final y sin espacios repetidos.
export const svgRenderedText = (text) => text.replace(/[\r\n]/g, '').replace(/\t/g, ' ').trim().replace(/ {2,}/g, ' ')

// Escena de un dibujo SVG (ladder, cronograma) en sus propias unidades: trazos y texto. El texto
// SVG se mide carácter a carácter con getExtentOfChar. El SVG tiene que estar en el documento.
export function captureSvgScene(svg) {
  const items = []
  // Desde la esquina del dibujo: el viewBox puede no empezar en 0,0 (esquema eléctrico) y la figura
  // se coloca por su esquina; sin restarlo, el dibujo salía desplazado (y tapaba su título).
  const screen = svg.getScreenCTM()
  if (!screen) return items
  const vb = svg.viewBox?.baseVal
  const root = new DOMMatrix().translate(-(vb?.x ?? 0), -(vb?.y ?? 0)).multiply(screen.inverse())
  const toLocal = (x, y) => {
    const p = new DOMPoint(x, y).matrixTransform(root)
    return [p.x, p.y]
  }
  const walk = (el) => {
    const tag = el.tagName.toLowerCase()
    if (['defs', 'marker', 'title', 'style'].includes(tag)) return
    if (tag === 'svg' || tag === 'g' || tag === 'a') {
      for (const child of el.children) walk(child)
      return
    }
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return
    if (tag === 'text') {
      const n = el.getNumberOfChars()
      if (!n) return
      // El SVG junta los espacios al dibujar (sin xml:space="preserve"): las posiciones de
      // getExtentOfChar corresponden al texto ya juntado.
      const collapsed = svgRenderedText(el.textContent)
      const text = collapsed.length === n ? collapsed : el.textContent
      const ctm = el.getScreenCTM()
      const scale = ctm ? Math.hypot(ctm.a, ctm.b) / Math.hypot(svg.getScreenCTM().a, svg.getScreenCTM().b) : 1
      const chars = []
      let top = Infinity
      let bottom = -Infinity
      for (let i = 0; i < n && i < text.length; i++) {
        const box = el.getExtentOfChar(i)
        // De las coordenadas del texto a las del SVG raíz.
        const m = ctm && root ? root.multiply(ctm) : new DOMMatrix()
        const a = new DOMPoint(box.x, box.y).matrixTransform(m)
        const b = new DOMPoint(box.x + box.width, box.y + box.height).matrixTransform(m)
        chars.push({ ch: text[i], left: a.x, right: b.x })
        top = Math.min(top, a.y)
        bottom = Math.max(bottom, b.y)
      }
      const fill = toRgb(style.fill) ?? [0, 0, 0]
      for (const run of splitRuns(chars)) {
        items.push({
          t: 'text',
          ...run,
          top,
          bottom,
          size: parseFloat(style.fontSize) * scale,
          color: fill,
          bold: Number(style.fontWeight) >= 600,
          mono: /mono|consolas|courier/i.test(style.fontFamily),
          overline: false,
        })
      }
      return
    }
    const stroke = style.stroke !== 'none' ? toRgb(style.stroke) : null
    const fill = style.fill !== 'none' ? toRgb(style.fill) : null
    if (!stroke && !fill) return
    const subpaths = shapeSubpaths(el)
    const ctm = el.getScreenCTM()
    if (!subpaths || !ctm) return
    const map = ([x, y]) => toLocal(ctm.a * x + ctm.c * y + ctm.e, ctm.b * x + ctm.d * y + ctm.f)
    const unit = Math.hypot(ctm.a, ctm.b) / Math.hypot(svg.getScreenCTM().a, svg.getScreenCTM().b)
    // Rectángulos redondeados (rx): se dibujan como caja.
    const rx = tag === 'rect' ? Number(el.getAttribute('rx') ?? 0) : 0
    if (rx && fill && !stroke) {
      const [[x, y], , [x2, y2]] = subpaths[0].points.map(map)
      items.push({ t: 'fill', x, y, w: x2 - x, h: y2 - y, radius: rx * unit, color: fill })
      return
    }
    items.push({
      t: 'path',
      subpaths: subpaths.map((sp) => ({ points: sp.points.map(map), closed: sp.closed })),
      stroke,
      fill,
      width: (parseFloat(style.strokeWidth) || 1) * unit,
    })
  }
  walk(svg)
  return items
}

// Franja vertical que ocupa un elemento de la escena (para repartirla en páginas).
export function itemSpan(it) {
  switch (it.t) {
    case 'fill':
    case 'box':
      return [it.y, it.y + it.h]
    case 'line':
      return [Math.min(it.y1, it.y2), Math.max(it.y1, it.y2)]
    case 'text':
      return [it.top, it.bottom]
    case 'path': {
      const ys = it.subpaths.flatMap((s) => s.points.map((p) => p[1]))
      return [Math.min(...ys), Math.max(...ys)]
    }
    default:
      return [-Infinity, Infinity]
  }
}

// --- Dibujo ----------------------------------------------------------------------------------
// layout: { x, y, scale } de pdfLayout (mm); las medidas de la escena son px a escala 1:1.
export function drawScene(pdf, items, layout) {
  const k = layout.scale * PX_TO_MM
  const X = (x) => layout.x + x * k
  const Y = (y) => layout.y + y * k
  const color = (rgb, kind) => (kind === 'fill' ? pdf.setFillColor(...rgb) : kind === 'text' ? pdf.setTextColor(...rgb) : pdf.setDrawColor(...rgb))
  const dash = (on, width) => pdf.setLineDashPattern(on ? [width * 3 * k, width * 2 * k] : [], 0)
  pdf.setLineCap('butt')
  pdf.setLineJoin('miter')

  for (const it of items) {
    if (it.t === 'fill') {
      color(it.color, 'fill')
      if (it.radius) pdf.roundedRect(X(it.x), Y(it.y), it.w * k, it.h * k, it.radius * k, it.radius * k, 'F')
      else pdf.rect(X(it.x), Y(it.y), it.w * k, it.h * k, 'F')
    } else if (it.t === 'line') {
      color(it.color, 'draw')
      pdf.setLineWidth(it.width * k)
      dash(it.dash, it.width)
      pdf.line(X(it.x1), Y(it.y1), X(it.x2), Y(it.y2))
    } else if (it.t === 'box') {
      color(it.color, 'draw')
      pdf.setLineWidth(it.width * k)
      dash(it.dash, it.width)
      const h = it.width / 2
      pdf.roundedRect(X(it.x + h), Y(it.y + h), (it.w - it.width) * k, (it.h - it.width) * k, it.radius * k, it.radius * k, 'S')
    } else if (it.t === 'path') {
      dash(false)
      for (const sub of it.subpaths) {
        if (sub.points.length < 2) continue
        const [first, ...rest] = sub.points
        const deltas = []
        let prev = first
        for (const p of rest) {
          deltas.push([(p[0] - prev[0]) * k, (p[1] - prev[1]) * k])
          prev = p
        }
        if (it.stroke) {
          color(it.stroke, 'draw')
          pdf.setLineWidth(it.width * k)
        }
        if (it.fill) color(it.fill, 'fill')
        const style = it.fill && it.stroke ? 'FD' : it.fill ? 'F' : 'S'
        pdf.lines(deltas, X(first[0]), Y(first[1]), [1, 1], style, sub.closed || !!it.fill)
      }
    } else if (it.t === 'text') {
      const mid = Y((it.top + it.bottom) / 2)
      const width = (it.right - it.left) * k
      const sizePt = it.size * k * (72 / 25.4)
      if (it.glyph) {
        // Flecha de flanco (↑ ↓) del tamaño del carácter.
        color(it.color, 'draw')
        pdf.setLineWidth(Math.max(0.1, sizePt * 0.06 * (25.4 / 72)))
        dash(false)
        const cx = X((it.left + it.right) / 2)
        const half = it.size * 0.36 * k
        const head = it.size * 0.2 * k
        const tip = it.glyph === 'up' ? mid - half : mid + half
        const dir = it.glyph === 'up' ? 1 : -1
        pdf.line(cx, mid - half, cx, mid + half)
        pdf.line(cx - head, tip + head * dir, cx, tip)
        pdf.line(cx + head, tip + head * dir, cx, tip)
        continue
      }
      const text = pdfSafe(it.text)
      pdf.setFont(it.mono ? 'courier' : 'helvetica', it.bold ? 'bold' : 'normal')
      pdf.setFontSize(sizePt)
      color(it.color, 'text')
      // Misma anchura que en pantalla aunque la fuente del PDF sea otra (en textos cortos no:
      // un «1» estrecho comprimido parecería más pequeño).
      const natural = pdf.getTextWidth(text)
      const horizontalScale = natural > 0 && text.trim().length > 3 ? Math.min(1.3, Math.max(0.7, width / natural)) : 1
      pdf.text(text, X(it.left), mid, { baseline: 'middle', horizontalScale })
      if (it.overline) {
        color(it.color, 'draw')
        pdf.setLineWidth(Math.max(0.1, it.size * 0.07 * k))
        dash(false)
        const y = Y(it.top) + it.size * 0.12 * k
        pdf.line(X(it.left), y, X(it.right), y)
      }
    }
  }
}
