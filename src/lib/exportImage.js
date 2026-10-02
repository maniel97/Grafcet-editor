import { DEFAULT_PDF_OPTIONS, PAGE_MARGIN, pdfLayout } from './pdfLayout'
import { fileName } from './fileNames'
import { captureScene, drawScene } from './vectorPdf'

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

function download(href, filename) {
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

// PDF de una página, generado en el navegador (jsPDF se carga solo al usarlo), con la imagen ya
// capturada (renderDiagram a 3x para impresión) y las opciones del diálogo de exportación.
// La maquetación es la misma que muestra la vista previa (lib/pdfLayout.js).
export async function savePdf(image, options = DEFAULT_PDF_OPTIONS) {
  const { jsPDF } = await import('jspdf')
  const layout = pdfLayout(image, options)
  const pdf = new jsPDF({ orientation: layout.orientation, unit: 'mm', format: [layout.page.width, layout.page.height] })
  // Vectorial (por defecto): líneas y texto reales; si no, la imagen a 3x.
  if (options.vector !== false && image.scene) drawScene(pdf, image.scene, layout)
  else pdf.addImage(image.dataUrl, 'PNG', layout.x, layout.y, layout.w, layout.h, undefined, 'FAST')
  if (options.footer) {
    pdf.setFontSize(8)
    pdf.setTextColor(120)
    const date = new Date().toLocaleDateString('es-ES')
    pdf.text([options.title?.trim(), date].filter(Boolean).join(' · '), PAGE_MARGIN, layout.pageH - PAGE_MARGIN / 2)
  }
  pdf.save(fileName('pdf'))
}
