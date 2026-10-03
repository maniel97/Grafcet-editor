import { expect, test } from '@playwright/test'
import { execSync } from 'node:child_process'

const controlled = (page) => page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 })

test('instalable, sin conexión y con aviso de versión nueva', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForSelector('.react-flow__node')
  // Instalable: manifiesto con iconos y service worker controlando la página.
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json())
  expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
  await controlled(page)

  // Sin conexión: carga y abre partes que se descargan bajo demanda.
  await context.setOffline(true)
  await page.reload()
  await page.waitForSelector('.react-flow__node')
  await page.getByTitle(/Paso a ladder/).click()
  await expect(page.locator('[data-ladder-svg]')).toBeVisible()
  await page.getByTitle(/Exportar a PDF/).click()
  await expect(page.getByLabel('Vista previa de la página')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Ladder generado' }).getByTitle('Cerrar (Esc)').click()
  await page.getByTitle('Abrir un proyecto, un ejemplo o un trabajo anterior').click()
  await page.getByRole('menuitem', { name: /Ejemplos/ }).click()
  await page.getByRole('button', { name: /Mezcladora/ }).click()
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Mezcladora')
  await context.setOffline(false)

  // Versión nueva: se compila otra vez (otro número) y la página avisa sin recargar sola.
  const before = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL)
  execSync('node node_modules/vite/bin/vite.js build', { stdio: 'ignore' })
  await page.reload()
  const banner = page.getByRole('status').filter({ hasText: 'Hay una versión nueva del editor' })
  await expect(banner).toBeVisible({ timeout: 30_000 })
  await banner.getByRole('button', { name: /Recargar/ }).click()
  await page.waitForSelector('.react-flow__node')
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).not.toBe(before)
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Mezcladora') // el trabajo sigue
})
