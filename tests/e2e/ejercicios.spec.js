import { readFileSync } from 'fs'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, loadProject, openEditor, openExample } from './helpers'

const step = (page, label) => page.locator('.react-flow__node-step').filter({ has: page.locator('.diagram-step-label', { hasText: new RegExp(`^${label}$`) }) })
const receptivity = async (page, node, text) => {
  await node.dblclick()
  await page.getByRole('combobox').first().fill(text)
  await page.keyboard.press('Escape')
}

// El alumno: abre un ejercicio, comprueba, lo resuelve y ve todo en verde.
test('ejercicio del alumno: enunciado, Comprobar, piezas bloqueadas y resuelto', async ({ page }) => {
  const errors = await openEditor(page, undefined, { education: true })
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
  // …corregida, falta el Piloto: lo dice la prueba de comportamiento (como en la solución del
  // profesor, el piloto se enciende con el motor).
  await receptivity(page, page.locator('.react-flow__node-transition').first(), 'Marcha')
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  const behaviour = panel.locator('[data-check="comportamiento-0"]')
  await expect(behaviour).toHaveAttribute('data-ok', 'no')
  await expect(behaviour).toContainText('Piloto: debería encenderse hacia')
  // Verlo en la simulación: se reproduce el escenario de prueba.
  await behaviour.getByRole('button', { name: 'Verlo en la simulación' }).click()
  await expect(page.locator('[data-tour="simulacion"]')).toContainText('Reproduciendo «Marcha y Paro»')
  await page.locator('[data-tour="Simular"]').click() // Detener
  // Con el Piloto, todo en verde.
  await step(page, '1').click()
  await page.locator('[data-tour="mas-accion"]').click()
  await expect(page.locator('[data-tour="propiedades"]').getByLabel('Texto de la acción').last()).toBeFocused()
  await page.keyboard.type('Piloto')
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
  const errors = await openEditor(page, undefined, { education: true })
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

// Editor de formas de onda: dibujar un pulso de Marcha y ver lo que hace el grafcet.
test('editor de escenarios: dibujar un pulso y ver la respuesta del grafcet', async ({ page }) => {
  const errors = await openEditor(page, undefined, { education: true })
  await openExample(page, /^Marcha y paro de un motor/)
  await page.locator('[data-tour="Simular"]').click()
  await page.getByRole('button', { name: 'Dibujar escenario' }).click()
  const editor = page.getByRole('dialog', { name: 'Editor de escenarios' })
  // Los detectores de la planta no se dibujan; Marcha y Paro (mandos) sí.
  await expect(editor.locator('[data-input="Marcha"]')).toHaveCount(1)
  await expect(editor.locator('[data-output="Motor"]')).toHaveAttribute('data-high', '0')
  const row = await editor.locator('[data-row="Marcha"]').boundingBox()
  // Arrastrar en la fila de Marcha de 0,5 s a 1 s (10 s en todo el ancho).
  const x = (s) => row.x + (row.width * s) / 10
  await page.mouse.move(x(0.55), row.y + row.height / 2)
  await page.mouse.down()
  await page.mouse.move(x(1.05), row.y + row.height / 2, { steps: 4 })
  await page.mouse.up()
  // El motor se enciende (y sigue encendido: nadie pulsa Paro).
  await expect.poll(async () => Number(await editor.locator('[data-output="Motor"]').getAttribute('data-high'))).toBeGreaterThan(80)
  await editor.getByLabel('Nombre').fill('Arranque')
  await editor.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('textbox', { name: 'Nombre del escenario' })).toHaveValue('Arranque')
  expectNoErrors(errors)
})

// Hoja de prácticas en PDF con el ejercicio dentro: se descarga y, al abrir el PDF, se carga el
// ejercicio en modo alumno.
test('hoja de prácticas en PDF: se imprime como una hoja y el editor abre el ejercicio de dentro', async ({ page }) => {
  const errors = await openEditor(page, undefined, { education: true })
  await openExample(page, /^Cilindros A\+ B\+/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Ejercicio para el alumnado/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ejercicio para el alumnado' })
  await dialog.getByLabel('Título').fill('Mis cilindros')
  await dialog.getByLabel('Asignatura').fill('Automatismos industriales')
  await dialog.getByLabel('Profesor/a').fill('Ana Ruiz')
  await dialog.getByLabel('Enunciado').fill('Haz **A+ B+ A− B−** al pulsar Marcha.')
  const file = await download(page, () => dialog.getByRole('button', { name: 'Hoja de prácticas (PDF)' }).click())
  expect(file.suggestedFilename()).toMatch(/\.pdf$/)
  const pdf = readFileSync(await file.path())
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  expect(pdf.toString('latin1')).toContain('/EmbeddedFiles')
  if (process.env.SHEET_OUT) (await import('fs')).writeFileSync(process.env.SHEET_OUT, pdf)

  // Abrir el PDF en el editor: el ejercicio, en modo alumno y sin la solución.
  await page.keyboard.press('Escape')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'hoja.pdf', mimeType: 'application/pdf', buffer: pdf })
  const panel = page.getByRole('complementary', { name: 'Ejercicio' })
  await expect(panel).toContainText('Mis cilindros')
  await expect(panel).not.toContainText('Vista del profesor')
  await expect(page.locator('.react-flow__node-step')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await expect(panel.locator('[data-check="grafcet"]')).toHaveAttribute('data-ok', 'no')
  expectNoErrors(errors)
})

// Un PDF sin ejercicio dentro: aviso claro, sin romper nada.
test('abrir un PDF sin ejercicio dentro avisa', async ({ page }) => {
  const errors = await openEditor(page, undefined, { education: true })
  const messages = []
  page.on('dialog', (d) => {
    messages.push(d.message())
    d.dismiss()
  })
  await page.locator('input[type=file]').first().setInputFiles({ name: 'otro.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.3\n%%EOF\n') })
  await expect.poll(async () => messages.join(' ') + (await page.locator('body').innerText())).toContain('no lleva dentro ningún proyecto')
  expectNoErrors(errors)
})

// Guion de prácticas: la práctica 1 abierta resuelta (guiada) y las demás del guion de ejemplo, en
// un único PDF; al abrirlo se elige la práctica.
test('guion de prácticas: varias prácticas en un PDF y elegir cuál abrir', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = await openEditor(page, undefined, { education: true })
  await page.getByRole('button', { name: /^Abrir/ }).click()
  await page.getByRole('menuitem', { name: /Ejercicios/ }).click()
  await page.getByRole('button', { name: /Abrir resuelta: Práctica 1/ }).click()
  await expect(page.locator('.react-flow__node-step')).toHaveCount(8) // la solución, en el lienzo
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /^Guion de prácticas/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Guion de prácticas' })
  await dialog.getByRole('button', { name: 'Usar el guion de ejemplo' }).click()
  await expect(dialog.locator('[data-practice]')).toHaveCount(5)
  await expect(dialog.locator('[data-practice="1"]')).toContainText('El proyecto abierto')
  await expect(dialog.getByLabel('Guiada')).toBeChecked()
  if (process.env.GUIDE_SHOT) await page.screenshot({ path: process.env.GUIDE_SHOT })
  const file = await download(page, () => dialog.getByRole('button', { name: 'Descargar el guion (PDF)' }).click())
  const pdf = readFileSync(await file.path())
  if (process.env.GUIDE_OUT) (await import('fs')).writeFileSync(process.env.GUIDE_OUT, pdf)
  const text = pdf.toString('latin1')
  // Cinco ejercicios y la solución de la guiada, adjuntos.
  expect(text.match(/\/Type \/Filespec/g)).toHaveLength(6)
  await dialog.getByRole('button', { name: 'Cerrar' }).last().click()

  // Abrir el guion: se elige la práctica.
  await page.locator('input[type=file]').first().setInputFiles({ name: 'guion.pdf', mimeType: 'application/pdf', buffer: pdf })
  const chooser = page.getByRole('dialog', { name: '¿Qué práctica abres?' })
  await expect(chooser.getByRole('button')).toHaveCount(7) // 6 archivos + cerrar
  await chooser.getByRole('button', { name: /Cinta transportadora/ }).click()
  const panel = page.getByRole('complementary', { name: 'Ejercicio' })
  await expect(panel).toContainText('setas de emergencia')
  await expect(page.locator('.react-flow__node-step')).toHaveCount(0)
  expectNoErrors(errors)
})

// Fase 3: pistas de una en una (contadas; Ctrl+Z no las devuelve), requisitos y nota.
test('pistas, requisitos y nota del ejercicio', async ({ page }) => {
  const errors = await openEditor(page, undefined, { education: true })
  await page.getByRole('button', { name: /^Abrir/ }).click()
  await page.getByRole('menuitem', { name: /Ejercicios/ }).click()
  await page.getByRole('button', { name: /Marcha y paro de un motor/ }).click()
  const panel = page.getByRole('complementary', { name: 'Ejercicio' })
  const hints = panel.getByRole('region', { name: 'Pistas' })
  await expect(hints).toContainText('0 de 3')
  // Una edición (la etapa inicial), luego una pista, y se deshace la edición: la pista sigue vista.
  await page.getByRole('button', { name: 'Etapa inicial', exact: true }).click()
  await expect(page.locator('.react-flow__node-step')).toHaveCount(1)
  await hints.getByRole('button', { name: 'Ver una pista' }).click()
  await expect(hints).toContainText('Necesitas dos etapas')
  await expect(hints).toContainText('1 de 3')
  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 300 } })
  await page.keyboard.press('Control+z')
  await expect(page.locator('.react-flow__node-step')).toHaveCount(0)
  await expect(hints).toContainText('1 de 3')
  await expect(hints).toContainText('Necesitas dos etapas')
  // El requisito sale en la lista (y la máquina aún no hace nada).
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await expect(panel.locator('[data-check="grafcet"]')).toHaveAttribute('data-ok', 'no')
  expectNoErrors(errors)
})

test('el profesor quita las pistas y pide nota', async ({ page }) => {
  const errors = await openEditor(page, undefined, { education: true })
  await openExample(page, /^Marcha y paro de un motor/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Ejercicio para el alumnado/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ejercicio para el alumnado' })
  await dialog.getByLabel('Título').fill('Marcha y paro')
  await dialog.getByRole('group', { name: 'Requisitos' }).getByLabel('Usa un flanco (↑ o ↓)').check()
  await dialog.getByLabel('Ofrecer pistas al alumnado').uncheck()
  await expect(dialog).toContainText('Sin pistas: el alumno no verá ninguna')
  await dialog.getByLabel('Mostrar una nota al comprobar').check()
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Ejercicio' })
  await expect(panel.getByRole('region', { name: 'Pistas' })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  // La solución no usa flancos: ese requisito en rojo, y la nota lo refleja.
  await expect(panel.locator('[data-check="requisito-edge"]')).toHaveAttribute('data-ok', 'no')
  await expect(panel.locator('[data-grade]')).toContainText(/Nota: \d+(,\d)? de 10/)
  await expect(panel.locator('[data-grade]')).not.toContainText('Nota: 10 de 10')
  expectNoErrors(errors)
})

// Fase 4: datos del proceso (activados por el profesor, avisados al alumno, en el dossier) y
// corregir las entregas de una clase (con las comprobaciones del profesor, parecidos y CSV).
test('datos del proceso y corregir las entregas de la clase', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = await openEditor(page, undefined, { education: true })
  // El profesor prepara el ejercicio y guarda su proyecto (con la solución).
  await openExample(page, /^Marcha y paro de un motor/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Ejercicio para el alumnado/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ejercicio para el alumnado' })
  await dialog.getByLabel('Título').fill('Marcha y paro')
  await dialog.getByLabel('Anotar datos del proceso del alumnado (solo totales)').check()
  const forStudents = await download(page, () => dialog.getByRole('button', { name: 'Guardar y descargar para el alumnado' }).click())
  await page.keyboard.press('Escape')
  const teacher = JSON.parse(readFileSync(await download(page, () => page.getByTitle(/Guardar proyecto/).click()).then((f) => f.path()), 'utf-8'))
  const student = JSON.parse(readFileSync(await forStudents.path(), 'utf-8'))

  // Un alumno: su ejercicio con el grafcet resuelto (el de la solución, para no dibujarlo aquí).
  const grafcet = teacher.nodes.filter((n) => n.type === 'step' || n.type === 'transition')
  await loadProject(page, { ...student, nodes: [...student.nodes, ...grafcet], edges: teacher.edges })
  const panel = page.getByRole('complementary', { name: 'Ejercicio' })
  await expect(panel.getByRole('note')).toContainText('solo totales')
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await expect(panel.locator('[data-exercise="resuelto"]')).toBeVisible()
  await panel.getByRole('button', { name: 'Comprobar' }).click()
  await page.locator('[data-tour="Simular"]').click()
  await page.locator('[data-tour="Simular"]').click()
  // Su dossier: con la página de datos del proceso y el proyecto dentro.
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Dossier de la práctica/ }).click()
  const dossier = page.getByRole('dialog', { name: 'Dossier de la práctica' })
  await dossier.getByRole('textbox', { name: 'Alumno/a' }).fill('Ana Pérez')
  await expect(dossier.getByLabel('Vista previa del dossier')).toContainText('Datos del proceso')
  await expect(dossier.getByLabel('Vista previa del dossier')).toContainText('Veces que se ha comprobado')
  const file = await download(page, () => dossier.getByRole('button', { name: 'Guardar PDF' }).click())
  const pdf = readFileSync(await file.path())
  await dossier.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  // El profesor, con su ejercicio abierto, corrige: la entrega de Ana y una copia suya.
  await loadProject(page, teacher)
  await page.getByRole('button', { name: /^Abrir un proyecto/ }).click()
  await page.getByRole('menuitem', { name: /Corregir entregas/ }).click()
  const review = page.getByRole('dialog', { name: 'Corregir entregas' })
  await expect(review.locator('[data-class-mode="profesor"]')).toContainText('Marcha y paro')
  await review.getByLabel('Archivos de las entregas').setInputFiles([
    { name: 'ana.pdf', mimeType: 'application/pdf', buffer: pdf },
    { name: 'copia.pdf', mimeType: 'application/pdf', buffer: pdf },
  ])
  const rows = review.locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.first().locator('[data-score]')).toHaveText(/^(\d+) \/ \1$/) // todo bien
  await expect(rows.first()).toContainText('2 comprobaciones · ')
  await expect(rows.first()).toContainText('1 simulación')
  await expect(review.locator('[data-similar]')).toContainText('Ana Pérez — Ana Pérez')
  if (process.env.CLASS_SHOT) {
    await rows.first().locator('summary').click()
    await page.screenshot({ path: process.env.CLASS_SHOT })
    await rows.first().locator('summary').click()
  }
  const csv = readFileSync(await download(page, () => review.getByRole('button', { name: 'Descargar CSV' }).click()).then((f) => f.path()), 'utf-8')
  expect(csv).toContain('Alumno/a;Archivo;Correctas;Total')
  expect(csv).toContain('Ana Pérez;ana.pdf;')
  expectNoErrors(errors)
})
