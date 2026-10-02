// Exportación del dibujo ladder (un SVG) a SVG, PNG y PDF multipágina, en el navegador.

import { downloadFile } from '../projectFile'

export function svgText(svg) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`
}

export function exportLadderSvg(svg) {
  downloadFile(svgText(svg), 'ladder.svg', 'image/svg+xml')
}

// Rasteriza el SVG en un canvas a `scale` aumentos.
async function toCanvas(svg, scale) {
  const width = Number(svg.getAttribute('width'))
  const height = Number(svg.getAttribute('height'))
  const url = URL.createObjectURL(new Blob([svgText(svg)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const g = canvas.getContext('2d')
    g.fillStyle = 'white'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function exportLadderPng(svg) {
  const canvas = await toCanvas(svg, 2)
  const a = document.createElement('a')
  a.download = 'ladder.png'
  a.href = canvas.toDataURL('image/png')
  a.click()
}

// PDF A4 vertical. Las páginas se cortan entre segmentos (nunca a mitad de uno) y el título de
// una sección no se queda solo al pie de una página.
export async function exportLadderPdf(svg) {
  const { jsPDF } = await import('jspdf')
  const SCALE = 2.5
  const canvas = await toCanvas(svg, SCALE)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 10
  const footer = 6
  const svgWidth = Number(svg.getAttribute('width'))
  const mmPerPx = Math.min(1, (pageW - margin * 2) / svgWidth / (25.4 / 96)) * (25.4 / 96)
  const pagePx = (pageH - margin * 2 - footer) / mmPerPx

  const blocks = [...svg.querySelectorAll('[data-block-top]')].map((g) => ({
    top: Number(g.dataset.blockTop),
    bottom: Number(g.dataset.blockBottom),
    keep: g.dataset.keepWithNext === '1',
  }))
  // Agrupa bloques en páginas.
  const pages = []
  let start = 0
  let end = 0
  blocks.forEach((b, i) => {
    const next = blocks[i + 1]
    const needed = b.keep && next ? next.bottom : b.bottom
    if (needed - start > pagePx && end > start) {
      pages.push([start, end])
      start = b.top
    }
    end = b.bottom
  })
  pages.push([start, Math.max(end, Number(svg.getAttribute('height')))])

  const date = new Date().toLocaleDateString('es-ES')
  pages.forEach(([top, bottom], i) => {
    if (i) pdf.addPage()
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = Math.max(1, Math.round((bottom - top) * SCALE))
    slice.getContext('2d').drawImage(canvas, 0, -Math.round(top * SCALE))
    const h = (bottom - top) * mmPerPx
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, svgWidth * mmPerPx, h, undefined, 'FAST')
    pdf.setFontSize(8)
    pdf.setTextColor(120)
    pdf.text(`Ladder generado desde grafcet (IEC 60848) · ${date} · página ${i + 1} de ${pages.length}`, margin, pageH - margin / 2)
  })
  pdf.save('ladder.pdf')
}
