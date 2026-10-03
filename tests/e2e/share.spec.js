import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor, openExample } from './helpers'

test('compartir por enlace: enlace con QR y abrirlo en otro navegador', async ({ page, browser }) => {
  const errors = await openEditor(page)
  await openExample(page, /Clasificadora por material/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Compartir por enlace/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Compartir por enlace' })
  const input = dialog.getByLabel('Enlace para compartir')
  await expect(input).toHaveValue(/#p=[A-Za-z0-9_-]+$/)
  await expect(dialog.getByRole('img', { name: 'Código QR del enlace' })).toBeVisible()
  await expect(dialog.getByRole('note')).toContainText('solo se abrirá aquí') // servidor local
  const link = await input.inputValue()

  // Otro navegador, sin nada guardado: ofrece abrirlo y lo abre entero (con su planta).
  const other = await browser.newContext()
  const p2 = await other.newPage()
  const errors2 = []
  p2.on('pageerror', (e) => errors2.push(e.message))
  await p2.goto(link)
  const banner = p2.getByRole('alertdialog', { name: 'Proyecto compartido' })
  await expect(banner).toContainText('«Clasificadora por material»')
  await banner.getByRole('button', { name: 'Abrir' }).click()
  await expect(p2.getByLabel('Nombre del proyecto')).toHaveValue('Clasificadora por material')
  await expect(p2.locator('.react-flow__node-step')).toHaveCount(3)
  expect(p2.url()).not.toContain('#p=') // el enlace se limpia
  await p2.getByRole('button', { name: /Simular/ }).click()
  await expect(p2.getByRole('region', { name: 'Escena de la planta' }).locator('[data-element="diverter"]')).toHaveCount(1)

  // Enlace recortado: mensaje claro.
  await p2.goto(link.slice(0, -20))
  await expect(p2.getByRole('alertdialog', { name: 'Proyecto compartido' })).toContainText('incompleto o dañado')
  expect(errors2).toEqual([])
  await other.close()
  expectNoErrors(errors)
})
