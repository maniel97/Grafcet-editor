import { expect, test } from '@playwright/test'
import { expectNoErrors, openEditor } from './helpers'

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
