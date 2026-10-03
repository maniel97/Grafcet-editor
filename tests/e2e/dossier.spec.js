import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor, openExample } from './helpers'

test('dossier de la práctica: vista previa paginada, secciones, enunciado y PDF', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Taladradora/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Dossier de la práctica/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Dossier de la práctica' })
  const preview = dialog.getByLabel('Vista previa del dossier')
  const pages = preview.getByRole('img', { name: /^Página \d+ de \d+$/ })
  await expect(pages.first()).toBeVisible({ timeout: 15000 })
  const count = await pages.count()
  expect(count).toBeGreaterThanOrEqual(5)

  // Portada e índice.
  await expect(pages.nth(0)).toContainText('Taladradora')
  await expect(pages.nth(1)).toContainText('Índice')
  await expect(pages.nth(1)).toContainText('Grafcet')
  await expect(pages.nth(1)).toContainText('Planta virtual')
  // El cronograma necesita un escenario: desactivado y explicado.
  await expect(dialog.getByLabel('Opciones del dossier')).toContainText('graba un escenario en la simulación')

  // Portada y enunciado (con formato); se guardan en el proyecto.
  await dialog.getByRole('textbox', { name: 'Alumno/a' }).fill('Ana Pérez')
  await dialog.getByRole('textbox', { name: /Enunciado/ }).fill('# Objetivo\nTaladrar piezas con **Marcha**.\n- Bajar\n- Subir')
  await expect(pages.nth(0)).toContainText('Ana Pérez')
  await expect(preview).toContainText('Objetivo')

  // Quitar el ladder: menos páginas.
  await dialog.getByRole('checkbox', { name: 'Ladder' }).uncheck()
  await expect.poll(() => pages.count()).toBeLessThan(count + 1)
  await expect(pages.nth(1)).not.toContainText('Ladder')

  // Guardar: un PDF de verdad, con tantas páginas como la vista previa.
  const total = await pages.count()
  const file = await download(page, () => dialog.getByRole('button', { name: 'Guardar PDF' }).click())
  expect(file.suggestedFilename()).toMatch(/dossier\.pdf$/)
  const pdf = readFileSync(await file.path(), 'latin1')
  expect(pdf.startsWith('%PDF')).toBe(true)
  expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBe(total)
  expect(pdf).toContain('Ana P') // texto real, no imagen

  // Se recuerda al volver a abrir.
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Dossier de la práctica/ }).click()
  await expect(dialog.getByRole('textbox', { name: 'Alumno/a' })).toHaveValue('Ana Pérez')
  await expect(dialog.getByRole('checkbox', { name: 'Ladder' })).not.toBeChecked()
  expectNoErrors(errors)
})

test('dossier: cronograma de un escenario grabado', async ({ page }) => {
  const errors = await openEditor(page, 'dossier-escenario.json')
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Dossier de la práctica/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Dossier de la práctica' })
  const pages = dialog.getByLabel('Vista previa del dossier').getByRole('img', { name: /^Página/ })
  await expect(pages.first()).toBeVisible({ timeout: 15000 })
  await expect(dialog.getByLabel('Escenario del cronograma')).toHaveValue('sc1')
  await expect(pages.nth(1)).toContainText('Cronograma')
  await expect(pages.last()).toContainText('Escenario: Arranque y paro')
  // Sin planta: su sección, desactivada y explicada.
  await expect(dialog.getByRole('checkbox', { name: /Planta virtual/ })).toBeDisabled()
  expectNoErrors(errors)
})
