import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor, saveFromDialog } from './helpers'

// ¿Queda todo lo dibujado dentro del área visible del lienzo? Devuelve el peor desborde o null.
const overflow = (page) =>
  page.evaluate(() => {
    const pane = document.querySelector('.react-flow').getBoundingClientRect()
    let worst = null
    for (const el of document.querySelectorAll('.react-flow__node, .react-flow__node *, .react-flow__edge path:not(.react-flow__edge-interaction)')) {
      if (el.closest('.react-flow__handle, .editor-only, .ghost-preview')) continue
      const r = el.getBoundingClientRect()
      if (!r.width && !r.height) continue
      const out = Math.max(pane.left - r.left, r.right - pane.right, pane.top - r.top, r.bottom - pane.bottom)
      if (out > 0.5 && (!worst || out > worst.out)) worst = { out: Math.round(out), what: el.textContent?.slice(0, 30) }
    }
    return worst
  })

for (const width of [1500, 1280, 1100]) {
  test(`barra a ${width}px: compacta y submenú Exportar`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const errors = await openEditor(page)
    await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toHaveText('')
    await expect(page.getByRole('button', { name: 'Rehacer', exact: true })).toHaveText('')
    expect(await page.locator('header').evaluate((h) => h.scrollWidth <= h.clientWidth + 1)).toBe(true)

    const exportBtn = page.getByRole('button', { name: /Exportar/ })
    const menu = page.getByRole('menu', { name: 'Formatos de exportación' })
    await exportBtn.click()
    await expect(menu.getByRole('menuitem')).toHaveCount(6) // PNG, SVG, PDF, dossier, ejercicio y compartir
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await exportBtn.click()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter') // SVG: abre el diálogo con vista previa
    await expect(page.getByLabel('Vista previa de la imagen')).toBeVisible()
    expect((await saveFromDialog(page, 'svg')).suggestedFilename()).toBe('grafcet.svg')
    await exportBtn.click()
    await menu.getByRole('menuitem', { name: /PNG/ }).click()
    expect((await saveFromDialog(page, 'png')).suggestedFilename()).toBe('grafcet.png')
    // PDF abre su diálogo (probado aparte en pdf.spec.js).
    await exportBtn.click()
    await menu.getByRole('menuitem', { name: /PDF/ }).click()
    await expect(page.getByRole('dialog', { name: 'Exportar', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    expectNoErrors(errors)
  })
}

test('encuadre: todo lo dibujado visible al cargar y con el botón', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 750 })
  const errors = await openEditor(page, 'encuadre-y-tabla.json')
  await expect.poll(() => overflow(page)).toBe(null)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Acercar', exact: true }).click()
  await expect.poll(() => overflow(page)).not.toBe(null)
  await page.getByRole('button', { name: 'Encuadrar todo el diagrama' }).click()
  await expect.poll(() => overflow(page)).toBe(null)
  expectNoErrors(errors)
})

test('al conectar, solo se marcan en verde los destinos válidos según la norma', async ({ page }) => {
  const errors = await openEditor(page)
  // Etapa nueva y libre: desde su salida solo se puede ir a entradas de transiciones.
  await page.getByRole('button', { name: 'Etapa', exact: true }).click()
  const newStep = page.locator('.react-flow__node-step').last()
  await newStep.hover()
  const source = newStep.locator('.grafcet-handle.source')
  const box = await source.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 80, box.y + 120, { steps: 5 })

  const candidates = page.locator('.grafcet-handle.is-candidate')
  await expect(candidates.first()).toBeVisible()
  const kinds = await candidates.evaluateAll((els) =>
    els.map((el) => `${el.closest('.react-flow__node').classList.contains('react-flow__node-transition') ? 'transición' : 'etapa'}:${el.classList.contains('target') ? 'entrada' : 'salida'}`),
  )
  expect(new Set(kinds)).toEqual(new Set(['transición:entrada']))

  await page.mouse.up()
  await expect(candidates).toHaveCount(0)
  expectNoErrors(errors)
})

test('bloqueo de edición: impide editar y se puede quitar', async ({ page }) => {
  const errors = await openEditor(page, 'encuadre-y-tabla.json')
  const nodeCount = () => page.locator('.react-flow__node').count()
  const before = await nodeCount()
  await page.getByRole('button', { name: /Bloquear la edición/ }).click()
  await expect(page.getByText('Edición bloqueada')).toBeVisible()

  const s1 = page.locator('.react-flow__node[data-id="s1"]')
  const pos0 = await s1.evaluate((el) => el.style.transform)
  await s1.click()
  await expect(page.locator('.react-flow__node-toolbar button')).toHaveCount(0)
  await page.keyboard.press('Delete')
  expect(await nodeCount()).toBe(before)
  const box = await s1.boundingBox()
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 140, box.y + 60, { steps: 6 })
  await page.mouse.up()
  expect(await s1.evaluate((el) => el.style.transform)).toBe(pos0)
  await s1.dblclick()
  await expect(page.getByRole('heading', { name: 'Etapa', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Etapa', exact: true })).toBeDisabled()
  await expect(page.locator('.react-flow__node[data-id="variables-table"] button[title="Clic para editar"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click()
  await s1.click()
  await expect(page.locator('.react-flow__node-toolbar button').first()).toBeVisible()
  expectNoErrors(errors)
})
