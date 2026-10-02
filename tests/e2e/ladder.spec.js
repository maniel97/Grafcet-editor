import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor } from './helpers'

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

  expect((await download(page, () => page.getByTitle('Descargar el esquema en SVG').click())).suggestedFilename()).toBe('ladder-completo-ladder.svg')
  expect((await download(page, () => page.getByTitle('Descargar el esquema en PNG').click())).suggestedFilename()).toBe('ladder-completo-ladder.png')
  expect((await download(page, () => page.getByTitle(/PDF A4 paginado/).click())).suggestedFilename()).toBe('ladder-completo-ladder.pdf')

  await page.getByRole('tab', { name: /Texto estructurado/ }).click()
  await expect(page.locator('pre')).toContainText('Tr1 := X0 AND RT_Marcha.Q AND NOT Paro AND NOT Emergencia;')
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
