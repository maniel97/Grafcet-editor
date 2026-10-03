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

test('esquema eléctrico: el esquema de cada ejemplo, sin textos que se pisen', async ({ page }) => {
  test.setTimeout(240000)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openEditor(page)
  // Todos los ejemplos traen su esquema (el cableado del autómata; en electroneumática, también el
  // aire): pulsadores y bobinas, detectores de 3 hilos, analógica 4-20 mA…
  for (const ex of EXAMPLES) {
    const id = ex.id
    // El botón se llama «título descripción etiquetas»: título y principio de la descripción (hay
    // títulos que empiezan igual, como «Taladradora» y «Taladradora con marcha de verificación»).
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`)
    await openExample(page, new RegExp(`^${esc(ex.title)}\\s*${esc(ex.description.slice(0, 15))}`))
    const button = page.getByRole('button', { name: 'Esquema eléctrico' })
    await button.click()
    const view = page.getByRole('region', { name: 'Esquema eléctrico' })
    await view.getByRole('button', { name: 'Pantalla completa' }).click()
    await expect(view.locator('[data-elec="plc"]')).toBeVisible()
    await page.waitForTimeout(300)
    expect(await schematicOverlaps(page), id).toEqual([])
    await button.click()
  }
})
