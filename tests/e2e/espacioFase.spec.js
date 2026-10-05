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
  const diagram = section.locator('svg[data-space-phase="fase"]')
  // Marcha (reintentando: con el equipo cargado, la planta puede estar aún colocándose y la
  // pulsación perderse) hasta que se mueve algún cilindro.
  await expect(async () => {
    await hold(page, 'Pulsador Marcha')
    await expect(diagram).toHaveCount(1, { timeout: 3000 })
  }).toPass({ timeout: 20000 })
  // Un ciclo entero: 4 fases y la vuelta («5=1»).
  await expect(diagram.locator('[data-phase-label]').last()).toHaveText('5=1', { timeout: 30000 })
  await expect(diagram.locator('[data-cylinder]')).toHaveCount(2)
  await expect(diagram.locator('[data-phase-label]')).toHaveText(['1', '2', '3', '4', '5=1'])

  await section.getByRole('radio', { name: 'Tiempo' }).click()
  await expect(section.locator('svg[data-space-phase="tiempo"]')).toBeVisible()
  await page.screenshot({ path: `${process.env.SHOT ?? 'test-results'}/espacio-tiempo.png` })
  await section.getByRole('radio', { name: 'Fases' }).click()
  await diagram.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${process.env.SHOT ?? 'test-results'}/espacio-fase.png` })

  // Comparación con la secuencia esperada (se guarda en el proyecto) y líneas de señal.
  const sequence = section.getByLabel('Secuencia esperada')
  await sequence.fill('A+ B+ B- A-')
  await expect(section.getByRole('status')).toHaveText('Fase 3: se esperaba B− y se ha hecho A−.')
  await sequence.fill('A+ B+ A- B-')
  await expect(section.getByRole('status')).toHaveText('✓ Coincide con la secuencia esperada.')
  await expect(diagram.locator('[data-expected]')).toHaveCount(2)
  await section.getByLabel('Líneas de señal (finales de carrera)').check()
  await expect(diagram.locator('[data-signal]')).toHaveCount(3)
  await diagram.scrollIntoViewIfNeeded()
  await diagram.screenshot({ path: `${process.env.SHOT ?? 'test-results'}/senales.png` })

  // Exportar: el diálogo con la vista previa.
  await section.getByRole('button', { name: 'Imagen o PDF' }).click()
  await expect(page.getByRole('dialog').filter({ hasText: 'espacio-fase' })).toBeVisible()
  expectNoErrors(errors)
})

// El generador neumático enseña el diagrama teórico y deja la secuencia como «esperada».
test('generador neumático: diagrama teórico y secuencia esperada', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /^Abrir/ }).click()
  await page.getByRole('menuitem', { name: /Secuencia neumática/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Secuencia neumática' })
  await dialog.getByLabel('Secuencia').fill('A+ B+ B- A-')
  const preview = dialog.locator('svg[data-space-phase="fase"]')
  await expect(preview.locator('[data-phase-label]')).toHaveText(['1', '2', '3', '4', '5=1'])
  await expect(preview.locator('[data-signal]')).toHaveText(['a1', 'b1', 'b0'])
  await dialog.getByRole('button', { name: 'Crear grafcet' }).click()
  await page.locator('[data-tour="Simular"]').click()
  await expect(page.locator('[data-tour="espacio-fase"]').getByLabel('Secuencia esperada')).toHaveValue('A+ B+ B− A−')
  expectNoErrors(errors)
})
