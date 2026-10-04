import { expect, test } from '@playwright/test'
import { openEditor, openExample } from './helpers'
import { EXAMPLES } from '../../src/lib/examples'

// Nada se pisa en la planta: ningún rótulo sobre el dibujo de otro elemento ni sobre otro rótulo,
// en la planta de cada ejemplo (medido en el navegador). Los rótulos se colocan solos donde hay
// sitio (SceneView.jsx, layoutLabels); esta prueba lo vigila.
test('planta: ningún ejemplo tiene rótulos que se pisen', async ({ page }) => {
  test.setTimeout(240000)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openEditor(page)
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`)
  for (const ex of EXAMPLES) {
    if (!ex.build().plc?.scene?.elements?.length) continue
    await openExample(page, new RegExp(`^${esc(ex.title)}\\s*${esc(ex.description.slice(0, 15))}`))
    await page.getByTitle(/^Simular el grafcet/).click()
    await expect(page.locator('svg[aria-label="Escena"]')).toBeVisible()
    await page.waitForTimeout(300)
    // Con y sin relieve: las caras del volumen cuentan como parte de su elemento.
    for (const relief of [false, true]) {
      if (relief) await page.getByRole('button', { name: 'Relieve' }).click()
    const found = await page.evaluate(() => {
      const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
      const labels = [...document.querySelectorAll('[data-label-of]')]
        .filter((l) => l.textContent.trim())
        .map((l) => ({ id: l.dataset.labelOf, text: l.textContent, r: l.getBoundingClientRect() }))
      const shapes = [...document.querySelectorAll('g[data-element][data-id]')].map((g) => ({
        id: g.dataset.id,
        type: g.dataset.element,
        r: g.querySelector(':scope > [data-shape]').getBoundingClientRect(),
      }))
      for (const f of document.querySelectorAll('[data-relief-of]')) shapes.push({ id: f.dataset.reliefOf, type: 'relieve de', r: f.getBoundingClientRect() })
      const issues = []
      for (const l of labels) {
        for (const s of shapes) if (s.id !== l.id && hit(l.r, s.r)) issues.push(`«${l.text}» pisa ${s.type} ${s.id}`)
        for (const o of labels) if (o.id < l.id && hit(l.r, o.r)) issues.push(`«${l.text}» pisa «${o.text}»`)
      }
      return issues
    })
      expect.soft(found, `${ex.id}${relief ? ' (relieve)' : ''}`).toEqual([])
    }
    await page.getByRole('button', { name: 'Relieve' }).click() // se guarda en el proyecto: se deja como estaba
    await page.getByTitle(/^Detener la simulación/).first().click()
  }
})

// «Pantalla completa» ocupa todo el sitio menos el panel de simulación (antes se quedaba en 1 px:
// las clases relative y absolute a la vez).
test('planta: pantalla completa ocupa el ancho', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 })
  await openEditor(page)
  await openExample(page, /^Cargador por gravedad/)
  await page.getByTitle(/^Simular el grafcet/).click()
  await page.getByTitle('Pantalla completa').first().click()
  const width = await page.locator('section[aria-label="Escena de la planta"]').evaluate((el) => el.getBoundingClientRect().width)
  expect(width).toBeGreaterThan(1000)
})
