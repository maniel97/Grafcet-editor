import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor, openExample, openVariables, saveFromDialog, stableBox } from './helpers'

test('paso a ladder: esquema, exportaciones, ST y AWL', async ({ page }) => {
  const errors = await openEditor(page, 'ladder-completo.json')
  await page.getByTitle(/Tabla de variables: direcciones/).click()
  await page.getByRole('button', { name: /Rellenar vacías/ }).click()
  await page.keyboard.press('Escape')

  await page.getByTitle(/Paso a ladder/).click()
  const view = page.locator('[aria-label="Ladder generado"]')
  await expect(view.locator('header')).toContainText('16 segmentos')
  const svg = view.locator('[data-ladder-svg]')
  for (const title of ['Inicialización', 'Auxiliares', 'Condiciones de franqueo', 'Desactivación de etapas', 'Activación de etapas', 'Temporizaciones', 'Acciones memorizadas', 'Salidas']) {
    await expect(svg.getByText(title, { exact: true })).toHaveCount(1)
  }
  await expect(svg.getByText('CMP >=')).toHaveCount(1)
  await expect(svg.getByText('TON', { exact: true })).toHaveCount(1)
  await expect(svg.getByText('MW100').first()).toBeVisible()

  await page.getByTitle(/Exportar el esquema en SVG/).click()
  expect((await saveFromDialog(page, 'svg')).suggestedFilename()).toBe('ladder-completo-ladder.svg')
  await page.getByTitle(/Exportar el esquema en PNG/).click()
  expect((await saveFromDialog(page, 'png')).suggestedFilename()).toBe('ladder-completo-ladder.png')
  await page.getByTitle(/Exportar a PDF/).click()
  // El mismo diálogo de PDF que el grafcet, con páginas cortadas entre segmentos.
  await expect(page.getByLabel('Vista previa de la página')).toBeVisible()
  await expect(page.getByLabel('Páginas')).toContainText('Página 1 de 3')
  await page.getByLabel('Página siguiente').click()
  await expect(page.getByLabel('Páginas')).toContainText('Página 2 de 3')
  const pdf = await saveFromDialog(page, 'pdf')
  expect(pdf.suggestedFilename()).toBe('ladder-completo-ladder.pdf')
  // Tres páginas, vectorial (texto real, sin imagen) y sin perder caracteres del final.
  const bytes = readFileSync(await pdf.path(), 'latin1')
  expect(bytes).toMatch(/\/Count 3\b/)
  expect(bytes).not.toContain('/Subtype /Image')
  expect(bytes).toContain('desactiva las demás)')
  await expect(page.getByRole('region', { name: 'Ladder generado' })).toBeVisible() // guardar no cierra el ladder

  await page.getByRole('tab', { name: /Texto estructurado/ }).click()
  await expect(page.locator('pre')).toContainText('Tr1 := X0 AND RT_Marcha.Q AND NOT Paro AND NOT Emergencia;')
  await page.getByRole('tab', { name: /SCL \(TIA Portal\)/ }).click()
  await expect(page.locator('pre')).toContainText('FUNCTION_BLOCK "Grafcet"')
  await expect(page.locator('pre')).toContainText('#Tr1 := #X0 AND #RT_Marcha.Q AND NOT #Paro AND NOT #Emergencia;')
  expect((await download(page, () => page.getByRole('button', { name: '.scl' }).click())).suggestedFilename()).toBe('ladder-completo.scl')
  await page.getByRole('tab', { name: /AWL/ }).click()
  await expect(page.locator('pre')).toContainText('SPBN M001')
  await page.getByRole('radio', { name: /Inglés/ }).click()
  await expect(page.locator('pre')).toContainText('JCN M001')
  await page.getByRole('radio', { name: /^Símbolos$/ }).click()
  await expect(page.locator('pre')).toContainText('A "X0"')

  // Es un panel más: se cierra con su botón (Esc es del lienzo).
  await page.keyboard.press('Escape')
  await expect(view).toBeVisible()
  await view.getByRole('button', { name: 'Cerrar el ladder' }).click()
  await expect(view).toHaveCount(0)
  expectNoErrors(errors)
})

test('visor del ladder: centrado y ajustado al ancho en pantallas grandes, con zoom', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1300 })
  const errors = await openEditor(page, 'ladder-completo.json')
  await page.getByTitle(/Paso a ladder/).click()
  await page.getByRole('region', { name: 'Ladder generado' }).getByRole('button', { name: 'Pantalla completa' }).click()
  const svg = page.locator('[data-ladder-svg]')
  const fit = page.getByRole('button', { name: 'Ajustar al ancho', exact: true })
  await expect(fit).toHaveText('150 %') // ajustado (con tope) en vez de diminuto
  const box = await svg.boundingBox()
  const natural = Number(await svg.getAttribute('width'))
  expect(box.width).toBeCloseTo(natural * 1.5, -1)
  expect(Math.abs(box.x + box.width / 2 - 1280)).toBeLessThan(20) // centrado
  await page.getByLabel('Acercar el esquema').click()
  await expect(fit).toHaveText('200 %')
  await page.keyboard.down('Control')
  await page.mouse.move(1280, 700)
  await page.mouse.wheel(0, 200) // Ctrl + rueda hacia abajo: alejar
  await page.keyboard.up('Control')
  await expect(fit).toHaveText('150 %')
  await fit.click()
  await expect(fit).toHaveText('150 %')
  // El tamaño de exportación no cambia con el zoom.
  expect(Number(await svg.getAttribute('width'))).toBe(natural)
  expectNoErrors(errors)
})

test('STL S7-200 (Micro/WIN): pestaña, archivo .awl en ANSI y tabla de símbolos', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors = await openEditor(page, 'ladder-completo.json')
  await page.getByTitle(/Paso a ladder/).click()
  await page.getByRole('tab', { name: /STL S7-200/ }).click()
  const pre = page.locator('pre')
  await expect(pre).toContainText('ORGANIZATION_BLOCK MAIN:OB1')
  await expect(pre).toContainText('LD     SM0.1')
  await expect(page.getByLabel('Instrucciones para Micro/WIN')).toContainText('Archivo → Importar')
  // El fichero de ejemplo usa direcciones de S7-300: se aconseja el formato S7-200.
  await expect(page.getByLabel('Instrucciones para Micro/WIN')).toContainText('S7-200 / Micro/WIN')

  const file = await download(page, () => page.getByRole('button', { name: '.awl' }).click())
  expect(file.suggestedFilename()).toBe('ladder-completo-s7-200.awl')
  const bytes = readFileSync(await file.path())
  expect(bytes.includes(Buffer.from('Inicializaci\xf3n', 'latin1'))).toBe(true) // ANSI, no UTF-8
  expect(bytes.includes(Buffer.from('Inicialización', 'utf8'))).toBe(false)

  await page.getByRole('button', { name: 'Símbolos' }).click()
  const table = await page.evaluate(() => navigator.clipboard.readText())
  expect(table.split('\r\n')[0]).toMatch(/^X0\t\S+\t/)
  expect(table).toContain('Marcha\t')
  expectNoErrors(errors)
})

test('S7-200: CPU sugerida, módulos y direcciones según la configuración', async ({ page }) => {
  const errors = await openEditor(page, 'ladder-completo.json')
  const dialog = await openVariables(page)
  await dialog.getByLabel('Formato de direcciones').selectOption('s7200')
  const config = dialog.getByLabel('Configuración S7-200')
  await expect(config).toContainText('El proyecto usa 6 entradas y 3 salidas digitales')
  await expect(config).toContainText('Sugerida (con 20 % de reserva): CPU 222')
  await config.getByRole('button', { name: /Usar la sugerida/ }).click()
  await expect(config.getByLabel('CPU S7-200')).toHaveValue('222')
  await expect(config.getByLabel('Mapa de direcciones')).toContainText('I0.0–I0.7')
  // A mano: CPU 224 + EM223 4E/4S.
  await config.getByLabel('CPU S7-200').selectOption('224')
  await config.getByLabel('Añadir módulo de ampliación').selectOption('EM223-4')
  await expect(config.getByLabel('Mapa de direcciones')).toContainText('EM223 4 E / 4 S: I2.0–I2.3 · Q2.0–Q2.3')
  await dialog.getByRole('button', { name: /Reasignar todo/ }).click()
  await dialog.getByRole('tab', { name: /Variables/ }).click()
  await expect(dialog.getByRole('row', { name: /^Marcha/ }).locator('input').first()).toHaveValue('I0.0')
  expectNoErrors(errors)
})

test('ladder en vivo durante la simulación y navegación entre grafcet y ladder', async ({ page }) => {
  const errors = await openEditor(page)
  // «Ver en el ladder» (clic derecho en una transición): sus segmentos resaltados.
  await page.locator('.react-flow__node-transition').filter({ hasText: 'Marcha' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Ver en el ladder' }).click()
  const view = page.locator('[aria-label="Ladder generado"]')
  await expect(view.locator('[data-highlighted]').first()).toBeVisible()
  expect(await view.locator('[data-highlighted]').count()).toBeGreaterThanOrEqual(2)
  await expect(view.locator('[data-live]:not([data-live="resaltado"])')).toHaveCount(0) // sin simular: sin estado

  // Clic en un segmento: vuelve al grafcet con el elemento resaltado.
  // El ladder sigue abierto al lado.
  await view.locator('[data-highlighted]').first().click()
  await expect(view).toBeVisible()
  await expect(page.locator('.react-flow__node-transition').filter({ hasText: 'Marcha' }).locator('.outline-amber-400')).toHaveCount(1)

  // Simulando: contactos y salidas en vivo, con las entradas en la propia vista.
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.locator('.react-flow__node-transition').filter({ hasText: 'Marcha' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Ver en el ladder' }).click()
  const bar = view.getByLabel('Simulación en vivo')
  await expect(bar).toContainText('En vivo')
  const motorOn = view.locator('[data-live="activa"]')
  const before = await motorOn.count()
  await bar.getByRole('switch', { name: 'Marcha' }).click()
  await expect.poll(() => motorOn.count()).toBeGreaterThan(before)
  await expect(bar.getByRole('switch', { name: 'Marcha' })).toHaveAttribute('aria-checked', 'true')

  // El esquema exportado no lleva las capas del modo en vivo.
  await view.getByRole('button', { name: 'SVG' }).click()
  await expect(view.locator('[data-ladder-svg] [data-live]')).toHaveCount(0)
  expectNoErrors(errors)
})

// #18 (fase 1): el ladder es un panel más. Simulando, grafcet, planta y ladder a la vez, sin taparse.
test('ladder como panel: junto al grafcet y la planta durante la simulación', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 })
  const errors = await openEditor(page)
  await openExample(page, /^Marcha y paro/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const plant = page.locator('[data-tour="planta"]')
  await expect(plant).toBeVisible()
  await page.getByTitle(/Paso a ladder/).click()
  const view = page.getByRole('region', { name: 'Ladder generado' })
  await expect(view).toBeVisible()
  // Grafcet | planta | ladder, uno al lado del otro.
  const canvas = await stableBox(page.locator('.react-flow').first())
  const plantBox = await stableBox(plant)
  const ladderBox = await stableBox(view)
  expect(canvas.width).toBeGreaterThan(150)
  expect(canvas.x + canvas.width).toBeLessThanOrEqual(plantBox.x + 1)
  expect(plantBox.x + plantBox.width).toBeLessThanOrEqual(ladderBox.x + 1)
  // En panel estrecho las pestañas se abrevian, pero conservan su nombre completo.
  await expect(view.getByRole('tab', { name: 'Texto estructurado (ST)' })).toHaveText('ST', { useInnerText: true })

  // La planta mueve el ladder en vivo.
  const active = view.locator('[data-live="activa"]')
  const before = await active.count()
  const b = await stableBox(plant.locator('[aria-label="Pulsador Marcha"]').first())
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
  await page.mouse.down()
  await page.waitForTimeout(150)
  await page.mouse.up()
  await expect.poll(() => active.count()).toBeGreaterThan(before)

  // A pantalla completa y, al ir a un segmento en el grafcet, de vuelta a la vista dividida.
  await view.getByRole('button', { name: 'Pantalla completa' }).click()
  await expect(view.getByRole('button', { name: 'Vista dividida con el grafcet' })).toBeVisible()
  await view.locator('[data-ladder-svg] [data-rung][style*="cursor"] text').first().click()
  await expect(view.getByRole('button', { name: 'Pantalla completa' })).toBeVisible()
  expectNoErrors(errors)
})

// #18 (fase 2): apilar los paneles en una columna, repartir el alto y doble clic para maximizar.
test('paneles apilados: planta y ladder en una columna junto al grafcet', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const errors = await openEditor(page)
  await openExample(page, /^Marcha y paro/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const plant = page.locator('[data-tour="planta"]')
  await expect(plant).toBeVisible()
  const view = page.getByRole('region', { name: 'Ladder generado' })
  // Con un solo panel no hay botón de apilar.
  await expect(plant.getByRole('button', { name: 'Apilar los paneles en una columna' })).toHaveCount(0)
  await page.getByTitle(/Paso a ladder/).click()
  await view.getByRole('button', { name: 'Apilar los paneles en una columna' }).click()

  // Planta arriba, ladder abajo, misma columna, y el grafcet a la izquierda.
  const top = await stableBox(plant)
  const bottom = await stableBox(view)
  const canvas = await stableBox(page.locator('.react-flow').first())
  expect(Math.abs(top.x - bottom.x)).toBeLessThan(2)
  expect(Math.abs(top.width - bottom.width)).toBeLessThan(2)
  expect(top.y + top.height).toBeLessThanOrEqual(bottom.y + 1)
  expect(canvas.x + canvas.width).toBeLessThanOrEqual(top.x + 1)
  expect(Math.abs(top.height - bottom.height)).toBeLessThan(4) // a partes iguales

  // El borde entre los dos reparte el alto, y se recuerda.
  const edge = view.getByRole('separator', { name: 'Alto de los paneles apilados' })
  const e = await edge.boundingBox()
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2)
  await page.mouse.down()
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2 - 150, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await view.boundingBox()).height - (await plant.boundingBox()).height).toBeGreaterThan(250)
  await page.reload()
  await page.waitForSelector('.react-flow__node')
  expect(await page.evaluate(() => localStorage.getItem('grafcet-editor:panels-stacked'))).toBe('1')
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('grafcet-editor:panels-grow')))).toHaveProperty('ladder')

  // Doble clic en la cabecera: pantalla completa y vuelta (no en sus botones).
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByTitle(/Paso a ladder/).click()
  await view.getByRole('heading', { name: 'Paso a ladder' }).dblclick()
  await expect(view.getByRole('button', { name: 'Vista dividida con el grafcet' })).toBeVisible()
  await view.getByRole('heading', { name: 'Paso a ladder' }).dblclick()
  await expect(view.getByRole('button', { name: 'Pantalla completa' })).toBeVisible()
  await plant.getByText('Planta', { exact: true }).dblclick()
  await expect(plant.getByRole('button', { name: 'Vista dividida con el grafcet' })).toBeVisible()
  await plant.getByText('Planta', { exact: true }).dblclick()

  // Uno al lado de otro otra vez.
  await view.getByRole('button', { name: 'Paneles uno al lado de otro' }).click()
  const a = await stableBox(plant)
  const b = await stableBox(view)
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1)
  expectNoErrors(errors)
})

// #18 (fase 3): sin sitio para dos columnas, los paneles van en pestañas.
test('pantallas estrechas: grafcet, planta y ladder en pestañas', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  const errors = await openEditor(page)
  await openExample(page, /^Marcha y paro/)
  await expect(page.getByRole('tablist', { name: 'Vistas' })).toHaveCount(0) // sin paneles, sin pestañas
  await page.getByRole('button', { name: /Simular/ }).click()
  const tabs = page.getByRole('tablist', { name: 'Vistas' })
  const plant = page.locator('[data-tour="planta"]')
  // Al abrirse, la planta pasa a ser la pestaña elegida y ocupa la zona de trabajo.
  await expect(tabs.getByRole('tab', { name: 'Planta' })).toHaveAttribute('aria-selected', 'true')
  await expect(plant).toBeVisible()
  const area = await stableBox(page.locator('.react-flow').first())
  const box = await stableBox(plant)
  expect(Math.abs(box.x - area.x)).toBeLessThan(2)
  expect(box.width).toBeGreaterThan(area.width - 4)
  await expect(plant.getByRole('button', { name: 'Pantalla completa' })).toBeHidden()

  await tabs.getByRole('tab', { name: 'Grafcet' }).click()
  await expect(plant).toBeHidden()
  await expect(page.locator('.react-flow__node-step').first()).toBeVisible()

  // El ladder, en su propia pestaña; la planta conserva su estado (sigue simulando).
  await page.getByTitle(/Paso a ladder/).click()
  const view = page.getByRole('region', { name: 'Ladder generado' })
  await expect(tabs.getByRole('tab', { name: 'Ladder' })).toHaveAttribute('aria-selected', 'true')
  await expect(view).toBeVisible()
  await expect(plant).toBeHidden()
  await tabs.getByRole('tab', { name: 'Planta' }).click()
  await expect(plant).toBeVisible()
  await expect(view).toBeHidden()
  // Al cerrar un panel, vuelve al grafcet.
  await plant.getByTitle('Cerrar la planta').click()
  await expect(tabs.getByRole('tab', { name: 'Grafcet' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.react-flow__node-step').first()).toBeVisible()

  // Móvil: el ladder ocupa toda la zona de trabajo (no media pantalla abajo).
  await page.getByRole('button', { name: /Detener/ }).click()
  await page.setViewportSize({ width: 420, height: 800 })
  await tabs.getByRole('tab', { name: 'Ladder' }).click()
  const phone = await stableBox(view)
  expect(phone.width).toBeGreaterThan(400)
  expect(phone.height).toBeGreaterThan(500)
  expectNoErrors(errors)
})

// Al abrir un panel, el grafcet se reencuadra en el sitio que le queda.
test('al abrir un panel, el grafcet se reencuadra', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  const errors = await openEditor(page)
  await openExample(page, /^Taladradora\s*Secuencia/)
  await page.getByTitle(/Paso a ladder/).click()
  await expect(page.getByRole('region', { name: 'Ladder generado' })).toBeVisible()
  const canvas = await stableBox(page.locator('.react-flow').first())
  for (const label of ['0', '3']) {
    const step = page.locator('.react-flow__node-step').filter({ has: page.locator('.diagram-step-label', { hasText: new RegExp(`^${label}$`) }) })
    const b = await stableBox(step)
    expect(b.x).toBeGreaterThanOrEqual(canvas.x - 1)
    expect(b.x + b.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1)
    expect(b.y + b.height).toBeLessThanOrEqual(canvas.y + canvas.height + 1)
  }
  expectNoErrors(errors)
})

// Con el panel abierto, el ladder sigue al grafcet: al editar y tras un arrastre (que no lo regenera
// en cada movimiento, solo al soltar).
test('el ladder abierto se actualiza al editar y al soltar un arrastre', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /^Marcha y paro/)
  await page.getByTitle(/Paso a ladder/).click()
  const svg = page.getByRole('region', { name: 'Ladder generado' }).locator('[data-ladder-svg]')
  await expect(svg).toContainText('Marcha')
  await page.locator('.react-flow__node-transition').filter({ hasText: 'Marcha' }).dblclick()
  await page.getByRole('combobox').first().fill('Arranque')
  await page.keyboard.press('Escape')
  await expect(svg).toContainText('Arranque')
  // Arrastrar una etapa con el panel abierto: se mueve y el ladder sigue al día (se regenera al soltar).
  await page.locator('[data-tour="propiedades"]').getByTitle('Cerrar', { exact: true }).click()
  const step = page.locator('.react-flow__node-step').nth(1)
  const b = await stableBox(step)
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + 160, b.y + b.height / 2 + 40, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await step.boundingBox()).x).toBeGreaterThan(b.x + 100)
  await expect(svg).toContainText('Tr1: X0 · «Arranque»')
  expectNoErrors(errors)
})
