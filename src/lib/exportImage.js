import { toPng, toSvg } from 'html-to-image'

// Margen alrededor del dibujo en la imagen exportada (px).
const MARGIN = 48
// Límite de tamaño del lienzo de los navegadores: por encima, se reduce la resolución.
const MAX_CANVAS_SIDE = 12000

// Elementos de edición que nunca deben salir en el diseño final.
const EDITOR_ONLY = ['react-flow__handle', 'ghost-preview', 'editor-only']
const EDITOR_ONLY_SELECTOR = EDITOR_ONLY.map((c) => `.${c}`).join(',')
const isExportable = (el) => !el.classList || !EDITOR_ONLY.some((c) => el.classList.contains(c))

// Rectángulo (en coordenadas del lienzo) de todo lo dibujado: no solo las cajas de los nodos,
// también lo que sobresale de ellas (receptividades a la derecha, condiciones sobre las
// acciones, direcciones) y los enlaces que salen por los lados (bucles, saltos).
function drawnBounds(viewportEl, viewport) {
  const origin = viewportEl.parentElement.getBoundingClientRect()
  const { x: vx, y: vy, zoom } = viewport
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const elements = viewportEl.querySelectorAll(
    '.react-flow__node, .react-flow__node *, .react-flow__edge path:not(.react-flow__edge-interaction)',
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
async function renderDiagram(format, viewport, maxPixelRatio) {
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

  const dataUrl = format === 'svg' ? await toSvg(viewportEl, options) : await toPng(viewportEl, options)
  return { dataUrl, width, height }
}

function download(href, filename) {
  const a = document.createElement('a')
  a.download = filename
  a.href = href
  a.click()
}

// PNG o SVG, 100% en el cliente.
export async function exportDiagram(format, viewport) {
  const image = await renderDiagram(format, viewport, 2)
  if (image) download(image.dataUrl, `grafcet.${format}`)
}

// Formatos de página en mm (vertical). Se usa el menor en el que el diagrama quepa sin
// reducirse demasiado, para que se lea bien impreso.
const PAGES = [
  { name: 'a4', width: 210, height: 297 },
  { name: 'a3', width: 297, height: 420 },
]
const PAGE_MARGIN = 12 // mm
const FOOTER = 8 // mm reservados al pie
const MIN_READABLE_SCALE = 0.7 // por debajo de esto en A4 se pasa a A3
const PX_TO_MM = 25.4 / 96

// PDF de una página, generado en el navegador (jsPDF se carga solo al usarlo). La imagen se
// rasteriza a alta resolución (3x) para impresión; la orientación sigue a la forma del diagrama.
export async function exportPdf(viewport) {
  const image = await renderDiagram('png', viewport, 3)
  if (!image) return
  const { jsPDF } = await import('jspdf')

  const landscape = image.width > image.height
  const naturalW = image.width * PX_TO_MM
  const naturalH = image.height * PX_TO_MM
  const fit = (page) => {
    const pageW = landscape ? page.height : page.width
    const pageH = landscape ? page.width : page.height
    const scale = Math.min(1, (pageW - PAGE_MARGIN * 2) / naturalW, (pageH - PAGE_MARGIN * 2 - FOOTER) / naturalH)
    return { page, pageW, pageH, scale }
  }
  const layout = PAGES.map(fit).find((l) => l.scale >= MIN_READABLE_SCALE) ?? fit(PAGES[PAGES.length - 1])

  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: layout.page.name })
  const w = naturalW * layout.scale
  const h = naturalH * layout.scale
  // Centrado en horizontal; arriba en vertical, como un plano.
  pdf.addImage(image.dataUrl, 'PNG', (layout.pageW - w) / 2, PAGE_MARGIN, w, h, undefined, 'FAST')

  pdf.setFontSize(8)
  pdf.setTextColor(120)
  const date = new Date().toLocaleDateString('es-ES')
  pdf.text(`Grafcet (IEC 60848) · ${date}`, PAGE_MARGIN, layout.pageH - PAGE_MARGIN / 2)
  pdf.save('grafcet.pdf')
}
