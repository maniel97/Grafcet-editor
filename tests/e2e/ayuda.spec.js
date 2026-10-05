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

  const title = (text) => expect(page.locator('.tour').getByRole('heading', { name: text, exact: true })).toBeVisible({ timeout: 15000 })
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
  await title('Su condición')

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
  await title('La transición de paro')

  await step('1').click()
  await page.getByRole('button', { name: 'Añadir transición', exact: true }).click()
  await page.locator('.react-flow__node-transition').nth(1).dblclick()
  await page.getByRole('combobox').first().fill('Paro')
  await page.keyboard.press('Escape')
  await title('Volver al principio')
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

// Utilidades de los robots de los tutoriales.
// Pulsar un mando de la planta (pulsador: se mantiene un momento, como un dedo).
const hold = async (page, label) => {
  const b = await page.locator(`[data-tour="planta"] [aria-label="${label}"]`).first().boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
  await page.mouse.down()
  await page.waitForTimeout(150)
  await page.mouse.up()
}
const tutorial = (page) => ({
  start: async (article, id) => {
    const help = await openHelp(page)
    await help.getByRole('navigation').getByRole('button', { name: article, exact: true }).click()
    await help.locator(`[data-help-card="tutorial:${id}"]`).first().getByRole('button', { name: 'Hacer el tutorial' }).click()
    await expect(help).toBeHidden()
  },
  title: (text) => expect(page.locator('.tour').getByRole('heading', { name: text, exact: true })).toBeVisible({ timeout: 15000 }),
  next: () => page.locator('.tour').getByRole('button', { name: /^(Siguiente|Terminar)$/ }).click(),
  step: (label) => page.locator('.react-flow__node-step').filter({ has: page.locator('.diagram-step-label', { hasText: new RegExp(`^${label}$`) }) }),
  transition: (text) => page.locator('.react-flow__node-transition').filter({ hasText: text }),
  receptivity: async (node, text) => {
    await node.dblclick()
    await page.getByRole('combobox').first().fill(text)
    await page.keyboard.press('Escape')
  },
})

test('tutorial «Una espera» de principio a fin', async ({ page }) => {
  const errors = await openEditor(page)
  const tut = tutorial(page)
  await tut.start('Temporizaciones', 'temporizacion')
  await tut.title('El punto de partida')
  await tut.next()
  await tut.title('La temporización')
  await tut.receptivity(tut.transition('Paro'), '5s/X1')
  await tut.title('Pruébalo')
  await page.locator('[data-tour="Simular"]').click()
  await hold(page, 'Pulsador Marcha')
  await tut.title('Espera')
  await tut.title('¡Hecho!')
  await tut.next()
  await expect(page.locator('.tour')).toHaveCount(0)
  expectNoErrors(errors)
})

test('tutorial «Elegir un camino» de principio a fin', async ({ page }) => {
  const errors = await openEditor(page)
  const tut = tutorial(page)
  await tut.start('Elegir y hacer a la vez (O e Y)', 'divergencia-o')
  await tut.title('El punto de partida')
  await tut.next()

  await tut.title('La alternativa')
  await tut.transition('Marcha').click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Añadir alternativa en O/ }).click()
  await tut.title('Su receptividad')
  const fresh = page.locator('.react-flow__node-transition').filter({ hasNotText: /Marcha|Paro/ })
  await tut.receptivity(fresh, 'Lento')

  await tut.title('Su camino')
  await tut.transition('Lento').click()
  await page.getByRole('button', { name: 'Añadir etapa', exact: true }).click()
  await tut.step('2').dblclick()
  await page.getByRole('button', { name: 'Añadir acción', exact: true }).last().click()
  await page.getByLabel('Texto de la acción').last().fill('Motor_lento')
  await tut.step('2').click()
  await page.getByRole('button', { name: 'Añadir transición', exact: true }).click()
  await tut.receptivity(page.locator('.react-flow__node-transition').filter({ hasNotText: /Marcha|Paro|Lento/ }), '!Paro')
  await tut.title('Cierra el camino')
  await page.locator('.react-flow__node-transition').filter({ hasText: 'Paro' }).last().click()
  await page.getByRole('button', { name: 'Bucle: volver a una etapa anterior' }).click()
  await page.getByRole('button', { name: 'Encuadrar todo el diagrama' }).click()
  await tut.step('0').click()

  await tut.title('¿Y si pulso las dos?')
  await tut.receptivity(tut.transition('Lento'), 'Lento · !Marcha')
  await tut.title('¡Hecho!')
  await tut.next()
  await expect(page.locator('.tour')).toHaveCount(0)
  expectNoErrors(errors)
})

test('tutorial «Probar con la planta» de principio a fin', async ({ page }) => {
  const errors = await openEditor(page)
  const tut = tutorial(page)
  await tut.start('La planta virtual', 'planta')
  await tut.title('La taladradora')
  await tut.next()
  await tut.title('Simular')
  await page.locator('[data-tour="Simular"]').click()
  await tut.title('La planta')
  await tut.next()
  await tut.title('Manos a la obra')
  await page.locator('[data-tour="planta"] [data-element="switch"]').first().click()
  await hold(page, 'Pulsador Marcha')
  await tut.title('Un ciclo entero')
  await tut.title('¡Hecho!')
  await tut.next()
  await expect(page.locator('.tour')).toHaveCount(0)
  expectNoErrors(errors)
})

// Ayuda contextual: desde un aviso de Verificar y desde el panel de propiedades, al artículo.
test('ayuda contextual: Verificar y propiedades llevan a su artículo', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Etapa', exact: true }).click() // etapa suelta: avisos
  await page.locator('[data-tour="Verificar"]').click()
  const panel = page.locator('aside').filter({ hasText: 'Verificación IEC 60848' })
  await panel.getByText(/no tiene enlace de entrada/).first().locator('xpath=ancestor::li').getByRole('button', { name: 'Más en la ayuda' }).click()
  const help = page.getByRole('dialog', { name: 'Ayuda' })
  await expect(help.getByRole('heading', { name: 'Etapas', level: 2 })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.locator('.react-flow__node-step').first().dblclick()
  await page.getByRole('button', { name: 'Ayuda: acciones' }).click()
  await expect(help.getByRole('heading', { name: 'Acciones', level: 2 })).toBeVisible()
  expectNoErrors(errors)
})

// Los artículos se ven en el idioma elegido (con su índice y su buscador).
test('wiki en inglés', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByTitle('Opciones: tema, letra y tamaño').click()
  await page.getByLabel('Idioma').selectOption('en')
  await page.keyboard.press('Escape')
  await page.getByTitle('Shortcuts and notation (?)').click()
  const help = page.getByRole('dialog', { name: 'Help' })
  await help.getByRole('navigation').getByRole('button', { name: 'Choosing and doing at once (OR and AND)' }).click()
  await expect(help.getByRole('heading', { name: 'OR divergence: choosing a path' })).toBeVisible()
  await expect(help.locator('[data-help-card="tutorial:divergencia-o"]')).toContainText('Choosing a path')
  await help.getByLabel('Search the help').fill('enclosing step')
  await expect(help.getByRole('region', { name: 'Search results' }).getByRole('button', { name: /^Enclosure/ })).toBeVisible()
  expectNoErrors(errors)
})

// El tutorial del profesorado, hecho por un robot: del marcha-paro resuelto a un ejercicio, con un
// escenario grabado en la planta, el diálogo (la visita se ve sobre él), romper y arreglar.
test('tutorial «Prepara tu primer ejercicio» (profesorado) de principio a fin', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = await openEditor(page)
  const tut = tutorial(page)
  await tut.start('Ejercicios', 'preparar-ejercicio')
  await tut.title('Tu solución')
  await tut.next()

  await tut.title('El modo educativo')
  await page.getByTitle(/^Opciones/).click()
  const options = page.getByRole('dialog', { name: 'Opciones' })
  await options.getByLabel('Mostrar las herramientas para clase').check()
  await options.getByRole('button', { name: 'Listo' }).click()

  await tut.title('Un escenario de prueba')
  await page.locator('[data-tour="Simular"]').click()
  await page.locator('[data-tour="simulacion"]').getByRole('button', { name: 'Grabar escenario' }).click()
  await hold(page, 'Pulsador Marcha')
  await page.waitForTimeout(1500)
  await hold(page, 'Pulsador Paro')
  await page.waitForTimeout(500)
  await page.locator('[data-tour="simulacion"]').getByRole('button', { name: 'Detener y guardar' }).click()

  await tut.title('Termina de simular')
  await page.locator('[data-tour="Simular"]').click()

  await tut.title('Prepara el ejercicio')
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Ejercicio para el alumnado/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ejercicio para el alumnado' })

  // La visita se ve encima del diálogo.
  await tut.title('Qué se comprueba')
  await expect(dialog.locator('.tour')).toHaveCount(1)
  if (process.env.TOUR_SHOT) await page.screenshot({ path: process.env.TOUR_SHOT })
  await dialog.locator('[data-tour="pruebas-comportamiento"] input[type=checkbox]').first().check()
  await tut.title('Pruébalo con tu solución')
  await dialog.getByRole('button', { name: 'Probar' }).click()
  await tut.title('Guárdalo')
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()

  await tut.title('La vista del profesor')
  await tut.next()
  await tut.title('Rómpelo a propósito')
  const panel = page.getByRole('complementary', { name: 'Ejercicio' })
  await tut.receptivity(page.locator('.react-flow__node-transition').nth(1), 'Paro')
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await tut.title('Qué ha detectado')
  await expect(panel.locator('[data-stale]')).toBeVisible()
  await tut.next()

  await tut.title('Déjalo como estaba')
  await tut.receptivity(page.locator('.react-flow__node-transition').nth(1), '!Paro')
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await tut.title('Listo para repartir')
  await tut.next()
  await expect(page.locator('.tour')).toHaveCount(0)
  expectNoErrors(errors)
})

// Acerca de: autoría, licencia libre, cómo se ha hecho (con IA, supervisado), privacidad y marcas.
test('ayuda: «Acerca de» con licencia, autoría y aviso de IA', async ({ page }) => {
  const errors = await openEditor(page)
  const help = await openHelp(page)
  await help.getByRole('navigation', { name: 'Secciones de la ayuda' }).getByRole('button', { name: 'Acerca de' }).click()
  const about = help.locator('[data-about]')
  await expect(about).toContainText('© 2026 Maniel Montes')
  // Versión de package.json y aviso de versión de prueba con enlace para avisar de fallos.
  await expect(about.locator('[data-version]')).toContainText('Versión 0.1.0-alpha.2')
  await expect(about.locator('[data-prerelease]')).toContainText('Estado: alfa')
  await expect(about.getByRole('link', { name: 'Avisar de un fallo' })).toHaveAttribute('href', 'https://github.com/maniel97/Grafcet-editor/issues')
  await expect(about).toContainText('GPL-3.0')
  await expect(about).toContainText('vibe coding')
  await expect(about).toContainText('no se envían a ningún servidor')
  await expect(about).toContainText('no tiene relación con Siemens')
  await expect(about.getByRole('link', { name: 'grafcet-editor.com' })).toHaveAttribute('href', 'https://grafcet-editor.com')
  await expect(about.getByRole('link', { name: 'Código fuente' })).toHaveAttribute('href', 'https://github.com/maniel97/Grafcet-editor')
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  expectNoErrors(errors)
})
