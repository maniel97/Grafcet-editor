import { expect, test } from '@playwright/test'
import { activeSteps, expectNoErrors, loadProject, openEditor } from './helpers'

// Encapsulación (IEC 60848) desde el menú: la etapa se marca como encapsulante y aparece su grafcet
// encapsulado (marco «G1» con una etapa con enlace de activación *); al simular, entran juntas.
test('convertir una etapa en encapsulante crea su grafcet encapsulado y se simula', async ({ page }) => {
  const errors = await openEditor(page)
  await loadProject(page, {
    nodes: [
      { id: 's0', type: 'step', position: { x: 0, y: 0 }, data: { label: '0', initial: true, actions: [] } },
      { id: 't1', type: 'transition', position: { x: 0, y: 100 }, data: { condition: 'Marcha' } },
      { id: 's1', type: 'step', position: { x: 0, y: 170 }, data: { label: '1', actions: [] } },
      { id: 't2', type: 'transition', position: { x: 0, y: 270 }, data: { condition: 'Paro' } },
    ],
    edges: [
      { id: 'a', source: 's0', target: 't1' },
      { id: 'b', source: 't1', target: 's1' },
      { id: 'c', source: 's1', target: 't2' },
      { id: 'd', source: 't2', target: 's0' },
    ],
  })
  await page.locator('.react-flow__node[data-id="s1"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Convertir en etapa encapsulante/ }).click()

  const frame = page.locator('.react-flow__node-frame')
  await expect(frame).toHaveCount(1)
  await expect(frame).toContainText('G1')
  await expect(page.getByLabel('Enlace de activación')).toHaveCount(1)
  // Verificar: conforme (la etapa con * no necesita enlace de entrada ni de salida).
  await expect(page.getByRole('button', { name: /Verificar/ })).toContainText('✓')

  await page.getByTitle(/^Simular el grafcet/).click()
  await expect.poll(() => activeSteps(page)).toBe('s0')
  await page.getByRole('switch').first().click() // Marcha
  // La 1 y la etapa con * de su grafcet encapsulado (la que se creó, con id nuevo).
  await expect.poll(async () => (await activeSteps(page)).split(',').length).toBe(2)
  expect((await activeSteps(page)).split(',')).toContain('s1')
  expectNoErrors(errors)
})
