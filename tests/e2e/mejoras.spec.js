import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor } from './helpers'

// Carga un proyecto desde un objeto (sin archivo en disco).
export async function loadProject(page, project) {
  await page.locator('input[type=file]').setInputFiles({
    name: 'proyecto.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'grafcet-editor', version: 1, ...project })),
  })
  await page.waitForTimeout(400)
}

const position = (page, id) =>
  page.locator(`.react-flow__node[data-id="${id}"]`).evaluate((el) => {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform)
    return { x: Number(m[1]), y: Number(m[2]) }
  })

test('alinear en columna y espaciar la secuencia (con deshacer)', async ({ page }) => {
  const errors = await openEditor(page)
  await loadProject(page, {
    nodes: [
      { id: 's0', type: 'step', position: { x: 200, y: 0 }, data: { label: '0', initial: true, actions: [] } },
      { id: 't1', type: 'transition', position: { x: 260, y: 150 }, data: { condition: 'a' } },
      { id: 's1', type: 'step', position: { x: 150, y: 320 }, data: { label: '1', actions: [] } },
      { id: 't2', type: 'transition', position: { x: 230, y: 500 }, data: { condition: 'b' } },
    ],
    edges: [
      { id: 'a', source: 's0', target: 't1' },
      { id: 'b', source: 't1', target: 's1' },
      { id: 'c', source: 's1', target: 't2' },
    ],
  })
  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('Control+a')
  await page.locator('.react-flow__node[data-id="s1"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Alinear en columna' }).click()
  for (const id of ['t1', 's1', 't2']) expect((await position(page, id)).x).toBe(200)

  await page.locator('.react-flow__node[data-id="s1"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Espaciar la secuencia/ }).click()
  expect((await position(page, 't1')).y).toBe(100)
  expect((await position(page, 's1')).y).toBe(170)
  expect((await position(page, 't2')).y).toBe(270)

  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('Control+z')
  expect((await position(page, 't2')).y).toBe(500) // deshace el espaciado
  expectNoErrors(errors)
})

test('notas: crear, escribir, editar, color, copiar y no afectan a la verificación', async ({ page }) => {
  const errors = await openEditor(page)
  const badge = () => page.getByTitle('Verificar conformidad con IEC 60848').innerText()
  const badgeBefore = await badge()

  await page.getByTitle('Añadir una nota de texto').click()
  const editor = page.getByLabel('Texto de la nota')
  await expect(editor).toBeFocused() // una nota nueva se abre para escribir
  await editor.fill('Enunciado: taladradora\nPulsar Marcha para empezar')
  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } })
  const note = page.locator('.react-flow__node-note')
  await expect(note).toContainText('Enunciado: taladradora')
  await expect(note).toContainText('Pulsar Marcha para empezar')

  // Doble clic: editar; Esc cancela.
  await note.dblclick()
  await page.getByLabel('Texto de la nota').fill('cambio descartado')
  await page.keyboard.press('Escape')
  await expect(note).toContainText('Enunciado: taladradora')

  // Color desde el menú contextual.
  await note.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Color azul' }).click()
  await expect(note.locator('[data-note-body]')).toHaveCSS('background-color', 'rgb(219, 234, 254)')

  // La verificación no la tiene en cuenta.
  expect(await badge()).toBe(badgeBefore)

  // Copiar y pegar conserva texto, color y tamaño.
  await note.click()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(page.locator('.react-flow__node-note')).toHaveCount(2)
  await expect(page.locator('.react-flow__node-note').last()).toContainText('Enunciado: taladradora')
  const [a, b] = await page.locator('.react-flow__node-note').evaluateAll((els) => els.map((el) => `${el.style.width}x${el.style.height}`))
  expect(b).toBe(a)

  // Deshacer el pegado.
  await page.keyboard.press('Control+z')
  await expect(page.locator('.react-flow__node-note')).toHaveCount(1)
  expectNoErrors(errors)
})

test('ejemplos y trabajos anteriores: abrir un ejemplo y recuperar lo que había', async ({ page }) => {
  const errors = await openEditor(page) // diagrama de ejemplo inicial, con «Motor M1»
  const openMenu = async (item) => {
    await page.getByTitle('Abrir un proyecto, un ejemplo o un trabajo anterior').click()
    await page.getByRole('menu', { name: 'Abrir' }).getByRole('menuitem', { name: item }).click()
  }

  await openMenu(/Ejemplos/)
  const dialog = page.getByRole('dialog', { name: 'Abrir' })
  await expect(dialog.getByRole('button', { name: /Mezcladora/ })).toBeVisible()
  await dialog.getByRole('button', { name: /Mezcladora/ }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.react-flow__node-step')).toHaveCount(8)
  await expect(page.locator('.react-flow__node-note')).toContainText('Mezcladora')
  // El ejemplo es conforme: Verificar en verde.
  await expect(page.getByTitle('Verificar conformidad con IEC 60848')).toContainText('✓')

  // Lo que había (el diagrama inicial) se ha guardado como trabajo anterior.
  await openMenu(/Trabajos anteriores/)
  const entry = dialog.getByRole('listitem').first()
  await expect(entry).toContainText('2 etapas · 2 transiciones')
  await expect(entry).toContainText('Antes de abrir el ejemplo «Mezcladora»')
  await entry.getByRole('button', { name: 'Recuperar' }).click()
  await expect(page.locator('.react-flow__node-step')).toHaveCount(2)
  await expect(page.getByText('Motor M1')).toBeVisible()

  // Y la mezcladora queda a su vez como trabajo anterior.
  await openMenu(/Trabajos anteriores/)
  await expect(dialog.getByRole('listitem').first()).toContainText('8 etapas · 8 transiciones')
  await page.keyboard.press('Escape')
  expectNoErrors(errors)
})

test.describe('pantalla táctil', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 1100, height: 800 } })

  // Pulsación larga con el dedo en (x, y): eventos de puntero táctiles reales en ese punto.
  async function longPress(page, x, y, ms = 700) {
    await page.evaluate(
      async ([px, py, wait]) => {
        const target = document.elementFromPoint(px, py)
        const opts = { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: px, clientY: py, pointerId: 7 }
        target.dispatchEvent(new PointerEvent('pointerdown', opts))
        await new Promise((r) => setTimeout(r, wait))
        target.dispatchEvent(new PointerEvent('pointerup', opts))
      },
      [x, y, ms],
    )
  }

  test('pulsación larga abre el menú contextual; doble toque edita', async ({ page }) => {
    const errors = await openEditor(page)
    // Conectores más grandes en pantallas táctiles.
    const handle = page.locator('.react-flow__node[data-id="s1"] .grafcet-handle').first()
    expect(await handle.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(23)

    // Pulsación larga en el lienzo vacío -> menú del lienzo.
    const pane = await page.locator('.react-flow__pane').boundingBox()
    await longPress(page, pane.x + 60, pane.y + pane.height - 80)
    await expect(page.getByRole('menu')).toContainText('Etapa inicial aquí')
    await page.keyboard.press('Escape')

    // Pulsación larga sobre una etapa -> su menú (uno solo).
    const s1 = await page.locator('.react-flow__node[data-id="s1"]').boundingBox()
    await longPress(page, s1.x + 28, s1.y + 28)
    await expect(page.getByRole('menu')).toHaveCount(1)
    await expect(page.getByRole('menu')).toContainText('Etapa 1')
    await page.keyboard.press('Escape')

    // Un toque corto no abre menú.
    await longPress(page, s1.x + 28, s1.y + 28, 100)
    await page.waitForTimeout(700)
    await expect(page.getByRole('menu')).toHaveCount(0)

    // Doble toque sobre la etapa -> panel de edición.
    await page.touchscreen.tap(s1.x + 28, s1.y + 28)
    await page.touchscreen.tap(s1.x + 28, s1.y + 28)
    await expect(page.getByRole('heading', { name: 'Etapa', exact: true })).toBeVisible()
    expectNoErrors(errors)
  })
})

test('variables de etapa E1 en vez de X1: tabla, lienzo, simulación y ladder', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByTitle(/Tabla de variables: direcciones/).click()
  const dialog = page.getByRole('dialog', { name: 'Tabla de variables' })
  await expect(dialog.getByRole('cell', { name: /^X0/ })).toBeVisible()
  await dialog.getByLabel('Nombre de las variables de etapa').selectOption('E')
  await expect(dialog.getByRole('cell', { name: /^E0/ })).toBeVisible()
  await dialog.getByLabel('Mostrar la tabla en el lienzo').check()
  await page.keyboard.press('Escape')

  const table = page.locator('.react-flow__node[data-id="variables-table"]')
  await expect(table).toContainText('E0')
  await expect(table).not.toContainText('X0')

  await page.getByRole('button', { name: /Simular/ }).click()
  await expect(page.locator('aside').getByRole('button', { name: 'E0', exact: true })).toBeVisible() // etapas activas
  await page.getByRole('button', { name: /Detener/ }).click()

  await page.getByTitle(/Paso a ladder/).click()
  await expect(page.locator('.inline-block > svg')).toContainText('Primer ciclo: activa E0')
  await page.keyboard.press('Escape')
  expectNoErrors(errors)
})

test('nombre del proyecto: archivos, ejemplos, pie del PDF y autoguardado', async ({ page }) => {
  const errors = await openEditor(page)
  const name = page.getByLabel('Nombre del proyecto')
  await expect(name).toHaveValue('')
  await name.fill('Prensa hidráulica')
  await expect(page).toHaveTitle('Prensa hidráulica · Grafcet Editor')

  const saved = await download(page, () => page.getByTitle(/Guardar proyecto/).click())
  expect(saved.suggestedFilename()).toBe('prensa-hidraulica.json')
  await page.getByRole('button', { name: /Exportar/ }).click()
  const png = await download(page, () => page.getByRole('menuitem', { name: /PNG/ }).click())
  expect(png.suggestedFilename()).toBe('prensa-hidraulica.png')

  // Pie del PDF propuesto con el nombre.
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  await expect(page.getByLabel('Título del pie de página')).toHaveValue('Prensa hidráulica')
  await page.keyboard.press('Escape')

  // Se conserva al recargar (autoguardado).
  await page.waitForTimeout(800)
  await page.reload()
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Prensa hidráulica')

  // Un ejemplo toma su nombre.
  await page.getByTitle('Abrir un proyecto, un ejemplo o un trabajo anterior').click()
  await page.getByRole('menuitem', { name: /Ejemplos/ }).click()
  await page.getByRole('button', { name: /Semáforo/ }).click()
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Semáforo')
  expectNoErrors(errors)
})
