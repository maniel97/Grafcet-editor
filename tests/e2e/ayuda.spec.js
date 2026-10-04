import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor } from './helpers'

const openHelp = async (page) => {
  await page.getByTitle(/^Atajos y notación/).click()
  return page.getByRole('dialog', { name: 'Ayuda' })
}

// Centro de ayuda: preguntas frecuentes, buscador y wiki con ejemplos que se abren en el editor.
test('ayuda: preguntas, búsqueda, artículos y «Abrir en el editor»', async ({ page }) => {
  const errors = await openEditor(page)
  const help = await openHelp(page)
  await help.getByRole('button', { name: '¿Qué escribo en una receptividad?' }).click()
  await expect(help.getByText('el autocompletado propone las variables')).toBeVisible()

  // Búsqueda sin tildes: encuentra preguntas, notación y artículos.
  await help.getByLabel('Buscar en la ayuda').fill('temporizacion')
  await expect(help.getByRole('heading', { name: /resultados/ })).toBeVisible()
  await help.getByRole('region', { name: 'Resultados de la búsqueda' }).getByRole('button', { name: /^Temporizaciones/ }).click()
  await expect(help.getByRole('heading', { name: 'Temporizaciones', level: 2 })).toBeVisible()

  // Un enlace a otro artículo y una tabla.
  await help.getByRole('navigation').getByRole('button', { name: 'Transiciones y receptividades' }).click()
  await expect(help.locator('table')).toBeVisible()
  await help.getByRole('table').getByRole('button', { name: 'Temporizaciones' }).click()
  await expect(help.getByRole('heading', { name: 'Temporizaciones', level: 2 })).toBeVisible()

  // «Abrir en el editor»: cierra la ayuda y abre el ejemplo.
  await help.locator('[data-help-card="ejemplo:semaforo"]').getByRole('button', { name: 'Abrir en el editor' }).click()
  await expect(help).toBeHidden()
  await expect(page.locator('.react-flow__node-transition').filter({ hasText: '10s/X0' })).toHaveCount(1)
  expectNoErrors(errors)
})

// El tutorial «Tu primer grafcet», hecho por un robot: cada paso se cumple como lo haría el alumno.
test('tutorial «Tu primer grafcet» de principio a fin', async ({ page }) => {
  const errors = await openEditor(page)
  const help = await openHelp(page)
  await help.getByRole('navigation').getByRole('button', { name: 'Tu primer grafcet' }).click()
  await help.locator('[data-help-card="tutorial:primer-grafcet"]').first().getByRole('button', { name: 'Hacer el tutorial' }).click()
  await expect(help).toBeHidden()

  const title = (text) => expect(page.locator('.tour').getByRole('heading', { name: text, exact: true })).toBeVisible()
  const next = () => page.locator('.tour').getByRole('button', { name: /^(Siguiente|Terminar)$/ }).click()
  const step = (label) => page.locator('.react-flow__node-step').filter({ has: page.locator('.diagram-step-label', { hasText: new RegExp(`^${label}$`) }) })
  const transition = (text) => page.locator('.react-flow__node-transition').filter({ hasText: text })

  // Empieza con un proyecto con solo la etapa 0.
  await expect(page.locator('.react-flow__node-step')).toHaveCount(1)
  await title('La etapa inicial')
  await next()

  await title('Añade una transición')
  await step('0').click()
  await page.getByRole('button', { name: 'Añadir transición', exact: true }).click()
  await title('Su receptividad')

  await page.locator('.react-flow__node-transition').first().dblclick()
  await page.getByRole('combobox').first().fill('Marcha')
  await page.keyboard.press('Escape')
  await title('La etapa 1')

  await page.locator('.react-flow__node-transition').first().click()
  await page.getByRole('button', { name: 'Añadir etapa', exact: true }).click()
  await title('Una acción')

  await step('1').dblclick()
  await page.getByRole('button', { name: 'Añadir acción', exact: true }).last().click()
  await page.getByLabel('Texto de la acción').last().fill('Motor')
  await title('Cierra el ciclo')

  await step('1').click()
  await page.getByRole('button', { name: 'Añadir transición', exact: true }).click()
  await page.locator('.react-flow__node-transition').nth(1).dblclick()
  await page.getByRole('combobox').first().fill('Paro')
  await page.keyboard.press('Escape')
  await transition('Paro').click()
  await page.getByRole('button', { name: 'Bucle: volver a una etapa anterior' }).click()
  await step('0').click()
  await title('Conforme')
  await next()

  await title('Pruébalo')
  await page.locator('[data-tour="Simular"]').click()
  await page.locator('[data-tour="simulacion"]').getByRole('switch').first().click() // Marcha
  await title('¡Hecho!')
  await next()
  await expect(page.locator('.tour')).toHaveCount(0)
  expectNoErrors(errors)
})
