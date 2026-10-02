import { describe, expect, it } from 'vitest'
import { pdfLayout, PAGE_MARGIN, PAGE_SIZES, FOOTER_SPACE } from '../../src/lib/pdfLayout'

const mm = (px) => (px * 25.4) / 96

describe('maquetación del PDF', () => {
  it('diagrama pequeño: A4, tamaño real (nunca se amplía), centrado y arriba', () => {
    const l = pdfLayout({ width: 300, height: 400 })
    expect(l.page.id).toBe('a4')
    expect(l.scale).toBe(1)
    expect(l.w).toBeCloseTo(mm(300))
    expect(l.x).toBeCloseTo((l.pageW - l.w) / 2)
    expect(l.y).toBe(PAGE_MARGIN)
  })

  it('orientación automática: apaisada para un diagrama ancho', () => {
    const l = pdfLayout({ width: 1000, height: 400 })
    expect(l.orientation).toBe('landscape')
    expect(l.pageW).toBe(297)
  })

  it('tamaño automático: pasa a A3 si en A4 quedaría demasiado reducido', () => {
    const l = pdfLayout({ width: 900, height: 2400 })
    expect(l.page.id).toBe('a3')
  })

  it('respeta el tamaño y la orientación elegidos', () => {
    const l = pdfLayout({ width: 900, height: 3600 }, { page: 'a4', orientation: 'landscape', footer: true })
    expect(l.page.id).toBe('a4')
    expect(l.orientation).toBe('landscape')
    expect(l.pageW).toBe(297)
    expect(l.pageH).toBe(210)
    expect(l.small).toBe(true) // muy reducido: se avisa
  })

  it('A4 como mínimo: no hay A5, y un A5 guardado de antes pasa a A4', () => {
    expect(PAGE_SIZES.map((p) => p.id)).not.toContain('a5')
    expect(pdfLayout({ width: 400, height: 300 }, { page: 'a5', orientation: 'portrait', footer: true }).page.id).toBe('a4')
  })

  it('el diagrama cabe siempre dentro de los márgenes (y del pie si lo hay)', () => {
    for (const footer of [true, false]) {
      const l = pdfLayout({ width: 3000, height: 3000 }, { page: 'a4', orientation: 'portrait', footer })
      expect(l.x).toBeGreaterThanOrEqual(PAGE_MARGIN - 1e-9)
      expect(l.y + l.h).toBeLessThanOrEqual(l.pageH - PAGE_MARGIN - (footer ? FOOTER_SPACE : 0) + 1e-9)
    }
  })

  it('sin pie de página hay algo más de sitio', () => {
    const big = { width: 1000, height: 3000 }
    const opts = { page: 'a4', orientation: 'portrait' }
    expect(pdfLayout(big, { ...opts, footer: false }).scale).toBeGreaterThan(pdfLayout(big, { ...opts, footer: true }).scale)
  })
})
