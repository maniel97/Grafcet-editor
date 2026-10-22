import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, exportFromMore, openEditor, openExample } from './helpers'

test('exportar a PC_SIMU: el panel en .sim y el programa en .awl, con el motor de la planta', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Marcha y paro de un motor/)
  await exportFromMore(page, /Planta para PC_SIMU/)
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
  await exportFromMore(page, /Planta para PC_SIMU/)
  const dialog = page.getByRole('dialog', { name: 'Planta para PC_SIMU' })
  await expect(dialog).toContainText('el .awl pone Q0.6 = NOT Q0.3')
  const awl = await download(page, () => dialog.getByRole('button', { name: 'Programa .awl' }).click())
  const text = (await readFile(await awl.path())).toString('latin1')
  expect(text).toContain('LDN    Q0.3\r\n=      Q0.6\r\nNetwork')
  expect(text).toContain('LDN    Q0.4\r\n=      Q0.7\r\nEND_ORGANIZATION_BLOCK')
  expectNoErrors(errors)
})

test('importar de PC_SIMU: al abrir un .sim, su panel y su planta pasan a la planta virtual, con sus variables', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Marcha y paro de un motor/)
  await exportFromMore(page, /Planta para PC_SIMU/)
  const dialog = page.getByRole('dialog', { name: 'Planta para PC_SIMU' })
  const sim = await download(page, () => dialog.getByRole('button', { name: 'Panel .sim' }).click())
  const bytes = await readFile(await sim.path())
  await dialog.getByTitle('Cerrar').click()

  // Proyecto nuevo, y Simular > Autómata S7-200 > Cargar planta .sim (junto a «Cargar .awl»)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('radio', { name: /Autómata S7-200/ }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Cargar planta .sim' }).click()
  await (await chooser).setFiles({ name: 'Practica.sim', mimeType: 'application/octet-stream', buffer: bytes })
  const report = page.getByRole('status', { name: 'Importado de PC_SIMU' })
  await expect(report).toContainText('El programa no va en el .sim')
  await report.getByRole('button', { name: 'Cerrar el aviso' }).click()
  await expect(report).toBeHidden()
  await expect(page.getByRole('button', { name: /Planta virtual/ })).toContainText('4 elementos')
  await expect(page.getByRole('region', { name: 'Escena de la planta' }).getByRole('region', { name: 'Panel de control' }).locator('[aria-label="Pulsador Marcha"]')).toBeVisible()
  expectNoErrors(errors)
})

test('importar de PC_SIMU: el aviso dice lo que no ha pasado y por qué (pospuesto, no olvidado)', async ({ page }) => {
  const errors = await openEditor(page)
  // Un .sim con un led y un objeto de un tipo que el editor no conoce.
  const zeros = Array(14).fill(0).join('*')
  const led = `0*11#*10*10*35*35*1*0*0*0*${Array(10).fill(0).join('*')}###*0*0`
  const unknown = `1*99#*100*10*140*50*${zeros}###*0*0`
  const bytes = Buffer.from(`PC_SIMU*  1* 50*${led}**${unknown}*$$$`, 'latin1')
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('radio', { name: /Autómata S7-200/ }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Cargar planta .sim' }).click()
  await (await chooser).setFiles({ name: 'Paso.sim', mimeType: 'application/octet-stream', buffer: bytes })
  const report = page.getByRole('status', { name: 'Importado de PC_SIMU' })
  await expect(report).toContainText('objeto de tipo 99')
  await expect(report).toContainText('Si hay suficiente demanda, se implementará por completo.')
  expectNoErrors(errors)
})
