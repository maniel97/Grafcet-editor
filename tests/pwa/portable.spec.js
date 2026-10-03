import { expect, test } from '@playwright/test'
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

test('versión portable: un solo HTML que funciona abierto como archivo, sin servidor', async ({ page }) => {
  test.setTimeout(180_000)
  execSync('npm run build:portable', { stdio: 'ignore' })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const requests = []
  page.on('request', (r) => !r.url().startsWith('data:') && !r.url().startsWith('blob:') && requests.push(r.url()))
  await page.goto(pathToFileURL(resolve('dist-portable/grafcet-editor.html')).href)
  await page.waitForSelector('.react-flow__node')
  // Partes que antes se cargaban bajo demanda: ladder, exportación a PDF y ejemplos.
  await page.getByTitle(/Paso a ladder/).click()
  await expect(page.locator('[data-ladder-svg]')).toBeVisible()
  await page.getByTitle(/Exportar a PDF/).click()
  await expect(page.getByLabel('Vista previa de la página')).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Guardar PDF' }).click()])
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  await page.getByRole('dialog', { name: 'Ladder generado' }).getByTitle('Cerrar (Esc)').click()
  await page.getByTitle('Abrir un proyecto, un ejemplo o un trabajo anterior').click()
  await page.getByRole('menuitem', { name: /Ejemplos/ }).click()
  await page.getByRole('button', { name: /Mezcladora/ }).click()
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Mezcladora')
  // Nada se pide fuera del propio archivo.
  expect(requests.filter((u) => !u.startsWith('file:'))).toEqual([])
  expect(requests.filter((u) => u.startsWith('file:') && !u.endsWith('grafcet-editor.html'))).toEqual([])
  expect(errors).toEqual([])
})
