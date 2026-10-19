import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor, openExample } from './helpers'

test('exportar a PC_SIMU: el panel en .sim y el programa en .awl, con el motor de la planta', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Marcha y paro de un motor/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Planta para PC_SIMU/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Planta para PC_SIMU' })
  await expect(dialog.locator('[data-pcsimu-count]')).toHaveText('4 elementos en el panel.') // marcha, paro, piloto y el motor
  await expect(dialog).not.toContainText('Todavía no pasan')

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

test('exportar a PC_SIMU: los cilindros con vuelta por muelle llevan su salida de recoger en el .awl', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Estación de elevación/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Planta para PC_SIMU/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Planta para PC_SIMU' })
  await expect(dialog).toContainText('el .awl pone Q0.6 = NOT Q0.3')
  const awl = await download(page, () => dialog.getByRole('button', { name: 'Programa .awl' }).click())
  const text = (await readFile(await awl.path())).toString('latin1')
  expect(text).toContain('LDN    Q0.3\r\n=      Q0.6\r\nNetwork')
  expect(text).toContain('LDN    Q0.4\r\n=      Q0.7\r\nEND_ORGANIZATION_BLOCK')
  expectNoErrors(errors)
})
