import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor, openExample } from './helpers'

// Editar en mitad de un texto ya escrito: el cursor se queda donde está (antes saltaba al final
// después de cada tecla).
test('editar una acción por la mitad no lleva el cursor al final', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /^Taladradora\s*Secuencia/)
  await page.locator('.react-flow__node-step').filter({ hasText: 'Motor_broca' }).first().dblclick()
  const input = page.getByLabel('Texto de la acción').first()
  await expect(input).toHaveValue('Motor_broca')
  await input.click()
  await input.evaluate((el) => el.setSelectionRange(5, 5)) // «Motor|_broca»
  await page.keyboard.type('XY')
  await expect(input).toHaveValue('MotorXY_broca')
  expect(await input.evaluate((el) => el.selectionStart)).toBe(7)
  expectNoErrors(errors)
})

test('editar una receptividad por la mitad no lleva el cursor al final', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /^Taladradora\s*Secuencia/)
  await page.locator('.react-flow__node-transition').filter({ hasText: 'Fc_abajo' }).first().dblclick()
  const input = page.getByRole('combobox').first()
  await expect(input).toHaveValue('Fc_abajo')
  await input.click()
  await input.evaluate((el) => el.setSelectionRange(2, 2)) // «Fc|_abajo»
  await page.keyboard.type('XY')
  await page.keyboard.press('Escape') // cierra las sugerencias
  await expect(input).toHaveValue('FcXY_abajo')
  expectNoErrors(errors)
})

// Cambiar el nombre de una variable escribiendo (en la receptividad): es la misma variable, con su
// dirección y su comentario (no una nueva con la vieja huérfana en la tabla).
test('renombrar una variable escribiendo conserva su dirección y su comentario', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /^Taladradora\s*Secuencia/)
  const table = page.locator('.react-flow__node[data-id="variables-table"]')
  const row = (name) => table.locator(`[data-row="${name}"]`)
  const before = (await row('Pieza').textContent()).replace('Pieza', '')
  expect(before).toMatch(/I0\.\d.*Detector: hay pieza colocada/)
  await page.locator('.react-flow__node-transition').filter({ hasText: 'Marcha' }).first().dblclick()
  const input = page.getByRole('combobox').first()
  const value = await input.inputValue()
  await input.click()
  // Seleccionar «Pieza» y escribir encima; después borrarlo entero y escribir otro nombre.
  await input.evaluate((el, i) => el.setSelectionRange(i, i + 5), value.indexOf('Pieza'))
  await page.keyboard.type('Presencia')
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue(value.replace('Pieza', 'Presencia'))
  for (let i = 0; i < 'Presencia'.length; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('Sensor_pieza')
  await page.keyboard.press('Escape')
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } })
  await expect(row('Sensor_pieza')).toHaveCount(1)
  expect((await row('Sensor_pieza').textContent()).replace('Sensor_pieza', '')).toBe(before)
  await expect(row('Pieza')).toHaveCount(0)
  await expect(row('Presencia')).toHaveCount(0)
  expectNoErrors(errors)
})

// Renombrar desde la tabla de variables (Renombrar en todo el diagrama): igual, y la planta
// virtual sigue enlazada con la variable.
test('renombrar desde la tabla de variables mantiene sus datos y el enlace con la planta', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /^Taladradora\s*Secuencia/)
  const row = (name) => page.locator(`.react-flow__node[data-id="variables-table"] [data-row="${name}"]`)
  const before = (await row('Pieza').textContent()).replace('Pieza', '')
  await page.getByTitle(/^Tabla de variables:/).click()
  await page.getByRole('tab', { name: /^Variables/ }).click()
  await page.getByLabel('Renombrar Pieza').click()
  await page.getByLabel('Nuevo nombre de la variable').fill('Sensor_pieza')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  expect((await row('Sensor_pieza').textContent()).replace('Sensor_pieza', '')).toBe(before)
  await expect(row('Pieza')).toHaveCount(0)
  // La planta: el interruptor «Pieza colocada» sigue moviendo la variable (renombrada).
  await page.getByTitle(/^Simular el grafcet/).click()
  const entry = page.locator('aside').getByText('Sensor_pieza', { exact: true })
  await expect(entry).toBeVisible()
  await expect(entry.locator('xpath=..')).toContainText('planta')
  expectNoErrors(errors)
})

// Renombrar una hoja del lienzo: doble clic en su pestaña, escribir y Enter.
test('renombrar una hoja con doble clic en su pestaña', async ({ page }) => {
  const errors = await openEditor(page)
  const tab = page.getByRole('tab', { name: 'Hoja 1' })
  await tab.dblclick()
  const input = page.getByLabel('Nombre de la hoja')
  await expect(input).toBeVisible()
  await input.fill('Producción')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { name: 'Producción' })).toBeVisible()
  expectNoErrors(errors)
})

test('las hojas se pueden renombrar también simulando y en el esquema eléctrico', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /^Taladradora\s*Secuencia/)
  await page.getByTitle(/^Simular el grafcet/).click()
  await page.getByRole('tab', { name: 'Hoja 1' }).first().dblclick()
  await page.getByLabel('Nombre de la hoja').fill('Producción')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { name: 'Producción' })).toBeVisible()
  await page.getByRole('button', { name: 'Esquema eléctrico' }).first().click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  await view.getByRole('tab', { name: 'Hoja 1' }).dblclick()
  await view.getByLabel('Nombre de la hoja').fill('Mando')
  await page.keyboard.press('Enter')
  await expect(view.getByRole('tab', { name: 'Mando' })).toBeVisible()
  expectNoErrors(errors)
})

// Desde la tabla del lienzo también se renombra una variable en uso: en todo el diagrama.
test('renombrar una variable en uso desde la tabla del lienzo', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /^Taladradora\s*Secuencia/)
  const row = (name) => page.locator(`.react-flow__node[data-id="variables-table"] [data-row="${name}"]`)
  const before = (await row('Pieza').textContent()).replace('Pieza', '')
  await row('Pieza').getByTitle('Renombrar en todo el diagrama').click()
  const input = row('Pieza').locator('input')
  // Un nombre que ya existe: no se acepta y el campo sigue abierto.
  await input.fill('Marcha')
  await input.press('Enter')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await input.fill('Sensor_pieza')
  await input.press('Enter')
  expect((await row('Sensor_pieza').textContent()).replace('Sensor_pieza', '')).toBe(before)
  await expect(page.locator('.react-flow__node-transition').filter({ hasText: 'Sensor_pieza' })).toHaveCount(1)
  expectNoErrors(errors)
})

// El + de la derecha de una etapa añade una acción y deja escribirla al momento (panel abierto y
// el texto provisional «Acción» seleccionado).
test('el + de acción abre el panel listo para escribir', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Etapa inicial', exact: true }).click()
  await page.locator('.react-flow__node-step').first().click()
  await page.locator('[data-tour="mas-accion"]').click()
  const input = page.locator('[data-tour="propiedades"]').getByLabel('Texto de la acción').last()
  await expect(input).toBeFocused()
  await page.keyboard.type('Motor')
  await expect(input).toHaveValue('Motor')
  await expect(page.locator('.react-flow__node-step').first()).toContainText('Motor')
  expectNoErrors(errors)
})
