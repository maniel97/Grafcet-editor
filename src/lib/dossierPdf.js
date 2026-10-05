// PDF del dossier (lib/dossier.js): las páginas tal cual las describe buildDossier, con jsPDF
// (que se carga solo al usarlo). Texto y tablas vectoriales; las figuras, con su escena vectorial
// (si la tienen) recortada a su franja, o como imagen.
import { drawScene, itemSpan, pdfSafe } from './vectorPdf'

const PX_TO_MM = 25.4 / 96

export async function loadPdf() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

// Medida del texto en mm con las métricas de jsPDF (las mismas del PDF).
export function makeMeasure(jsPDF) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  return (text, size, style = 'normal', font = 'helvetica') => {
    pdf.setFont(font, style === 'bold' ? 'bold' : 'normal')
    pdf.setFontSize(size)
    return pdf.getTextWidth(pdfSafe(String(text)))
  }
}

export function renderDossierPdf(jsPDF, pages) {
  const first = pages[0]
  const orientation = (p) => (p.w > p.h ? 'landscape' : 'portrait')
  const pdf = new jsPDF({ orientation: orientation(first), unit: 'mm', format: [first.w, first.h].sort((a, b) => a - b) })
  pages.forEach((p, index) => {
    if (index) pdf.addPage([p.w, p.h].sort((a, b) => a - b), orientation(p))
    for (const it of p.items) {
      if (it.t === 'text') {
        pdf.setFont(it.font ?? 'helvetica', it.style === 'bold' ? 'bold' : 'normal')
        pdf.setFontSize(it.size)
        pdf.setTextColor(...(it.color ?? [15, 23, 42]))
        // horizontalScale explícito: el de los textos de una figura vectorial (drawScene) se queda
        // en el estado del PDF y estrecharía o ensancharía todo lo que viene después.
        pdf.text(pdfSafe(it.text), it.x, it.y, { horizontalScale: 1, ...(it.align ? { align: it.align } : {}) })
      } else if (it.t === 'line') {
        pdf.setDrawColor(...(it.color ?? [15, 23, 42]))
        pdf.setLineWidth(it.width ?? 0.2)
        pdf.setLineDashPattern(it.dash ? [0.6, 0.8] : [], 0)
        pdf.line(it.x1, it.y1, it.x2, it.y2)
        pdf.setLineDashPattern([], 0)
      } else if (it.t === 'rect') {
        if (it.fill) pdf.setFillColor(...it.fill)
        if (it.stroke) {
          pdf.setDrawColor(...it.stroke)
          pdf.setLineWidth(it.width ?? 0.2)
        }
        pdf.rect(it.x, it.y, it.w, it.h, it.fill && it.stroke ? 'FD' : it.fill ? 'F' : 'S')
      } else if (it.t === 'figure') {
        drawFigure(pdf, it, index)
      }
    }
  })
  return pdf
}

function drawFigure(pdf, it, pageIndex) {
  const k = it.scale * PX_TO_MM
  const fig = it.figure
  const whole = it.top <= 0 && it.bottom >= fig.height
  if (!whole) {
    pdf.saveGraphicsState()
    pdf.rect(it.x - 1, it.y, it.w + 2, it.h, null)
    pdf.clip()
    pdf.discardPath()
  }
  if (fig.scene?.length) {
    const items = whole
      ? fig.scene
      : fig.scene.filter((s) => {
          const [a, b] = itemSpan(s)
          return b > it.top && a < it.bottom
        })
    drawScene(pdf, items, { x: it.x, y: it.y - it.top * k, scale: it.scale })
  } else if (fig.dataUrl) {
    pdf.addImage(fig.dataUrl, 'PNG', it.x, it.y - it.top * k, fig.width * k, fig.height * k, `fig${pageIndex}-${it.top}`, 'FAST')
  }
  if (!whole) pdf.restoreGraphicsState()
}
