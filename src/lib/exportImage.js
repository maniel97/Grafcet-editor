import { DEFAULT_PDF_OPTIONS, PAGE_MARGIN, exportLayout } from './pdfLayout'
import { fileName } from './fileNames'
import { captureScene, drawScene, itemSpan, pdfSafe } from './vectorPdf'
import { titleBlockCells, titleBlockOrigin, titleBlockValues } from './titleBlock'

const PX_TO_MM = 25.4 / 96

// Margen alrededor del dibujo en la imagen exportada (px).
const MARGIN = 48
// Límite de tamaño del lienzo de los navegadores: por encima, se reduce la resolución.
const MAX_CANVAS_SIDE = 12000

// Elementos de edición que nunca deben salir en el diseño final.
const EDITOR_ONLY = ['react-flow__handle', 'ghost-preview', 'editor-only', 'react-flow__resize-control']
const EDITOR_ONLY_SELECTOR = EDITOR_ONLY.map((c) => `.${c}`).join(',')
const isExportable = (el) => !el.classList || !EDITOR_ONLY.some((c) => el.classList.contains(c))

// Rectángulo (en coordenadas del lienzo) de todo lo dibujado: no solo las cajas de los nodos,
// también lo que sobresale de ellas (receptividades a la derecha, condiciones sobre las
// acciones, direcciones) y los enlaces que salen por los lados (bucles, saltos).
export function drawnBounds(viewportEl, viewport) {
  const origin = viewportEl.parentElement.getBoundingClientRect()
  const { x: vx, y: vy, zoom } = viewport
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const elements = viewportEl.querySelectorAll(
    '.react-flow__node, .react-flow__node *, .react-flow__edge path:not(.react-flow__edge-interaction), [data-ref-label]',
  )
  for (const el of elements) {
    if (el.closest(EDITOR_ONLY_SELECTOR)) continue
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) continue
    minX = Math.min(minX, (r.left - origin.left - vx) / zoom)
    minY = Math.min(minY, (r.top - origin.top - vy) / zoom)
    maxX = Math.max(maxX, (r.right - origin.left - vx) / zoom)
    maxY = Math.max(maxY, (r.bottom - origin.top - vy) / zoom)
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null
}

// Dibuja el diagrama completo (no solo la parte visible) a escala 1:1 con margen alrededor de
// todo lo dibujado. Devuelve { dataUrl, width, height } (tamaño en px CSS) o null si está vacío.
export async function renderDiagram(format, viewport, maxPixelRatio) {
  const viewportEl = document.querySelector('.react-flow__viewport')
  if (!viewportEl) return null
  const bounds = drawnBounds(viewportEl, viewport)
  if (!bounds) return null

  const width = Math.ceil(bounds.maxX - bounds.minX + MARGIN * 2)
  const height = Math.ceil(bounds.maxY - bounds.minY + MARGIN * 2)
  const pixelRatio = Math.min(maxPixelRatio, MAX_CANVAS_SIDE / Math.max(width, height))

  const options = {
    backgroundColor: '#ffffff',
    width,
    height,
    pixelRatio,
    filter: isExportable,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${MARGIN - bounds.minX}px, ${MARGIN - bounds.minY}px) scale(1)`,
    },
  }

  // La librería de captura solo se descarga al exportar por primera vez.
  const { toPng, toSvg } = await import('html-to-image')
  const dataUrl = format === 'svg' ? await toSvg(viewportEl, options) : await toPng(viewportEl, options)
  return { dataUrl, width, height, viewportEl, bounds }
}

export function download(href, filename) {
  const a = document.createElement('a')
  a.download = filename
  a.href = href
  a.click()
}

// PNG o SVG, 100% en el cliente.
export async function exportDiagram(format, viewport) {
  const image = await renderDiagram(format, viewport, 2)
  if (image) download(image.dataUrl, fileName(format))
}

// Para el PDF: la imagen (vista previa y PDF de imagen) y la escena vectorial, capturadas a la vez.
export async function capturePdf(viewport) {
  const image = await renderDiagram('png', viewport, 3)
  if (!image) return null
  const scene = captureScene(image.viewportEl, viewport, image.bounds, MARGIN, EDITOR_ONLY_SELECTOR)
  return { dataUrl: image.dataUrl, width: image.width, height: image.height, scene }
}

// PDF (una o varias páginas) generado en el navegador (jsPDF se carga solo al usarlo) con la
// imagen y la escena ya capturadas y las opciones del diálogo de exportación. La maquetación es
// la misma que muestra la vista previa (lib/pdfLayout.js: exportLayout). Con varias páginas, cada
// una recorta su franja del dibujo.
export async function savePdf(images, options = DEFAULT_PDF_OPTIONS, name = fileName('pdf')) {
  const { jsPDF } = await import('jspdf')
  // Una imagen, o una por hoja (todas las hojas en un PDF): cada una en sus páginas.
  const parts = (Array.isArray(images) ? images : [images]).map((image) => ({ image, layout: exportLayout(image, options) }))
  const total = parts.reduce((n, p) => n + p.layout.pages.length, 0)
  const first = parts[0].layout
  const pdf = new jsPDF({ orientation: first.orientation, unit: 'mm', format: [first.page.width, first.page.height] })
  const date = new Date().toLocaleDateString('es-ES')
  let number = 0
  for (const [index, { image, layout }] of parts.entries()) {
    const k = layout.scale * PX_TO_MM
    const vector = options.vector !== false && image.scene
    const many = layout.pages.length > 1
    for (const p of layout.pages) {
      if (number++) pdf.addPage([layout.page.width, layout.page.height], layout.orientation)
      const y = layout.y - p.top * k
      if (many) {
        pdf.saveGraphicsState()
        pdf.rect(layout.x - 1, layout.y, layout.w + 2, p.h, null)
        pdf.clip()
        pdf.discardPath()
      }
      // Vectorial (por defecto): líneas y texto reales; si no, la imagen a alta resolución.
      if (vector) {
        const items = many
          ? image.scene.filter((it) => {
              const [a, b] = itemSpan(it)
              return b > p.top && a < p.bottom
            })
          : image.scene
        drawScene(pdf, items, { x: layout.x, y, scale: layout.scale })
      } else {
        pdf.addImage(image.dataUrl, 'PNG', layout.x, y, layout.w, image.height * k, `dibujo${index}`, 'FAST')
      }
      if (many) pdf.restoreGraphicsState()
      if (options.titleBlock) {
        const values = titleBlockValues(options.titleBlockData, { projectName: options.projectName, today: date, page: number, pages: total })
        drawTitleBlock(pdf, titleBlockOrigin(layout.pageW, layout.pageH, PAGE_MARGIN), titleBlockCells(values))
      } else if (options.footer) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(120)
        const text = [options.title?.trim(), image.sheetName, date, total > 1 ? `página ${number} de ${total}` : null]
        pdf.text(pdfSafe(text.filter(Boolean).join(' · ')), PAGE_MARGIN, layout.pageH - PAGE_MARGIN / 2, { horizontalScale: 1 }) // (ver lib/dossierPdf.js)
      }
    }
  }
  pdf.save(name)
}

// Cajetín: marco, celdas con su rótulo pequeño y su valor (recortado si no cabe).
function drawTitleBlock(pdf, origin, cells) {
  pdf.setDrawColor(15, 23, 42)
  pdf.setLineDashPattern([], 0)
  for (const c of cells) {
    pdf.setLineWidth(0.25)
    pdf.rect(origin.x + c.x, origin.y + c.y, c.w, c.h, 'S')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(5.5)
    pdf.setTextColor(100, 116, 139)
    pdf.text(pdfSafe(c.label), origin.x + c.x + 1.2, origin.y + c.y + 2.6, { horizontalScale: 1 })
    pdf.setFont('helvetica', c.strong ? 'bold' : 'normal')
    pdf.setFontSize(c.strong ? 9 : 8)
    pdf.setTextColor(15, 23, 42)
    let text = pdfSafe(c.value ?? '')
    const room = c.w - 2.4
    while (text.length > 1 && pdf.getTextWidth(text) > room) text = `${text.slice(0, -2)}…`
    pdf.text(text, origin.x + c.x + 1.2, origin.y + c.y + c.h - 2, { horizontalScale: 1 })
  }
  // Marco exterior más grueso.
  const right = Math.max(...cells.map((c) => c.x + c.w))
  const bottom = Math.max(...cells.map((c) => c.y + c.h))
  pdf.setLineWidth(0.5)
  pdf.rect(origin.x, origin.y, right, bottom, 'S')
}
