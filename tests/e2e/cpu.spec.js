import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor, openExample, openVariables } from './helpers'

// Pulsa (y suelta) un mando del panel de control de la planta.
async function press(page, label) {
  const b = await page.getByRole('region', { name: 'Panel de control' }).locator(`[aria-label="${label}"]`).boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
  await page.mouse.down()
  await page.waitForTimeout(150)
  await page.mouse.up()
}

test('modo Autómata: el STL generado y un programa de Micro/WIN mueven la planta', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Pick & place/)
  const table = await openVariables(page)
  await table.getByRole('button', { name: /Rellenar vacías/ }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  const X = view.locator('[aria-label="Cilindro X"]')

  // Programa generado del grafcet: hace el mismo ciclo que el grafcet.
  const logic = page.getByLabel('Lógica de la simulación')
  await logic.getByRole('radio', { name: /Autómata S7-200/ }).click()
  await expect(logic.getByRole('status')).toContainText('RUN')
  await expect(page.getByRole('list', { name: 'Qué espera el grafcet' })).toHaveCount(0) // sin etapas
  await press(page, 'Pulsador Marcha')
  await expect.poll(() => X.getAttribute('data-pos'), { timeout: 8000 }).toBe('1.00') // X lleva la pieza
  await expect(view.locator('[aria-label="Recogida Destino"]')).toContainText('1', { timeout: 10000 })
  await expect.poll(() => X.getAttribute('data-pos'), { timeout: 8000 }).toBe('0.00')

  // Un programa escrito a mano (con los símbolos de la tabla): solo saca y mete X.
  const program = ['Network 1', 'LD     "Marcha"', 'S      "X+", 1', 'Network 2', 'LD     "x1"', 'R      "X+", 1', 'Network 3', 'LDN    "X+"', '=      "X-"'].join('\r\n')
  await logic.getByLabel('Programa .awl').setInputFiles({ name: 'mi-programa.awl', mimeType: 'text/plain', buffer: Buffer.from(program, 'latin1') })
  await expect(logic).toContainText('(mi-programa.awl)')
  await expect(logic.getByRole('radio', { name: /Un programa de Micro\/WIN/ })).toBeChecked()
  await press(page, 'Pulsador Marcha')
  // Llega al final (vuelve en el mismo ciclo en que toca x1: casi 1) y regresa.
  await expect.poll(async () => Number(await X.getAttribute('data-pos')), { timeout: 5000, intervals: [50] }).toBeGreaterThan(0.9)
  await expect.poll(() => X.getAttribute('data-pos'), { timeout: 5000 }).toBe('0.00')

  // Una instrucción que no existe: STOP con su línea.
  await logic.getByLabel('Programa .awl').setInputFiles({ name: 'malo.awl', mimeType: 'text/plain', buffer: Buffer.from('LD "Marcha"\r\nXYZ Q0.0', 'latin1') })
  await expect(logic.getByRole('alert')).toContainText('Línea 2: la instrucción «XYZ» no está en la CPU simulada.')

  // De vuelta al grafcet: vuelven las etapas.
  await logic.getByRole('radio', { name: 'Grafcet del editor' }).click()
  await expect(page.getByRole('list', { name: 'Qué espera el grafcet' })).toBeVisible()
  expectNoErrors(errors)
})

test('modo Autómata: pegar la tabla de símbolos de Micro/WIN', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  const logic = page.getByLabel('Lógica de la simulación')
  await logic.getByRole('radio', { name: /Autómata S7-200/ }).click()
  await logic.getByRole('button', { name: /Pegar tabla de símbolos/ }).click()
  await logic.getByLabel('Tabla de símbolos').fill('Símbolo\tDirección\tComentario\n\tMarcha\tI0.4\tVerde\n\tParo\tI0.5\t')
  await logic.getByRole('button', { name: 'Aplicar' }).click()
  await expect(logic.getByRole('status').first()).toContainText('2 símbolos aplicados')
  await page.getByRole('button', { name: /Detener/ }).click()
  const table = await openVariables(page)
  await table.getByRole('tab', { name: /Variables/ }).click()
  await expect(table.getByRole('row', { name: /^Marcha/ }).getByRole('textbox').first()).toHaveValue('I0.4')
  expectNoErrors(errors)
})
