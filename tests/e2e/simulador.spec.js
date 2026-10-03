import { expect, test } from '@playwright/test'
import { activeSteps, expectNoErrors, openEditor } from './helpers'

test('simulación del ejemplo: entradas, salidas, pausa y paso a paso', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await expect(page.getByText('Simulación en marcha')).toBeVisible()
  await expect.poll(() => activeSteps(page)).toBe('s0')
  await expect(page.locator('.react-flow__node-toolbar button')).toHaveCount(0)

  const switches = page.getByRole('switch')
  await expect(switches).toHaveCount(2)
  await switches.nth(0).click() // Marcha
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await expect(page.locator('.react-flow__node[data-id="s1"]').getByText('Motor M1').locator('xpath=ancestor::div[contains(@class,"bg-green-200")][1]')).toHaveCount(1)

  await switches.nth(0).click()
  await switches.nth(1).click() // Paro
  await expect.poll(() => activeSteps(page)).toBe('s0')

  await page.getByRole('button', { name: 'Pausa' }).click()
  await switches.nth(1).click()
  await page.keyboard.press('1') // tecla 1 = Marcha
  await page.waitForTimeout(300)
  expect(await activeSteps(page)).toBe('s0') // en pausa no evoluciona
  await page.getByTitle(/Paso: un franqueo/).click()
  await expect.poll(() => activeSteps(page)).toBe('s1')

  await page.getByRole('button', { name: /Detener/ }).click()
  await expect(page.locator('[aria-label="Etapa activa"]')).toHaveCount(0)
  await page.locator('.react-flow__node[data-id="s0"]').click()
  await expect(page.locator('.react-flow__node-toolbar button').first()).toBeVisible()
  expectNoErrors(errors)
})

test('simulación: flanco con pulsador, memorizada, temporización y Y', async ({ page }) => {
  const errors = await openEditor(page, 'simulacion-y-temporizacion.json')
  await page.getByRole('button', { name: /Simular/ }).click()
  await expect.poll(() => activeSteps(page)).toBe('s0')

  await page.getByTitle('Pulsador: activo mientras lo mantienes pulsado').first().hover()
  await page.mouse.down()
  await page.waitForTimeout(250)
  await page.mouse.up()
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await expect(page.locator('aside div.font-mono').filter({ hasText: /^N/ }).first()).toHaveText(/N\s*1$/)
  await expect(page.getByText('3s/X1').last().locator('..')).toContainText(/\d\.\d \/ 3 s/)

  await page.getByLabel('Velocidad').selectOption('10')
  await expect.poll(() => activeSteps(page), { timeout: 5000 }).toBe('s2,s3')
  await page.getByRole('switch').nth(1).click() // Paro
  await expect.poll(() => activeSteps(page)).toBe('s0')
  expectNoErrors(errors)
})

test('«¿por qué no avanza?»: qué espera el grafcet y tarjeta al pasar por una transición', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await expect.poll(() => activeSteps(page)).toBe('s0')
  const waiting = page.getByRole('list', { name: 'Qué espera el grafcet' })
  await expect(waiting).toContainText('X0 → «Marcha»')
  await expect(waiting).toContainText('falta Marcha: vale 0')

  // Tarjeta: la transición validada espera a Marcha; la siguiente no está validada.
  await page.locator('.react-flow__node-transition').filter({ hasText: 'Marcha' }).hover()
  const card = page.getByRole('tooltip', { name: 'Por qué' })
  await expect(card).toContainText('Esperando')
  await expect(card).toContainText('Validada, espera a Marcha (vale 0).')
  await page.locator('.react-flow__node-transition').filter({ hasText: 'Paro' }).hover()
  await expect(card).toContainText('No está validada: X1 no está activa.')

  // En pausa, una entrada cambiada ya cuenta: «se franquea en el próximo ciclo».
  await page.getByRole('button', { name: 'Pausa' }).click()
  await page.getByRole('switch').first().click()
  await expect(waiting).toContainText('se franquea en el próximo ciclo')
  await page.mouse.move(5, 5)
  await expect(card).toHaveCount(0)
  expectNoErrors(errors)
})

test('planta virtual: la secuencia neumática avanza sola con sus finales de carrera', async ({ page }) => {
  const errors = await openEditor(page, 'neumatica-planta.json')
  await page.getByRole('button', { name: /Simular/ }).click()
  await expect.poll(() => activeSteps(page)).toBe('s0')
  // Solo Marcha es manual; a0, a1, b0 y b1 los da la planta.
  await expect(page.getByRole('switch')).toHaveCount(1)
  await expect(page.getByText('planta', { exact: true })).toHaveCount(4)
  await page.getByRole('switch').click() // Marcha
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await page.getByRole('switch').click() // un solo ciclo
  for (const s of ['s2', 's3', 's4', 's0']) await expect.poll(() => activeSteps(page), { timeout: 3000 }).toBe(s)
  expectNoErrors(errors)
})

test('panel de la planta: configurar una cinta y ver cómo la pieza para el motor', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('button', { name: /Planta virtual/ }).click()
  const panel = page.getByRole('region', { name: 'Planta virtual' })
  await panel.getByLabel('Tipo de elemento').selectOption({ label: 'Cinta transportadora' })
  await panel.getByRole('button', { name: 'Añadir' }).click()
  // Motor: la salida del ejemplo; sensor final: Paro (al llegar la pieza, vuelve a X0).
  const fields = panel.locator('select')
  await fields.nth(0).selectOption({ index: 1 })
  await fields.nth(1).selectOption('Paro')
  await panel.getByRole('spinbutton').fill('1')
  await expect(page.getByText('planta', { exact: true })).toHaveCount(1)

  await panel.getByRole('button', { name: 'Nueva pieza' }).click()
  await expect(panel.getByRole('img', { name: /Cinta .*: 1 piezas/ })).toBeVisible()
  await page.getByRole('switch').first().click() // Marcha
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await page.getByRole('switch').first().click()
  // La pieza llega al sensor (Paro) en 1 s: vuelve a X0 y la cinta se para con la pieza delante.
  await expect.poll(() => activeSteps(page), { timeout: 4000 }).toBe('s0')
  await expect(panel.getByRole('img', { name: /Cinta .*: 1 piezas/ })).toBeVisible()
  expectNoErrors(errors)
})
