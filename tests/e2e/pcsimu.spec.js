import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor, openExample } from './helpers'

test('exportar a PC_SIMU: el panel en .sim y el programa en .awl, con los avisos de lo que no pasa', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Marcha y paro de un motor/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Planta para PC_SIMU/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Planta para PC_SIMU' })
  await expect(dialog.locator('[data-pcsimu-count]')).toHaveText('3 elementos en el panel.')
  await expect(dialog).toContainText('no se exportan: Motor (1)')

  const sim = await download(page, () => dialog.getByRole('button', { name: 'Panel .sim' }).click())
  expect(sim.suggestedFilename()).toMatch(/-pc-simu\.sim$/)
  const text = (await readFile(await sim.path())).toString('latin1')
  expect(text).toMatch(/^PC_SIMU\*  1\* 50\*/)
  expect(text).toMatch(/\*\$\$\$$/)
  const awl = await download(page, () => dialog.getByRole('button', { name: 'Programa .awl' }).click())
  expect(awl.suggestedFilename()).toMatch(/-s7-200\.awl$/)

  await dialog.getByTitle('Cerrar').click()
  await expect(dialog).toBeHidden()
  expectNoErrors(errors)
})
