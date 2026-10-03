import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { download, expectNoErrors, openEditor } from './helpers'

// Tamaño de la página del PDF guardado, en puntos (1 mm = 72/25.4 pt), leído del /MediaBox.
function pdfPageSize(path) {
  const m = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(readFileSync(path, 'latin1'))
  return m && { width: Math.round(Number(m[1])), height: Math.round(Number(m[2])) }
}
const pt = (mm) => Math.round((mm * 72) / 25.4)

test('PDF: elegir tamaño y orientación, vista previa y página guardada coinciden', async ({ page }, testInfo) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()

  const dialog = page.getByRole('dialog', { name: 'Exportar', exact: true })
  const preview = dialog.getByLabel('Vista previa de la página')
  await expect(preview).toBeVisible() // la imagen ya está preparada
  await expect(dialog.getByRole('img', { name: /Diagrama tal como quedará/ })).toBeVisible()

  // Por defecto: automático (el ejemplo cabe en A4 vertical a tamaño real).
  await expect(preview).toHaveAttribute('data-page', 'a4-portrait')
  await expect(dialog).toContainText('A4 vertical · escala 100 % (tamaño real)')

  // A3 apaisado: la vista previa cambia de forma.
  await dialog.getByLabel('A3', { exact: true }).check()
  await dialog.getByLabel('Apaisada').check()
  await expect(preview).toHaveAttribute('data-page', 'a3-landscape')
  const box = await preview.boundingBox()
  expect(box.width / box.height).toBeCloseTo(420 / 297, 1)

  // Título del pie, visible en la vista previa.
  await dialog.getByLabel('Título del pie de página').fill('Taladradora - Grafcet de producción')
  await expect(preview).toContainText('Taladradora - Grafcet de producción')

  const file = await download(page, () => dialog.getByRole('button', { name: 'Guardar PDF' }).click())
  expect(file.suggestedFilename()).toBe('grafcet.pdf')
  const path = testInfo.outputPath('grafcet.pdf')
  await file.saveAs(path)
  expect(pdfPageSize(path)).toEqual({ width: pt(420), height: pt(297) })
  await expect(dialog).toHaveCount(0)

  // Recuerda las opciones al volver a abrirlo.
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  await expect(page.getByRole('dialog', { name: 'Exportar', exact: true }).getByLabel('A3', { exact: true })).toBeChecked()
  await expect(page.getByLabel('Vista previa de la página')).toHaveAttribute('data-page', 'a3-landscape')
  expectNoErrors(errors)
})

test('PDF: sin pie de página y la selección no aparece en la captura', async ({ page }) => {
  const errors = await openEditor(page)
  await page.locator('.react-flow__node[data-id="s1"]').click() // seleccionada (azul)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar', exact: true })
  await expect(dialog.getByLabel('Vista previa de la página')).toBeVisible()
  // Mientras se captura se quita la selección, y se restaura después.
  await expect(page.locator('.react-flow__node[data-id="s1"].selected')).toHaveCount(1)
  await dialog.getByLabel('Título y fecha').uncheck()
  await expect(dialog.getByLabel('Título del pie de página')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  expectNoErrors(errors)
})

test('PDF vectorial (por defecto): texto real sin imagen; desmarcado, imagen', async ({ page }, testInfo) => {
  const errors = await openEditor(page, 'ladder-completo.json')
  const save = async (name) => {
    const dialog = page.getByRole('dialog', { name: 'Exportar', exact: true })
    const file = await download(page, () => dialog.getByRole('button', { name: 'Guardar PDF' }).click())
    const path = testInfo.outputPath(name)
    await file.saveAs(path)
    return readFileSync(path, 'latin1')
  }
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  await expect(page.getByLabel(/^Vectorial/)).toBeChecked()
  const vector = await save('vectorial.pdf')
  expect(vector).not.toContain('/Subtype /Image')
  // El texto del diagrama va como texto (operador Tj), no dentro de una imagen.
  expect(vector).toMatch(/Marcha[^)]*\) Tj/)
  expect(vector).toMatch(/Emergencia[^)]*\) Tj/)

  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  await page.getByLabel(/^Vectorial/).uncheck()
  const raster = await save('imagen.pdf')
  expect(raster).toContain('/Subtype /Image')
  expect(raster).not.toContain('Emergencia')
  expectNoErrors(errors)
})

test('cajetín opcional: desactivado por defecto, datos en el proyecto y en cada página', async ({ page }, testInfo) => {
  const errors = await openEditor(page)
  const openPdf = async () => {
    await page.getByRole('button', { name: /Exportar/ }).click()
    await page.getByRole('menuitem', { name: /PDF/ }).click()
    return page.getByRole('dialog', { name: 'Exportar', exact: true })
  }
  let dialog = await openPdf()
  await expect(dialog.getByLabel('Incluir cajetín')).not.toBeChecked()
  await expect(dialog.getByLabel('Cajetín', { exact: true })).toHaveCount(0)
  await dialog.getByLabel('Incluir cajetín').check()
  await dialog.getByLabel('Cajetín: Autor').fill('M. Montes')
  await dialog.getByLabel('Cajetín: Nº de plano').fill('GR-007')
  await expect(dialog.getByLabel('Cajetín', { exact: true })).toContainText('GR-007')
  await expect(dialog.getByLabel('Título del pie de página')).toHaveCount(0) // sustituye al pie
  const file = await download(page, () => dialog.getByRole('button', { name: 'Guardar PDF' }).click())
  const path = testInfo.outputPath('cajetin.pdf')
  await file.saveAs(path)
  const bytes = readFileSync(path, 'latin1')
  expect(bytes).toContain('(GR-007)')
  expect(bytes).toContain('(1 de 1)')

  // Los datos se guardan con el proyecto.
  await page.waitForTimeout(800)
  await page.reload()
  dialog = await openPdf()
  await expect(dialog.getByLabel('Cajetín: Nº de plano')).toHaveValue('GR-007')
  expectNoErrors(errors)
})

test('zoom en la vista previa de exportación', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar', exact: true })
  const preview = dialog.getByLabel('Vista previa de la página')
  const width = async () => (await preview.boundingBox()).width
  const fit = await width()
  await dialog.getByLabel('Ampliar la vista previa').click()
  await dialog.getByLabel('Ampliar la vista previa').click()
  await expect(dialog.getByLabel('Zoom de la vista previa: ajustar')).toHaveText('200 %')
  expect(await width()).toBeCloseTo(fit * 2, 0)
  await dialog.getByLabel('Ajustar la vista previa').click()
  expect(await width()).toBeCloseTo(fit, 0)
  // Doble clic: ampliar y volver.
  await preview.dblclick()
  await expect(dialog.getByLabel('Zoom de la vista previa: ajustar')).toHaveText('250 %')
  await preview.dblclick()
  await expect(dialog.getByLabel('Zoom de la vista previa: ajustar')).toHaveText('100 %')
  expectNoErrors(errors)
})

test('los textos de ayuda de la tabla del lienzo no salen al exportar (queda el hueco)', async ({ page }, testInfo) => {
  const errors = await openEditor(page)
  await page.getByTitle(/Tabla de variables: direcciones/).click()
  await page.getByLabel('Mostrar la tabla en el lienzo').check()
  await page.keyboard.press('Escape')
  const table = page.locator('.react-flow__node[data-id="variables-table"]')
  await expect(table).toContainText('comentario') // en el lienzo, sí
  const rowsBefore = await table.boundingBox()

  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar', exact: true })
  const file = await download(page, () => dialog.getByRole('button', { name: 'Guardar PDF' }).click())
  const path = testInfo.outputPath('sin-ayudas.pdf')
  await file.saveAs(path)
  const bytes = readFileSync(path, 'latin1')
  expect(bytes).toMatch(/Marcha[^)]*\) Tj/) // la tabla sí sale
  expect(bytes).not.toContain('comentario')

  // Después, el lienzo sigue igual (con la ayuda y sin moverse).
  await expect(table).toContainText('comentario')
  expect((await table.boundingBox()).height).toBeCloseTo(rowsBefore.height, 0)
  expectNoErrors(errors)
})

test('PDF de todas las hojas: cada hoja en su página, con su nombre en el pie', async ({ page }, testInfo) => {
  const errors = await openEditor(page)
  const tabs = page.getByRole('tablist', { name: 'Hojas' })
  await tabs.getByLabel('Añadir hoja').click()
  await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 400, y: 300 } })
  await page.getByRole('menuitem', { name: 'Etapa aquí' }).click()
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar', exact: true })
  await dialog.getByLabel('Todas las hojas').check()
  await expect(dialog.getByLabel('Páginas')).toContainText('Página 1 de 2')
  await expect(dialog.getByLabel('Vista previa de la página')).toContainText('Hoja 1')
  await dialog.getByLabel('Página siguiente').click()
  await expect(dialog.getByLabel('Vista previa de la página')).toContainText('Hoja 2')
  const file = await download(page, () => dialog.getByRole('button', { name: 'Guardar PDF' }).click())
  const path = testInfo.outputPath('hojas.pdf')
  await file.saveAs(path)
  const bytes = readFileSync(path, 'latin1')
  expect(bytes).toMatch(/\/Count 2\b/)
  expect(bytes).toContain('Hoja 2')
  await expect(tabs.getByRole('tab', { name: 'Hoja 2' })).toHaveAttribute('aria-selected', 'true') // vuelve a la que estaba
  expectNoErrors(errors)
})
