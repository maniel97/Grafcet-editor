import { expect, test } from '@playwright/test'
import { activeSteps, expectNoErrors, openEditor, openExample } from './helpers'

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

test('ejemplo con escena: pulsar Marcha en la planta, averías y «Detectar cilindros»', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Cilindros A\+ B\+/)
  await page.getByRole('button', { name: /Simular/ }).click()
  // Con escena, la planta se ve junto al grafcet desde el principio.
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await expect(view.locator('[data-element="cylinder"]')).toHaveCount(2)
  await expect(page.getByRole('switch')).toHaveCount(0) // todas las entradas las da la escena

  // Avería: el detector b1 no detecta; el grafcet se queda esperándolo.
  await view.locator('[aria-label="Cilindro B"]').click()
  await view.getByLabel('Avería de B').selectOption({ label: 'Detector b1 roto' })
  const marcha = view.locator('[aria-label="Pulsador Marcha"]')
  const mb = await marcha.boundingBox()
  await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2)
  await page.mouse.down()
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await page.mouse.up()
  await expect.poll(() => activeSteps(page), { timeout: 4000 }).toBe('s2')
  await page.waitForTimeout(1500)
  expect(await activeSteps(page)).toBe('s2')
  await expect(page.getByRole('list', { name: 'Qué espera el grafcet' })).toContainText('falta b1: vale 0')
  await view.getByLabel('Avería de B').selectOption('')
  await expect.poll(() => activeSteps(page), { timeout: 4000 }).not.toBe('s2')

  // Sin cilindros, «Detectar cilindros» los monta a partir de los nombres.
  await view.getByRole('radio', { name: /Editar/ }).click()
  for (const name of ['Cilindro A', 'Cilindro B']) {
    await view.locator(`[aria-label="${name}"]`).click()
    await page.keyboard.press('Delete')
  }
  await expect(view.locator('[data-element="cylinder"]')).toHaveCount(0)
  await view.getByRole('button', { name: /Detectar cilindros \(2\)/ }).click()
  await expect(view.locator('[data-element="cylinder"]')).toHaveCount(2)
  expectNoErrors(errors)
})

test('escena de la planta: colocar mandos y piloto, asignar variables y accionar', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('button', { name: /Planta virtual/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const palette = view.getByRole('navigation', { name: 'Elementos' })
  const props = view.getByLabel('Propiedades del elemento')

  await palette.getByRole('button', { name: '+ Pulsador' }).click()
  await props.getByRole('combobox', { name: 'Entrada' }).selectOption('Marcha')
  await palette.getByRole('button', { name: '+ Pulsador' }).click()
  await props.getByRole('combobox', { name: 'Entrada' }).selectOption('Paro')
  await props.getByRole('combobox', { name: 'Color' }).selectOption('red')
  // El segundo pulsador encima del primero: se aparta arrastrándolo.
  const second = view.locator('[aria-label="Pulsador Paro"]')
  const box = await second.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 4 })
  await page.mouse.up()
  await palette.getByRole('button', { name: '+ Piloto' }).click()
  await props.getByRole('combobox', { name: 'Salida' }).selectOption({ index: 1 })
  // Las entradas de la escena ya no se tocan desde el panel.
  await expect(page.getByRole('switch')).toHaveCount(0)

  await view.getByRole('radio', { name: /Usar/ }).click()
  const marcha = view.locator('[aria-label="Pulsador Marcha"]')
  const mb = await marcha.boundingBox()
  await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2)
  await page.mouse.down()
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await page.mouse.up()
  const pb = await second.boundingBox()
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2)
  await page.mouse.down()
  await expect.poll(() => activeSteps(page)).toBe('s0')
  await page.mouse.up()

  // La escena se guarda en el proyecto y vuelve a verse al simular otra vez.
  await page.getByRole('button', { name: /Detener/ }).click()
  await expect(view).toHaveCount(0)
  await page.getByRole('button', { name: /Simular/ }).click()
  await expect(view.locator('[data-element]')).toHaveCount(3)
  expectNoErrors(errors)
})
