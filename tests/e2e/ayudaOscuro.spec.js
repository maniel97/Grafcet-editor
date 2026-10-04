import { expect, test } from '@playwright/test'
import { openEditor } from './helpers'

// Contraste de cada texto de la ayuda con su fondo real (WCAG: 4,5:1), en modo claro y oscuro,
// en el inicio, las páginas fijas y todos los artículos de la wiki.
async function lowContrast(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    // Cualquier color CSS (oklch incluido) a sRGB con su alfa.
    const rgba = (color) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return [r, g, b, a / 255]
    }
    const background = (el) => {
      const layers = []
      for (let n = el; n; n = n.parentElement) {
        const c = rgba(getComputedStyle(n).backgroundColor)
        if (c[3] > 0) layers.push(c)
        if (c[3] >= 1) break
      }
      let out = [255, 255, 255]
      for (const [r, g, b, a] of layers.reverse()) out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)]
      return out
    }
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const bad = []
    const dialog = document.querySelector('dialog[open]')
    for (const el of dialog.querySelectorAll('*')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (!own || !el.getClientRects().length) continue
      const bg = background(el)
      const [r, g, b, a] = rgba(getComputedStyle(el).color)
      const fg = [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)]
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x)
      const ratio = (hi + 0.05) / (lo + 0.05)
      if (ratio < 4.5) bad.push(`${ratio.toFixed(2)} «${el.textContent.trim().slice(0, 50)}»`)
    }
    return bad
  })
}

for (const theme of ['claro', 'oscuro']) {
  test(`ayuda legible en modo ${theme}`, async ({ page }) => {
    await openEditor(page)
    if (theme === 'oscuro') {
      await page.getByTitle('Opciones: tema, letra y tamaño').click()
      await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
      await page.keyboard.press('Escape')
    }
    await page.getByTitle(/^Atajos y notación/).click()
    const help = page.getByRole('dialog', { name: 'Ayuda' })
    await help.getByRole('button', { name: '¿Qué escribo en una receptividad?' }).click()
    const pages = await help.getByRole('navigation').getByRole('button').allTextContents()
    const problems = []
    for (const name of pages) {
      await help.getByRole('navigation').getByRole('button', { name, exact: true }).click()
      for (const p of await lowContrast(page)) problems.push(`${name}: ${p}`)
    }
    expect(problems).toEqual([])
  })
}
