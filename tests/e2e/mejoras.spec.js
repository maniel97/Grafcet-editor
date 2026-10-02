import { readFileSync } from 'node:fs'
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

test('móvil (390 px): sin desplazamiento de página y paneles abajo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = await openEditor(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.locator('.react-flow__minimap')).toBeHidden()
  await expect(page.getByLabel('Nombre del proyecto')).toBeVisible()

  await page.locator('.react-flow__node-step').first().dblclick()
  const panel = page.locator('aside.side-panel')
  await expect(panel).toBeVisible()
  const box = await panel.boundingBox()
  expect(box.width).toBeGreaterThan(380)
  expect(box.y + box.height).toBeGreaterThan(840)
  expect(box.height).toBeLessThanOrEqual(844 * 0.55 + 1)
  expectNoErrors(errors)
})

test('teclado: Alt + flechas recorre, Intro edita, flechas mueven con un solo deshacer', async ({ page }) => {
  const errors = await openEditor(page)
  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 500 } })
  const selected = () => page.locator('.react-flow__node.selected')

  await page.keyboard.press('Alt+ArrowDown') // sin selección: la etapa inicial
  await expect(selected()).toHaveCount(1)
  await expect(selected()).toHaveClass(/react-flow__node-step/)
  await expect(selected()).toContainText('0')
  await page.keyboard.press('Alt+ArrowDown')
  await expect(selected()).toHaveClass(/react-flow__node-transition/)
  await page.keyboard.press('Alt+ArrowDown')
  await expect(selected()).toContainText('1')
  await page.keyboard.press('Alt+ArrowUp')
  await expect(selected()).toHaveClass(/react-flow__node-transition/)
  await page.keyboard.press('Alt+ArrowDown')

  // Mover: 3 pulsaciones seguidas = 30 px y un solo Ctrl+Z.
  const before = await selected().boundingBox()
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expect.poll(async () => Math.round((await selected().boundingBox()).x - before.x)).toBeGreaterThan(20)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => Math.round((await page.locator('.react-flow__node-step').nth(1).boundingBox()).x - before.x)).toBe(0)

  // Intro abre el panel de la etapa seleccionada.
  await page.keyboard.press('Alt+ArrowUp')
  await page.keyboard.press('Alt+ArrowUp')
  await page.keyboard.press('Enter')
  await expect(page.getByLabel(/Número \/ nombre/i)).toHaveValue('0')
  expectNoErrors(errors)
})

test('teclado: Intro sigue pulsando los botones de la barra', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByTitle('Atajos y notación (?)').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('dialog[open]')).toBeVisible()
  expectNoErrors(errors)
})

test('modo oscuro: interfaz oscura, hoja blanca y se recuerda', async ({ page }) => {
  const errors = await openEditor(page)
  const bg = (sel) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor)
  await page.getByTitle('Opciones: tema, letra y tamaño').click()
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Escape')

  const luminance = (rgb) => {
    const m = rgb.match(/[\d.]+/g).map(Number)
    return rgb.startsWith('oklch') ? m[0] / 100 : (m[0] + m[1] + m[2]) / 765
  }
  expect(luminance(await bg('header'))).toBeLessThan(0.3)
  expect(luminance(await bg('.react-flow'))).toBeGreaterThan(0.9)
  // Tinta oscura en la hoja (el número de la etapa).
  expect(luminance(await page.locator('.react-flow__node-step').first().evaluate((el) => getComputedStyle(el).color))).toBeLessThan(0.3)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByTitle('Opciones: tema, letra y tamaño').click()
  await page.getByRole('button', { name: 'Claro', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expectNoErrors(errors)
})

test('escenarios: grabar, guardar en el proyecto, reproducir y exportar el cronograma', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  const panel = page.locator('aside.side-panel')
  const marcha = panel.getByRole('switch').nth(0)
  const paro = panel.getByRole('switch').nth(1)

  await panel.getByRole('button', { name: 'Grabar escenario' }).click()
  await expect(panel).toContainText('Grabando… 0 cambios')
  await page.waitForTimeout(300)
  await marcha.click()
  await marcha.click()
  await page.waitForTimeout(300)
  await paro.click()
  await paro.click()
  await page.waitForTimeout(200)
  await expect(panel).toContainText('Grabando… 4 cambios')
  await panel.getByRole('button', { name: 'Detener y guardar' }).click()
  await expect(panel.getByLabel('Nombre del escenario')).toHaveValue('Escenario 1')
  await panel.getByLabel('Nombre del escenario').fill('Marcha y paro')

  // Se guarda con el proyecto (autoguardado).
  await page.waitForTimeout(800)
  await page.reload()
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByLabel('Velocidad').selectOption('10')
  await panel.getByRole('button', { name: 'Reproducir Marcha y paro' }).click()
  await expect(panel.getByRole('heading')).toContainText('en pausa', { timeout: 5000 }) // se para sola al final
  await panel.getByRole('button', { name: /Registro de franqueos/ }).click()
  await expect(panel.locator('ol li')).toHaveCount(2)

  const csv = await download(page, () => panel.getByRole('button', { name: 'CSV', exact: true }).click())
  expect(csv.suggestedFilename()).toBe('cronograma.csv')
  const svg = await download(page, () => panel.getByRole('button', { name: 'SVG', exact: true }).click())
  expect(svg.suggestedFilename()).toBe('cronograma.svg')
  const svgText = readFileSync(await svg.path(), 'utf8')
  expect(svgText).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/)
  expect(svgText).toContain('>Marcha<')
  expect(readFileSync(await csv.path(), 'utf8')).toContain('t (s);X0;X1;Marcha;Paro;Motor M1')
  expectNoErrors(errors)
})
