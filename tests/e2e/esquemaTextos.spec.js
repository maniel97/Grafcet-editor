import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { openEditor, openExample, saveFromDialog } from './helpers'
import { schematicOverlaps } from './overlaps'
import { staticOverlaps } from './staticOverlaps'
import { ELEC_TEMPLATES } from '../../src/lib/elec/templates'
import { EXAMPLES } from '../../src/lib/examples'

// Nada se pisa en el esquema: ni rótulos con aparatos, cables u otros rótulos, ni cables montados
// unos sobre otros. Medido en el navegador (editor) y en el SVG exportado (plano).

test('esquema eléctrico: ningún montaje tiene textos que se pisen (editor y plano exportado)', async ({ page, browser }) => {
  test.setTimeout(240000)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  await view.getByRole('button', { name: 'Pantalla completa' }).click()
  for (const t of ELEC_TEMPLATES) {
    await view.getByLabel('Insertar montaje').selectOption(t.id)
    await expect(view.locator('.react-flow__node').first()).toBeVisible()
    await page.waitForTimeout(300) // reencuadre
    expect(await schematicOverlaps(page), `editor: ${t.id}`).toEqual([])
    await view.getByRole('button', { name: 'Exportar el esquema' }).click()
    const file = await saveFromDialog(page, 'svg')
    expect(await staticOverlaps(browser, readFileSync(await file.path(), 'utf8')), `plano: ${t.id}`).toEqual([])
    await page.keyboard.press('Escape')
    await view.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await expect(view.locator('.react-flow__node')).toHaveCount(0)
  }
})

test('esquema eléctrico: «Conexiones del autómata» sin textos que se pisen', async ({ page }) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openEditor(page)
  // Pulsadores y bobinas; detectores de 3 hilos; analógica 4-20 mA; electroneumática (ya montada).
  for (const id of ['marcha-paro', 'clasificadora-tamano', 'deposito-nivel', 'electroneumatica']) {
    const ex = EXAMPLES.find((e) => e.id === id)
    await openExample(page, ex.title)
    const button = page.getByRole('button', { name: 'Esquema eléctrico' })
    await button.click()
    const view = page.getByRole('region', { name: 'Esquema eléctrico' })
    await view.getByRole('button', { name: 'Pantalla completa' }).click()
    if (id !== 'electroneumatica') await view.getByRole('button', { name: 'Conexiones del autómata' }).click()
    await expect(view.locator('[data-elec="plc"]')).toBeVisible()
    await page.waitForTimeout(300)
    expect(await schematicOverlaps(page), id).toEqual([])
    await button.click()
  }
})
