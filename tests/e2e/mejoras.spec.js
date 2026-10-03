import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor, saveFromDialog } from './helpers'

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
  await expect(page.locator('[data-ladder-svg]')).toContainText('Primer ciclo: activa E0')
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
  await page.getByRole('menuitem', { name: /PNG/ }).click()
  const png = await saveFromDialog(page, 'png')
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
  await panel.getByRole('button', { name: 'Imagen o PDF…' }).click()
  const svg = await saveFromDialog(page, 'svg')
  expect(svg.suggestedFilename()).toBe('cronograma.svg')
  const svgText = readFileSync(await svg.path(), 'utf8')
  expect(svgText).toMatch(/^<\?xml[^>]*>\s*<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/)
  expect(svgText).toContain('>Marcha<')
  expect(readFileSync(await csv.path(), 'utf8')).toContain('t (s);X0;X1;Marcha;Paro;Motor M1')
  expectNoErrors(errors)
})

test('marcos: encerrar la selección, renombrar, mover con el contenido y forzados en Verificar', async ({ page }) => {
  const errors = await openEditor(page)
  const steps = page.locator('.react-flow__node-step')
  // Seleccionar todo y encerrarlo en un grafcet parcial.
  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 500 } })
  await page.keyboard.press('Control+a')
  await steps.first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Encerrar en un grafcet parcial' }).click()
  const frame = page.locator('.react-flow__node-frame')
  await expect(frame).toHaveCount(1)
  await expect(frame).toContainText('G1')

  // Renombrar con doble clic en el nombre.
  await frame.getByText('G1', { exact: true }).dblclick()
  await page.getByLabel('Nombre del marco').fill('G7')
  await page.keyboard.press('Enter')
  await expect(frame).toContainText('G7')

  // Arrastrar el marco por su nombre mueve también su contenido; un solo Ctrl+Z lo devuelve.
  const before = await steps.first().boundingBox()
  const label = await frame.getByText('G7', { exact: true }).boundingBox()
  await page.mouse.move(label.x + 5, label.y + 5)
  await page.mouse.down()
  await page.mouse.move(label.x + 105, label.y + 65, { steps: 8 })
  await page.mouse.up()
  const after = await steps.first().boundingBox()
  expect(Math.round(after.x - before.x)).toBeGreaterThan(80)
  expect(Math.round(after.y - before.y)).toBeGreaterThan(40)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => Math.round((await steps.first().boundingBox()).x - before.x)).toBe(0)

  // Un forzado a un grafcet que no existe es un error de Verificar.
  await steps.nth(1).dblclick()
  const panel = page.locator('aside.side-panel')
  await panel.getByRole('button', { name: /Añadir acción$/ }).click()
  await panel.getByLabel('Texto de la acción').last().fill('F/G9{1}')
  await page.keyboard.press('Escape')
  await page.getByTitle('Verificar conformidad con IEC 60848').click()
  await expect(page.getByText('F/G9{…} se refiere a un grafcet parcial que no existe', { exact: false })).toBeVisible()
  expectNoErrors(errors)
})

test('referencias de enlace: cortar un bucle largo, verlo con origen y destino, y unirlo', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByTitle('Abrir un proyecto, un ejemplo o un trabajo anterior').click()
  await page.getByRole('menuitem', { name: /Ejemplos/ }).click()
  await page.getByRole('button', { name: /Taladradora/ }).click()
  const loop = page.locator('[data-testid="rf__edge-t4-s0"]')
  const openMenu = async () => {
    const box = await loop.locator('.react-flow__edge-interaction').boundingBox()
    // Tramo vertical del bucle, a la izquierda (la zona sensible mide 16 px de ancho).
    await page.mouse.click(box.x + 8, box.y + box.height / 2, { button: 'right' })
  }
  await openMenu()
  await page.getByRole('menuitem', { name: 'Cortar con referencias' }).click()
  const labels = page.locator('[data-ref-label]')
  await expect(labels).toHaveCount(2)
  await expect(labels.nth(0)).toHaveText('a la etapa 0')
  await expect(labels.nth(1)).toHaveText('de «Fc_arriba»')
  // Sigue siendo el mismo enlace: el diagrama es conforme y la simulación cierra el ciclo.
  await expect(page.getByTitle('Verificar conformidad con IEC 60848')).toContainText('✓')

  // Cortado, el enlace son dos tramos cortos: clic derecho en el de origen, junto a su texto.
  const lb = await labels.nth(0).boundingBox()
  await page.mouse.click(lb.x - 10, lb.y + 2, { button: 'right' })
  await page.getByRole('menuitem', { name: 'Unir (quitar referencias)' }).click()
  await expect(labels).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(labels).toHaveCount(2)
  expectNoErrors(errors)
})

test('modo oscuro: la opción elegida de los selectores del ladder se lee', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('grafcet-editor:settings', JSON.stringify({ theme: 'dark' })))
  const errors = await openEditor(page)
  await page.getByTitle(/Paso a ladder/).click()
  await page.getByRole('tab', { name: /AWL/ }).click()
  // Contraste entre el texto y el fondo de cada opción elegida (luminancia relativa WCAG).
  const contrasts = await page.locator('[role="radio"][aria-checked="true"]').evaluateAll((els) => {
    const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    const rgb = (css) => {
      canvas.clearRect(0, 0, 1, 1)
      canvas.fillStyle = css
      canvas.fillRect(0, 0, 1, 1)
      return [...canvas.getImageData(0, 0, 1, 1).data.slice(0, 3)]
    }
    const lum = (c) => {
      const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    return els.map((el) => {
      const s = getComputedStyle(el)
      const [a, b] = [lum(rgb(s.color)), lum(rgb(s.backgroundColor))].sort((x, y) => y - x)
      return (a + 0.05) / (b + 0.05)
    })
  })
  expect(contrasts.length).toBe(2)
  for (const c of contrasts) expect(c).toBeGreaterThan(4.5)
  expectNoErrors(errors)
})

test('buscar (Ctrl+F), renombrar una variable y renumerar una etapa con sus referencias', async ({ page }) => {
  const errors = await openEditor(page)
  const transitions = page.locator('.react-flow__node-transition')
  // Una receptividad que se refiere a la etapa 1.
  await transitions.nth(1).dblclick()
  await page.getByPlaceholder('p. ej. a · b, ↑c, 5s/X2').fill('Paro + 2s/X1')
  await page.keyboard.press('Escape')

  // Buscar.
  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 600 } })
  await page.keyboard.press('Control+f')
  await page.getByLabel('Buscar en el diagrama').fill('paro')
  await expect(page.getByRole('search')).toContainText('1 de 1')
  await page.keyboard.press('Enter')
  await expect(transitions.nth(1)).toHaveClass(/selected/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('search')).toHaveCount(0)

  // Renombrar Marcha -> Inicio desde la tabla de variables.
  await page.getByTitle(/Tabla de variables: direcciones/).click()
  const dialog = page.getByRole('dialog', { name: 'Tabla de variables' })
  await dialog.getByRole('tab', { name: /Variables/ }).click()
  await dialog.getByLabel('Renombrar Marcha').click()
  await dialog.getByLabel('Nuevo nombre de la variable').fill('Paro')
  await page.keyboard.press('Enter')
  await expect(dialog).toContainText('Ya existe una variable «Paro»')
  await dialog.getByLabel('Nuevo nombre de la variable').fill('Inicio')
  await page.keyboard.press('Enter')
  await expect(dialog.getByLabel('Renombrar Inicio')).toHaveCount(1)
  await dialog.getByTitle('Cerrar (Esc)').click()
  await expect(transitions.nth(0)).toContainText('Inicio')
  await page.keyboard.press('Control+z')
  await expect(transitions.nth(0)).toContainText('Marcha')

  // Renumerar la etapa 1 a 7: «2s/X1» pasa a «2s/X7».
  await page.locator('.react-flow__node-step').nth(1).dblclick()
  const label = page.locator('aside.side-panel').getByRole('textbox').first()
  await label.fill('7')
  await page.keyboard.press('Enter')
  await expect(transitions.nth(1)).toContainText('2s/X7')
  expectNoErrors(errors)
})

test('autocompletado en receptividades y aviso de erratas', async ({ page }) => {
  const errors = await openEditor(page)
  await page.locator('.react-flow__node-transition').nth(1).dblclick() // «Paro»
  const input = page.getByPlaceholder('p. ej. a · b, ↑c, 5s/X2')
  await input.fill('')
  await input.pressSequentially('Paro · Ma')
  const list = page.getByRole('listbox', { name: 'Sugerencias' })
  await expect(list.getByRole('option').first()).toContainText('Marcha')
  await page.keyboard.press('Enter')
  await expect(input).toHaveValue('Paro · Marcha')
  await expect(list).toHaveCount(0)
  // Errata: aviso con corrección de un clic.
  await input.fill('Marha')
  await expect(page.getByText('«Marha» es una variable nueva. ¿Querías decir')).toBeVisible()
  await page.getByRole('button', { name: 'Marcha', exact: true }).click()
  await expect(input).toHaveValue('Marcha')
  // Esc cierra la lista sin cerrar el panel.
  await input.fill('')
  await input.pressSequentially('X')
  await expect(list).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(list).toHaveCount(0)
  await expect(input).toBeVisible()
  // Acciones: el texto entero se completa con las salidas, también las de la misma etapa.
  await page.locator('.react-flow__node-step').nth(1).dblclick()
  await page.locator('aside.side-panel').getByRole('button', { name: /Añadir acción$/ }).click()
  const action = page.getByLabel('Texto de la acción').last()
  await action.fill('')
  await action.pressSequentially('Moto')
  await expect(list.getByRole('option').first()).toContainText('Motor M1')
  await page.keyboard.press('Tab')
  await expect(action).toHaveValue('Motor M1')
  expectNoErrors(errors)
})

test('modo oscuro: el papel de la vista previa de exportación y su cajetín siguen en blanco y negro', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('grafcet-editor:settings', JSON.stringify({ theme: 'dark' })))
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar', exact: true })
  await dialog.getByLabel('Incluir cajetín').check()
  const css = (loc, prop) => loc.evaluate((el, p) => getComputedStyle(el)[p], prop)
  expect(await css(dialog.getByLabel('Vista previa de la página'), 'backgroundColor')).toBe('rgb(255, 255, 255)')
  const block = dialog.getByLabel('Cajetín', { exact: true })
  expect(await css(block, 'borderTopColor')).not.toMatch(/rgb\(2[0-9]{2}, 2[0-9]{2}/) // borde oscuro, no claro
  expect(await css(block.locator('div').first(), 'backgroundColor')).toBe('rgb(255, 255, 255)')
  await dialog.getByRole('radio', { name: 'PNG', exact: true }).click()
  expect(await css(dialog.getByLabel('Vista previa de la imagen'), 'backgroundColor')).toBe('rgb(255, 255, 255)')
  expectNoErrors(errors)
})

test('tabla del lienzo: títulos de columna alineados con las celdas, también con nombres largos', async ({ page }) => {
  const errors = await openEditor(page, 'ladder-completo.json')
  await page.getByTitle(/Tabla de variables: direcciones/).click()
  await page.getByLabel('Mostrar la tabla en el lienzo').check()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Encuadrar todo el diagrama' }).click()
  const table = page.locator('.react-flow__node[data-id="variables-table"]')
  const lefts = await table.evaluate((el) => {
    const x = (n) => Math.round(n.getBoundingClientRect().left)
    const headers = [...el.querySelectorAll('section > div:first-child')].map((h) => x(h.children[1]))
    const cells = [...el.querySelectorAll('section > div.group')].map((r) => x(r.children[1]))
    return { headers, cells }
  })
  const all = [...lefts.headers, ...lefts.cells]
  expect(Math.max(...all) - Math.min(...all)).toBeLessThanOrEqual(2) // misma columna en todas las filas
  await expect(table.locator('section').first()).toContainText(/Dirección/i)
  await expect(table.locator('section').first()).toContainText(/Comentario/i)
  expectNoErrors(errors)
})

test('analógicas: tipo detectado, rango en la tabla, deslizador en la simulación y CPU con analógicas', async ({ page }) => {
  const errors = await openEditor(page)
  await page.locator('.react-flow__node-transition').nth(1).dblclick()
  await page.getByPlaceholder('p. ej. a · b, ↑c, 5s/X2').fill('Temperatura >= 60')
  await page.keyboard.press('Escape')

  await page.getByTitle(/Tabla de variables: direcciones/).click()
  const dialog = page.getByRole('dialog', { name: 'Tabla de variables' })
  await dialog.getByRole('tab', { name: /Variables/ }).click()
  const row = dialog.getByRole('row', { name: /^Temperatura/ })
  await expect(row.getByRole('combobox').first()).toHaveValue('analogIn')
  await row.getByLabel('Señal de Temperatura').selectOption('0-10V')
  await row.getByLabel('Máximo de Temperatura').fill('120')
  await row.getByLabel('Unidad de Temperatura').fill('°C')
  // S7-200: la sugerencia cuenta la entrada analógica.
  await dialog.getByLabel('Formato de direcciones').selectOption('s7200')
  await expect(dialog.getByLabel('Configuración S7-200')).toContainText('1 entradas y 0 salidas analógicas')
  await expect(dialog.getByLabel('Configuración S7-200')).toContainText('CPU 224XP')
  await dialog.getByTitle('Cerrar (Esc)').click()

  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('switch').first().click() // Marcha: a la etapa 1
  await expect(page.locator('aside.side-panel').getByRole('button', { name: 'X1', exact: true })).toBeVisible()
  // Se suelta Marcha: si no, con 75 °C iría de 0 a 1 y vuelta sin parar (evolución fugaz).
  await page.getByRole('switch').first().click()
  const slider = page.getByLabel('Valor de Temperatura')
  await expect(slider).toHaveAttribute('max', '120')
  await slider.evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, '75')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('aside.side-panel')).toContainText('75 °C')
  await expect(page.locator('aside.side-panel').getByRole('button', { name: 'X0', exact: true })).toBeVisible() // 1 -> 0 con 75 >= 60
  expectNoErrors(errors)
})

test('hojas: añadir, mover elementos, referencias entre hojas y simulación del proyecto entero', async ({ page }) => {
  const errors = await openEditor(page)
  const tabs = page.getByRole('tablist', { name: 'Hojas' })
  await expect(tabs.getByRole('tab')).toHaveCount(1)
  // Mover la etapa 1 a una hoja nueva.
  await tabs.getByLabel('Añadir hoja').click()
  await expect(tabs.getByRole('tab', { name: 'Hoja 2' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.react-flow__node-step')).toHaveCount(0) // hoja vacía
  await tabs.getByRole('tab', { name: 'Hoja 1' }).click()
  // Selección de la etapa 1 y de la transición siguiente (Ctrl) y menú «Mover a Hoja 2».
  const step1 = page.locator('.react-flow__node-step').nth(1)
  await step1.click()
  await page.locator('.react-flow__node-transition').nth(1).click({ modifiers: ['Control'] })
  await step1.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Mover a Hoja 2' }).click()
  await expect(page.locator('.react-flow__node-step')).toHaveCount(1)
  await expect(page.locator('[data-ref-label]').first()).toContainText('(Hoja 2)')
  await tabs.getByRole('tab', { name: 'Hoja 2' }).click()
  await expect(page.locator('.react-flow__node-step')).toHaveCount(1)
  await expect(page.locator('[data-ref-label]').first()).toContainText('(Hoja 1)')
  // Renombrar con doble clic.
  await tabs.getByRole('tab', { name: 'Hoja 2' }).dblclick()
  await page.getByLabel('Nombre de la hoja').fill('Producción')
  await page.keyboard.press('Enter')
  await expect(tabs.getByRole('tab', { name: 'Producción' })).toBeVisible()
  // La simulación sigue siendo del proyecto entero: Marcha (hoja 1) activa la etapa 1 (otra hoja).
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('switch').first().click()
  await expect(page.locator('aside.side-panel').getByRole('button', { name: 'X1', exact: true })).toBeVisible()
  expectNoErrors(errors)
})
