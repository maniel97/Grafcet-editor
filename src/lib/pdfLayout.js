// Maquetación de la exportación a PDF: dónde y a qué escala va el diagrama en la página.
// Es una función pura que usan por igual la vista previa y el PDF, así que lo que se ve en la
// vista previa es exactamente lo que se guarda.

// Formatos de página en mm, en vertical.
export const PAGE_SIZES = [
  { id: 'a5', label: 'A5', width: 148, height: 210 },
  { id: 'a4', label: 'A4', width: 210, height: 297 },
  { id: 'a3', label: 'A3', width: 297, height: 420 },
  { id: 'letter', label: 'Carta (EE. UU.)', width: 215.9, height: 279.4 },
]

export const PAGE_OPTIONS = [{ id: 'auto', label: 'Automático (A4 o A3)' }, ...PAGE_SIZES]
export const ORIENTATIONS = [
  { id: 'auto', label: 'Automática' },
  { id: 'portrait', label: 'Vertical' },
  { id: 'landscape', label: 'Apaisada' },
]

export const DEFAULT_PDF_OPTIONS = { page: 'auto', orientation: 'auto', footer: true, vector: true, title: 'Grafcet (IEC 60848)' }

export const PAGE_MARGIN = 12 // mm
export const FOOTER_SPACE = 8 // mm reservados al pie de página
const PX_TO_MM = 25.4 / 96
// En "Automático" se usa A4 salvo que el diagrama tuviera que reducirse por debajo de esto.
const MIN_READABLE_SCALE = 0.7
// Por debajo de esta escala se avisa de que puede leerse mal impreso.
export const SMALL_SCALE = 0.5

// image: { width, height } en px CSS (escala 1:1 del lienzo).
// Devuelve { page, orientation, pageW, pageH, x, y, w, h, scale, small } con medidas en mm.
// El diagrama se centra en horizontal y va arriba, como un plano; nunca se amplía (escala <= 1).
export function pdfLayout(image, options = DEFAULT_PDF_OPTIONS) {
  const naturalW = image.width * PX_TO_MM
  const naturalH = image.height * PX_TO_MM
  const footer = options.footer ? FOOTER_SPACE : 0

  const fit = (page, orientation) => {
    const landscape = orientation === 'landscape'
    const pageW = landscape ? page.height : page.width
    const pageH = landscape ? page.width : page.height
    const scale = Math.min(1, (pageW - PAGE_MARGIN * 2) / naturalW, (pageH - PAGE_MARGIN * 2 - footer) / naturalH)
    const w = naturalW * scale
    const h = naturalH * scale
    return { page, orientation, pageW, pageH, x: (pageW - w) / 2, y: PAGE_MARGIN, w, h, scale, small: scale < SMALL_SCALE }
  }

  // Orientación automática: la que aprovecha mejor la página (a igualdad, la de la forma del diagrama).
  const best = (page) => {
    if (options.orientation !== 'auto') return fit(page, options.orientation)
    const portrait = fit(page, 'portrait')
    const landscape = fit(page, 'landscape')
    if (Math.abs(portrait.scale - landscape.scale) < 1e-9) return image.width > image.height ? landscape : portrait
    return landscape.scale > portrait.scale ? landscape : portrait
  }

  if (options.page !== 'auto') return best(PAGE_SIZES.find((p) => p.id === options.page) ?? PAGE_SIZES[1])
  const a4 = best(PAGE_SIZES[1])
  return a4.scale >= MIN_READABLE_SCALE ? a4 : best(PAGE_SIZES[2])
}
