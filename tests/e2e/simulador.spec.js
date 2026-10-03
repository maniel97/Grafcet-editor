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
  for (const s of ['s2', 's3', 's4', 's0']) await expect.poll(() => activeSteps(page), { timeout: 3000, intervals: [100] }).toBe(s)
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

test('escena: separador para cambiar el ancho y «Ajustar» para ver todo', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 })
  const errors = await openEditor(page)
  await openExample(page, /Cilindros A\+ B\+/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  const scroller = view.locator('.paper')
  // Todo a la vista: cada elemento dentro de la zona visible de la escena.
  const allVisible = async () => {
    const area = await scroller.boundingBox()
    for (const el of await view.locator('[data-element]').all()) {
      const b = await el.boundingBox()
      if (b.x < area.x - 1 || b.y < area.y - 1 || b.x + b.width > area.x + area.width + 1 || b.y + b.height > area.y + area.height + 1) return false
    }
    return true
  }
  await expect.poll(allVisible).toBe(true) // ajuste automático al abrir

  // Separador: más estrecha, y la escena se reajusta sola.
  const before = (await view.boundingBox()).width
  const handle = view.getByRole('separator', { name: 'Ancho de la planta' })
  const h = await handle.boundingBox()
  await page.mouse.move(h.x + h.width / 2, h.y + 200)
  await page.mouse.down()
  await page.mouse.move(h.x + 200, h.y + 200, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await view.boundingBox()).width).toBeLessThan(before - 150)
  await expect.poll(allVisible).toBe(true)

  // Con zoom manual se sale de la vista; «Ajustar» lo devuelve.
  for (let i = 0; i < 8; i++) await view.getByTitle('Acercar').click()
  await expect.poll(allVisible).toBe(false)
  await view.getByRole('button', { name: 'Ajustar la vista' }).click()
  await expect.poll(allVisible).toBe(true)
  expectNoErrors(errors)
})

test('escena: vista previa flotante de los módulos de la paleta', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('button', { name: /Planta virtual/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const palette = view.getByRole('navigation', { name: 'Elementos' })
  await palette.getByRole('button', { name: '+ Cilindro' }).hover()
  const tip = page.getByRole('tooltip', { name: 'Vista previa: Cilindro' })
  await expect(tip).toBeVisible()
  await expect(tip).toContainText('sale con A+')
  // Junto al ratón y fuera al salir.
  const b = await palette.getByRole('button', { name: '+ Cilindro' }).boundingBox()
  const t = await tip.boundingBox()
  expect(Math.abs(t.y - (b.y + b.height / 2))).toBeLessThan(60)
  await palette.getByRole('button', { name: '+ Depósito' }).hover()
  await expect(page.getByRole('tooltip', { name: 'Vista previa: Depósito' })).toBeVisible()
  await expect(tip).toHaveCount(0)
  await page.mouse.move(5, 5)
  await expect(page.getByRole('tooltip', { name: /Vista previa/ })).toHaveCount(0)
  expectNoErrors(errors)
})

test('escena: potenciómetro, calentador con termostato y detectores por tipo', async ({ page }) => {
  const errors = await openEditor(page, 'escena-analogicas.json')
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await expect.poll(() => activeSteps(page)).toBe('s0')
  // Girar el potenciómetro a la derecha: Consigna > 70 -> X1 calienta hasta que salta el termostato.
  const pot = view.locator('[aria-label="Potenciómetro Consigna"]')
  const b = await pot.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + 22)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + 150, b.y + 22, { steps: 4 })
  await page.mouse.up()
  await expect(pot).toContainText('100 %')
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await expect.poll(() => activeSteps(page), { timeout: 5000 }).toBe('s2') // TS: 40 °C alcanzados
  await expect(view.locator('[aria-label="Calentador Horno"]')).toContainText('°C')

  // Paleta: un módulo por tipo de detector, con su explicación.
  await view.getByRole('radio', { name: /Editar/ }).click()
  const palette = view.getByRole('navigation', { name: 'Elementos' })
  for (const name of ['Detector óptico', 'Detector inductivo', 'Detector capacitivo', 'Detector de color']) {
    await expect(palette.getByRole('button', { name: `+ ${name}` })).toBeVisible()
  }
  await palette.getByRole('button', { name: '+ Detector inductivo' }).hover()
  await expect(page.getByRole('tooltip', { name: 'Vista previa: Detector inductivo' })).toContainText('solo detecta metal')
  await palette.getByRole('button', { name: '+ Detector inductivo' }).click()
  await expect(view.getByLabel('Propiedades del elemento').getByRole('combobox', { name: 'Tipo de detector' })).toHaveValue('inductive')
  expectNoErrors(errors)
})

test('escena: arrastrar un módulo de la paleta al punto exacto', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('button', { name: /Planta virtual/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const area = await view.locator('.paper').boundingBox()
  const target = { x: area.x + 120, y: area.y + 90 }
  await view.getByRole('button', { name: '+ Piloto' }).dragTo(view.locator('.paper'), { targetPosition: { x: 120, y: 90 } })
  const lamp = view.locator('[data-element="lamp"]')
  await expect(lamp).toHaveCount(1)
  const b = await lamp.boundingBox()
  // El centro del piloto, donde se soltó (con el ajuste a la rejilla).
  expect(Math.abs(b.x + b.width / 2 - target.x)).toBeLessThan(12)
  expect(Math.abs(b.y + b.height / 2 - target.y)).toBeLessThan(12)
  await expect(view.getByLabel('Propiedades del elemento')).toContainText('Piloto')
  expectNoErrors(errors)
})

test('escena: selección múltiple, mover en grupo, copiar/pegar/duplicar y deshacer/rehacer', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('button', { name: /Planta virtual/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const paper = view.locator('.paper')
  const drop = (name, x, y) => view.getByRole('button', { name }).dragTo(paper, { targetPosition: { x, y } })
  await drop('+ Piloto', 80, 80)
  await drop('+ Piloto', 160, 80)
  await drop('+ Pulsador', 120, 220)
  const items = view.locator('[data-element]')
  const selected = view.locator('[data-selected]')
  await expect(items).toHaveCount(3)

  // Recuadro: los dos pilotos.
  const area = await paper.boundingBox()
  await page.mouse.move(area.x + 40, area.y + 40)
  await page.mouse.down()
  await page.mouse.move(area.x + 200, area.y + 130, { steps: 5 })
  await page.mouse.up()
  await expect(selected).toHaveCount(2)
  await expect(view.getByLabel('Selección')).toContainText('2 elementos seleccionados')

  // Ctrl+clic añade el pulsador; arrastrar uno mueve los tres.
  await view.locator('[data-element="button"]').click({ modifiers: ['Control'] })
  await expect(selected).toHaveCount(3)
  const before = await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  const lamp = await view.locator('[data-element="lamp"]').first().boundingBox()
  await page.mouse.move(lamp.x + lamp.width / 2, lamp.y + lamp.height / 2)
  await page.mouse.down()
  await page.mouse.move(lamp.x + lamp.width / 2 + 80, lamp.y + lamp.height / 2, { steps: 5 })
  await page.mouse.up()
  const after = await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  after.forEach((x, i) => expect(x - before[i]).toBeGreaterThan(40))

  // Duplicar, deshacer, rehacer; copiar y pegar; borrar la selección.
  const grafcetNodes = await page.locator('.react-flow__node').count()
  await page.keyboard.press('Control+d')
  await expect(items).toHaveCount(6)
  // Deshacer / rehacer: los de siempre (atajos y botones de la barra), aplicados a la escena.
  await page.keyboard.press('Control+z')
  await expect(items).toHaveCount(3)
  await page.getByTitle('Rehacer (Ctrl+Shift+Z)').click()
  await expect(items).toHaveCount(6)
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(items).toHaveCount(9)
  await page.keyboard.press('Delete')
  await expect(items).toHaveCount(6)
  await page.getByTitle('Deshacer (Ctrl+Z)').click()
  await expect(items).toHaveCount(9)
  await expect(view.getByRole('button', { name: /Deshacer/ })).toHaveCount(0) // sin botones propios
  // En modo Usar, la barra vuelve a ser la del grafcet (bloqueada mientras se simula).
  await view.getByRole('radio', { name: /Usar/ }).click()
  await expect(page.getByTitle('Deshacer (Ctrl+Z)')).toBeDisabled()
  // El grafcet no se ha tocado: los atajos se quedan en la escena.
  await expect(page.locator('.react-flow__node')).toHaveCount(grafcetNodes)
  expectNoErrors(errors)
})
