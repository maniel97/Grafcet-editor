import { readFileSync } from 'fs'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, openEditor, openExample } from './helpers'

const step = (page, label) => page.locator('.react-flow__node-step').filter({ has: page.locator('.diagram-step-label', { hasText: new RegExp(`^${label}$`) }) })
const receptivity = async (page, node, text) => {
  await node.dblclick()
  await page.getByRole('combobox').first().fill(text)
  await page.keyboard.press('Escape')
}

// El alumno: abre un ejercicio, comprueba, lo resuelve y ve todo en verde.
test('ejercicio del alumno: enunciado, Comprobar, piezas bloqueadas y resuelto', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /^Abrir/ }).click()
  await page.getByRole('menuitem', { name: /Ejercicios/ }).click()
  await page.getByRole('button', { name: /Marcha y paro de un motor/ }).click()
  const panel = page.getByRole('complementary', { name: 'Ejercicio' })
  await expect(panel).toContainText('Un motor se pone en marcha')
  await expect(page.locator('.react-flow__node-step')).toHaveCount(0) // sin la solución

  // Con el lienzo vacío: «Aún no has dibujado el grafcet».
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await expect(panel.locator('[data-check="grafcet"]')).toHaveAttribute('data-ok', 'no')
  await expect(panel.locator('[data-check="grafcet"]')).toContainText('Aún no has dibujado el grafcet')

  // La tabla de variables, bloqueada.
  await page.locator('[data-tour="Variables"]').click()
  const vars = page.getByRole('dialog', { name: 'Tabla de variables' })
  await expect(vars.getByRole('note')).toContainText('la da el profesor')
  await expect(vars.getByRole('combobox', { name: 'Formato de direcciones' })).toBeDisabled()
  await expect(vars.getByRole('button', { name: 'Reasignar todo' })).toBeDisabled()
  await vars.getByRole('tab', { name: /Variables/ }).click()
  await expect(vars.locator('fieldset input, fieldset button').first()).toBeDisabled() // la tabla, de solo lectura
  await page.keyboard.press('Escape')

  // Dibujarlo: 0 → Marcha → 1 (Motor) → !Paro → bucle a 0.
  await page.getByRole('button', { name: 'Etapa inicial', exact: true }).click()
  await step(page, '0').click()
  await page.locator('[data-tour="mas-siguiente"]').click()
  await receptivity(page, page.locator('.react-flow__node-transition').first(), 'Marcha')
  await page.locator('.react-flow__node-transition').first().click()
  await page.locator('[data-tour="mas-siguiente"]').click()
  const fit = () => page.getByRole('button', { name: 'Encuadrar todo el diagrama' }).click()
  await fit()
  await step(page, '1').click()
  await page.locator('[data-tour="mas-accion"]').click()
  await expect(page.locator('[data-tour="propiedades"]').getByLabel('Texto de la acción').last()).toBeFocused()
  await page.keyboard.type('Motor')
  await step(page, '1').click()
  await page.locator('[data-tour="mas-siguiente"]').click()
  await receptivity(page, page.locator('.react-flow__node-transition').nth(1), '!Paro')
  await fit()
  await page.locator('.react-flow__node-transition').nth(1).click()
  await page.locator('[data-tour="bucle"]').click()
  await step(page, '0').click()

  // Una errata se detecta…
  await receptivity(page, page.locator('.react-flow__node-transition').first(), 'Marha')
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await expect(panel.locator('[data-check="variables"]')).toHaveAttribute('data-ok', 'no')
  await expect(panel.locator('[data-check="variables"]')).toContainText('Marha')
  // …y, corregida, todo en verde.
  await receptivity(page, page.locator('.react-flow__node-transition').first(), 'Marcha')
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await expect(panel.locator('[data-exercise="resuelto"]')).toBeVisible()

  // La planta, solo para usar.
  await page.locator('[data-tour="Simular"]').click()
  const plant = page.getByRole('region', { name: 'Escena de la planta' })
  await expect(plant.getByRole('radio', { name: /Usar/ })).toBeVisible()
  await expect(plant.getByRole('radio', { name: /Editar/ })).toHaveCount(0)
  expectNoErrors(errors)
})

// El profesor: prepara un ejemplo como ejercicio, lo prueba y descarga la versión del alumnado.
test('ejercicio del profesor: preparar, probar con su solución y descargar sin solución', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /^Cilindros A\+ B\+/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Ejercicio para el alumnado/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ejercicio para el alumnado' })
  await dialog.getByLabel('Título').fill('Mis cilindros')
  await dialog.getByLabel('Enunciado').fill('Haz **A+ B+ A− B−** al pulsar Marcha.')
  await dialog.getByRole('button', { name: 'Probar' }).click()
  await expect(dialog.locator('[data-check="norma"]')).toHaveAttribute('data-ok', 'si')
  await expect(dialog.locator('[data-check="variables"]')).toHaveAttribute('data-ok', 'si')
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()

  // El panel, en vista del profesor; su solución pasa.
  const panel = page.getByRole('complementary', { name: 'Ejercicio' })
  await expect(panel).toContainText('Vista del profesor')
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await expect(panel.locator('[data-exercise="resuelto"]')).toBeVisible()

  // Para el alumnado: el archivo no lleva el grafcet.
  const file = await download(page, () => panel.getByRole('button', { name: 'Para el alumnado' }).click())
  const project = JSON.parse(readFileSync(await file.path(), 'utf-8'))
  expect(project.nodes.some((n) => n.type === 'step' || n.type === 'transition')).toBe(false)
  expect(project.plc.exercise).toMatchObject({ student: true, title: 'Mis cilindros' })
  expect(typeof project.plc.exercise.sealed).toBe('string')
  expectNoErrors(errors)
})
