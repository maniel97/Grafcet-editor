import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor, openExample } from './helpers'

// Planta en el modo Editar: dimensionar arrastrando los tiradores (ratón y dedo) y gestos táctiles.
async function editPlant(page) {
  await openExample(page, /Clasificadora por material/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  return view
}

test('tiradores: estirar una cinta con el ratón, ver la medida y deshacer', async ({ page }) => {
  const errors = await openEditor(page)
  const view = await editPlant(page)
  // Una cinta nueva de la paleta: queda seleccionada, con sus tiradores.
  await view.getByRole('navigation', { name: 'Elementos' }).getByRole('button', { name: '+ Cinta' }).dblclick()
  const id = await view.locator('[data-handles]').getAttribute('data-handles')
  const conveyor = view.locator(`[data-element="conveyor"][data-id="${id}"]`)
  const before = await conveyor.boundingBox()
  await expect(view.locator('[data-handles] [data-handle="end"]')).toHaveCount(1)
  // El tirador del principio: estirar hacia la izquierda (el extremo derecho se queda quieto).
  const start = view.locator('[data-handles] [data-handle="start"]')
  const h = await start.boundingBox()
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(h.x + h.width / 2 - 40, h.y + h.height / 2, { steps: 5 })
  await expect(view.locator('[data-measure]')).toHaveText(/^\d+$/) // la medida, mientras se arrastra
  await page.mouse.up()
  await expect(view.locator('[data-measure]')).toHaveCount(0)
  const after = await conveyor.boundingBox()
  expect(after.width).toBeGreaterThan(before.width + 25)
  expect(Math.abs(after.x + after.width - (before.x + before.width))).toBeLessThan(2) // el extremo no se mueve
  // Un paso de deshacer.
  await page.keyboard.press('Control+z')
  await expect.poll(async () => Math.round((await conveyor.boundingBox()).width)).toBe(Math.round(before.width))
  expectNoErrors(errors)
})

test('pantalla táctil: botones grandes, tiradores con el dedo y pellizco para el zoom', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: false, viewport: { width: 1366, height: 900 } })
  const page = await context.newPage()
  const errors = await openEditor(page)
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
  const view = await editPlant(page)

  // Con puntero táctil, los botones de la planta miden al menos 40 px.
  if (coarse) {
    const sizes = await view.locator('header button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => Math.min(e.offsetWidth, e.offsetHeight)))
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(40)
  }

  // Tirador con el dedo (eventos táctiles reales, con CDP).
  const cdp = await context.newCDPSession(page)
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], i) => ({ x, y, id: i })) })
  await view.getByRole('navigation', { name: 'Elementos' }).getByRole('button', { name: '+ Cinta' }).dblclick()
  const id = await view.locator('[data-handles]').getAttribute('data-handles')
  const conveyor = view.locator(`[data-element="conveyor"][data-id="${id}"]`)
  const before = await conveyor.boundingBox()
  const h = await view.locator('[data-handles] [data-handle="start"]').boundingBox()
  const [hx, hy] = [h.x + h.width / 2, h.y + h.height / 2]
  await touch('touchStart', [[hx, hy]])
  for (let i = 1; i <= 5; i++) await touch('touchMove', [[hx - i * 10, hy]])
  await touch('touchEnd', [])
  expect((await conveyor.boundingBox()).width).toBeGreaterThan(before.width + 25)

  // Pellizco: dos dedos que se separan agrandan la vista.
  const zoomText = view.getByText(/^\d+ %$/).first()
  const zoomBefore = parseInt(await zoomText.textContent(), 10)
  const box = await view.locator('.paper.overflow-auto').first().boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]])
  for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx - 40 - i * 12, cy], [cx + 40 + i * 12, cy]])
  await touch('touchEnd', [])
  await expect.poll(async () => parseInt(await zoomText.textContent(), 10)).toBeGreaterThan(zoomBefore + 20)
  expectNoErrors(errors)
  await context.close()
})

// Tampón: un clic en la paleta carga la pieza; en la escena se ve su fantasma, un clic pone una y
// arrastrar pone una fila (un solo paso de deshacer). Esc o «Terminar» lo descargan.
test('tampón: una pieza, una fila arrastrando y deshacer', async ({ page }) => {
  const errors = await openEditor(page)
  const view = await editPlant(page)
  const sensors = view.locator('[data-element="sensor"]')
  const before = await sensors.count()
  await view.getByRole('navigation', { name: 'Elementos' }).getByRole('button', { name: '+ Detector óptico' }).click()
  await expect(view.locator('[data-stamp-status]')).toContainText('Detector óptico')
  const area = await view.locator('.paper.overflow-auto').first().boundingBox()
  const x0 = area.x + 60
  const y0 = area.y + area.height - 80
  await page.mouse.move(x0, y0)
  await expect(view.locator('[data-stamp-ghosts="1"]')).toHaveCount(1) // el fantasma bajo el cursor
  await page.mouse.click(x0, y0)
  await expect(sensors).toHaveCount(before + 1)
  // Una fila: arrastrar a la derecha.
  await page.mouse.move(x0, y0 - 60)
  await page.mouse.down()
  await page.mouse.move(x0 + 260, y0 - 60, { steps: 6 })
  const n = Number(await view.locator('[data-stamp-ghosts]').getAttribute('data-stamp-ghosts'))
  expect(n).toBeGreaterThan(2)
  await expect(view.locator('[data-stamp-count]')).toHaveText(`×${n}`)
  await page.mouse.up()
  await expect(sensors).toHaveCount(before + 1 + n)
  await page.keyboard.press('Control+z') // la fila entera
  await expect(sensors).toHaveCount(before + 1)
  await view.getByRole('button', { name: 'Terminar' }).click()
  await expect(view.locator('[data-stamp-status]')).toHaveCount(0)
  await expect(view.locator('[data-stamp-layer]')).toHaveCount(0)
  expectNoErrors(errors)
})

// Esquema eléctrico: tampón con vista previa (ratón) y con el dedo; doble clic, en un hueco libre.
test('esquema eléctrico: tampón con vista previa, con ratón y con el dedo', async ({ page, context }) => {
  await page.setViewportSize({ width: 1500, height: 950 })
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  await view.getByRole('button', { name: 'Pantalla completa' }).click()
  const palette = view.getByRole('navigation', { name: 'Aparatos' })
  const nodes = view.locator('.react-flow__node-elec:not(.elec-ghost)')
  const before = await nodes.count()
  const pane = view.locator('.react-flow__pane')
  const box = await pane.boundingBox()

  // Clic en la paleta: el tampón queda cargado.
  await palette.getByRole('button', { name: '+ Piloto' }).click()
  await expect(view.locator('[data-stamp-status]')).toContainText('Piloto')
  // La vista previa sigue al ratón.
  await page.mouse.move(box.x + 300, box.y + 250)
  await expect(view.locator('.elec-ghost')).toHaveCount(1)
  // Cada clic pone uno, donde se pulsa.
  for (const [dx, dy] of [[300, 250], [520, 250], [740, 250]]) await page.mouse.click(box.x + dx, box.y + dy)
  await expect(nodes).toHaveCount(before + 3)
  await expect(view.locator('[data-stamp-status]')).toContainText('3 puestos')

  // Con el dedo: un toque en el esquema pone otro.
  const cdp = await context.newCDPSession(page)
  const tap = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await tap(box.x + 300, box.y + 420)
  await expect(nodes).toHaveCount(before + 4)

  // Esc lo suelta: un clic en el fondo ya no pone nada.
  await page.keyboard.press('Escape')
  await expect(view.locator('[data-stamp-status]')).toHaveCount(0)
  await page.mouse.click(box.x + 600, box.y + 420)
  await expect(nodes).toHaveCount(before + 4)

  // Doble clic en la paleta: uno en el primer hueco libre, sin tampón.
  await palette.getByRole('button', { name: '+ Piloto' }).dblclick()
  await expect(nodes).toHaveCount(before + 5)
  await expect(view.locator('[data-stamp-status]')).toHaveCount(0)
  expectNoErrors(errors)
})
