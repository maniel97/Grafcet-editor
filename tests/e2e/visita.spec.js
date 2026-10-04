import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor } from './helpers'

// Visita guiada de la primera vez: se ofrece, se recorre (con los pasos que esperan a que el
// usuario haga algo) y no se vuelve a ofrecer.
test('visita guiada: se ofrece la primera vez y se recorre entera', async ({ page }) => {
  const errors = await openEditor(page, undefined, { tour: true })
  const offer = page.getByRole('status').filter({ hasText: 'visita guiada' })
  await expect(offer).toBeVisible()
  await offer.getByRole('button', { name: 'Empezar' }).click()
  const bubble = page.locator('.tour section')
  const next = bubble.getByRole('button', { name: /^(Siguiente|Terminar)$/ })
  const titles = []
  for (let i = 0; i < 30; i++) {
    const title = await bubble.locator('h2').textContent()
    titles.push(title)
    // Lo señalado tiene que verse (salvo en la bienvenida, en el centro).
    if (i > 0) await expect(page.locator('[data-tour-spot]')).toBeVisible()
    if (await bubble.locator('[data-tour-task="pendiente"]').count()) {
      await expect(next).toBeDisabled()
      await page.locator('[data-tour="Simular"]').click() // Simular y, después, Detener
      await expect(bubble.locator('[data-tour-task="hecho"]')).toBeVisible()
    }
    const label = await next.textContent()
    await next.click()
    if (label === 'Terminar') break
  }
  expect(titles[0]).toBe('Bienvenido al editor GRAFCET')
  expect(titles).toContain('Simular')
  expect(titles.at(-1)).toBe('Ayuda')
  await expect(page.locator('.tour')).toHaveCount(0)
  // No se vuelve a ofrecer; se repite desde Ayuda.
  await page.reload()
  await page.waitForSelector('.react-flow__node')
  await expect(page.getByRole('status').filter({ hasText: 'visita guiada' })).toHaveCount(0)
  await page.getByTitle(/^Atajos y notación/).click()
  await page.getByRole('button', { name: 'Visita guiada' }).click()
  await expect(page.locator('.tour section h2')).toHaveText('Bienvenido al editor GRAFCET')
  await page.keyboard.press('Escape')
  await expect(page.locator('.tour')).toHaveCount(0)
  expectNoErrors(errors)
})
