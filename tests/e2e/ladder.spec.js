import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor, saveFromDialog } from './helpers'

test('paso a ladder: esquema, exportaciones, ST y AWL', async ({ page }) => {
  const errors = await openEditor(page, 'ladder-completo.json')
  await page.getByTitle(/Tabla de variables: direcciones/).click()
  await page.getByRole('button', { name: /Rellenar vacías/ }).click()
  await page.keyboard.press('Escape')

  await page.getByTitle(/Paso a ladder/).click()
  const view = page.locator('[aria-label="Ladder generado"]')
  await expect(view.locator('header')).toContainText('16 segmentos')
  const svg = view.locator('.inline-block > svg')
  for (const title of ['Inicialización', 'Auxiliares', 'Condiciones de franqueo', 'Desactivación de etapas', 'Activación de etapas', 'Temporizaciones', 'Acciones memorizadas', 'Salidas']) {
    await expect(svg.getByText(title, { exact: true })).toHaveCount(1)
  }
  await expect(svg.getByText('CMP >=')).toHaveCount(1)
  await expect(svg.getByText('TON', { exact: true })).toHaveCount(1)
  await expect(svg.getByText('MW100').first()).toBeVisible()

  await page.getByTitle(/Exportar el esquema en SVG/).click()
  expect((await saveFromDialog(page, 'svg')).suggestedFilename()).toBe('ladder-completo-ladder.svg')
  await page.getByTitle(/Exportar el esquema en PNG/).click()
  expect((await saveFromDialog(page, 'png')).suggestedFilename()).toBe('ladder-completo-ladder.png')
  await page.getByTitle(/Exportar a PDF/).click()
  // El mismo diálogo de PDF que el grafcet, con páginas cortadas entre segmentos.
  await expect(page.getByLabel('Vista previa de la página')).toBeVisible()
  await expect(page.getByLabel('Páginas')).toContainText('Página 1 de 3')
  await page.getByLabel('Página siguiente').click()
  await expect(page.getByLabel('Páginas')).toContainText('Página 2 de 3')
  const pdf = await saveFromDialog(page, 'pdf')
  expect(pdf.suggestedFilename()).toBe('ladder-completo-ladder.pdf')
  // Tres páginas, vectorial (texto real, sin imagen) y sin perder caracteres del final.
  const bytes = readFileSync(await pdf.path(), 'latin1')
  expect(bytes).toMatch(/\/Count 3\b/)
  expect(bytes).not.toContain('/Subtype /Image')
  expect(bytes).toContain('desactiva las demás)')
  await expect(page.getByRole('dialog', { name: 'Ladder generado' })).toBeVisible() // Esc/guardar no cierra el ladder

  await page.getByRole('tab', { name: /Texto estructurado/ }).click()
  await expect(page.locator('pre')).toContainText('Tr1 := X0 AND RT_Marcha.Q AND NOT Paro AND NOT Emergencia;')
  await page.getByRole('tab', { name: /SCL \(TIA Portal\)/ }).click()
  await expect(page.locator('pre')).toContainText('FUNCTION_BLOCK "Grafcet"')
  await expect(page.locator('pre')).toContainText('#Tr1 := #X0 AND #RT_Marcha.Q AND NOT #Paro AND NOT #Emergencia;')
  expect((await download(page, () => page.getByRole('button', { name: '.scl' }).click())).suggestedFilename()).toBe('ladder-completo.scl')
  await page.getByRole('tab', { name: /AWL/ }).click()
  await expect(page.locator('pre')).toContainText('SPBN M001')
  await page.getByRole('radio', { name: /Inglés/ }).click()
  await expect(page.locator('pre')).toContainText('JCN M001')
  await page.getByRole('radio', { name: /^Símbolos$/ }).click()
  await expect(page.locator('pre')).toContainText('A "X0"')

  await page.keyboard.press('Escape')
  await expect(view).toHaveCount(0)
  expectNoErrors(errors)
})
