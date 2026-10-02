import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor, saveFromDialog } from './helpers'

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
  await expect(page.getByRole('dialog', { name: 'Ladder generado' })).toBeVisible() // Esc/guardar no cierra el ladder

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

  await page.keyboard.press('Escape')
  await expect(view).toHaveCount(0)
  expectNoErrors(errors)
})

test('visor del ladder: centrado y ajustado al ancho en pantallas grandes, con zoom', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1300 })
  const errors = await openEditor(page, 'ladder-completo.json')
  await page.getByTitle(/Paso a ladder/).click()
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
  await page.getByTitle(/Tabla de variables: direcciones/).click()
  const dialog = page.getByRole('dialog', { name: 'Tabla de variables' })
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
