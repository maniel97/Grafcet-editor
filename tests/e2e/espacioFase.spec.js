import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor, openExample } from './helpers'

// Pulsar un mando de la planta (pulsador: se mantiene un momento, como un dedo).
const hold = async (page, label) => {
  const b = await page.locator(`[data-tour="planta"] [aria-label="${label}"]`).first().boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
  await page.mouse.down()
  await page.waitForTimeout(150)
  await page.mouse.up()
}

// Diagrama espacio-fase de lo que ha hecho la planta: A+ B+ A− B−, el de los apuntes.
test('diagrama espacio-fase y espacio-tiempo de un ciclo de cilindros', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /^Cilindros A\+ B\+/)
  await page.locator('[data-tour="Simular"]').click()
  const section = page.locator('[data-tour="espacio-fase"]')
  await expect(section).toContainText('Aparece cuando se mueve algún cilindro')
  await hold(page, 'Pulsador Marcha')

  const diagram = section.locator('svg[data-space-phase="fase"]')
  // Un ciclo entero: 4 fases y la vuelta («5=1»).
  await expect(diagram.locator('[data-phase-label]').last()).toHaveText('5=1', { timeout: 15000 })
  await expect(diagram.locator('[data-cylinder]')).toHaveCount(2)
  await expect(diagram.locator('[data-phase-label]')).toHaveText(['1', '2', '3', '4', '5=1'])

  await section.getByRole('radio', { name: 'Tiempo' }).click()
  await expect(section.locator('svg[data-space-phase="tiempo"]')).toBeVisible()
  await page.screenshot({ path: `${process.env.SHOT ?? 'test-results'}/espacio-tiempo.png` })
  await section.getByRole('radio', { name: 'Fases' }).click()
  await diagram.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${process.env.SHOT ?? 'test-results'}/espacio-fase.png` })

  // Exportar: el diálogo con la vista previa.
  await section.getByRole('button', { name: 'Imagen o PDF' }).click()
  await expect(page.getByRole('dialog').filter({ hasText: 'espacio-fase' })).toBeVisible()
  expectNoErrors(errors)
})
