import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor, openExample } from './helpers'

// La barra de herramientas no se desborda en un ordenador (desde 1024 px): quita los nombres que no caben y deja
// los iconos (antes, de 1536 a ~1900 px salía una barra de desplazamiento horizontal).
for (const width of [1024, 1280, 1440, 1600, 1707, 1920, 2560]) {
  test(`barra de herramientas sin desbordarse a ${width} px`, async ({ page }) => {
    const errors = await openEditor(page)
    await page.setViewportSize({ width, height: 900 })
    for (const simulating of [false, true]) {
      if (simulating) await page.getByTitle(/^Simular el grafcet/).click()
      const bar = page.locator('header.toolbar')
      await expect
        .poll(() => bar.evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThanOrEqual(1)
      // Con sitio de sobra, los nombres se ven.
      if (width >= 2560) await expect(bar.locator('.tb-label:visible').first()).toBeVisible()
    }
    expectNoErrors(errors)
  })
}

// El esquema eléctrico se estira hasta casi todo el ancho (antes, no más allá de ~la mitad) y, con
// la simulación y la planta abiertas, los paneles encogen en vez de desbordar la página.
test('el esquema eléctrico se estira y nada desborda la página', async ({ page }) => {
  const errors = await openEditor(page)
  await page.setViewportSize({ width: 1600, height: 950 })
  await openExample(page, /^Taladradora\s*Secuencia/)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).first().click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  const sep = view.getByRole('separator')
  const box = await sep.boundingBox()
  await page.mouse.move(box.x + 2, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(100, box.y + 200, { steps: 10 })
  await page.mouse.up()
  expect(await view.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(1300)
  await page.getByTitle(/^Simular el grafcet/).click()
  await expect(page.getByRole('region', { name: 'Escena de la planta' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  expectNoErrors(errors)
})
