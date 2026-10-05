import { expect, test } from '@playwright/test'
import { activeSteps, download, expectNoErrors, openEditor, openExample, openVariables, saveFromDialog } from './helpers'

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
  const pick = async (name, value) => {
    await props.getByRole('combobox', { name }).fill(value)
    await props.getByRole('combobox', { name }).press('Enter')
  }
  await pick('Entrada', 'Marcha')
  await palette.getByRole('button', { name: '+ Pulsador' }).click()
  await pick('Entrada', 'Paro')
  await props.getByRole('combobox', { name: 'Color' }).selectOption('red')
  // El segundo pulsador encima del primero: se aparta arrastrándolo.
  const second = view.locator('[aria-label="Pulsador Paro"]')
  const box = await second.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 4 })
  await page.mouse.up()
  await palette.getByRole('button', { name: '+ Piloto' }).click()
  // La lista de sugerencias, justo debajo del campo; se elige con el ratón.
  const salida = props.getByRole('combobox', { name: 'Salida' })
  await salida.click()
  const list = props.getByRole('listbox', { name: 'Salida' })
  const fb = await salida.boundingBox()
  const lb = await list.boundingBox()
  expect(Math.abs(lb.x - fb.x)).toBeLessThan(4)
  expect(Math.abs(lb.y - (fb.y + fb.height))).toBeLessThan(6)
  await list.getByRole('option').first().click()
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
  const scroller = view.locator('.paper').first()
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
  const area = await view.locator('.paper').first().boundingBox()
  const target = { x: area.x + 120, y: area.y + 90 }
  await view.getByRole('button', { name: '+ Piloto' }).dragTo(view.locator('.paper').first(), { targetPosition: { x: 120, y: 90 } })
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
  const paper = view.locator('.paper').first()
  const drop = (name, x, y) => view.getByRole('button', { name }).dragTo(paper, { targetPosition: { x, y } })
  await drop('+ Piloto', 80, 80)
  await drop('+ Piloto', 160, 80)
  await drop('+ Pulsador', 120, 220)
  const items = view.locator('[data-element]')
  const selected = view.locator('[data-selected]')
  await expect(items).toHaveCount(3)

  // Recuadro (Mayús+arrastrar, como en el lienzo): los dos pilotos.
  const area = await paper.boundingBox()
  await page.mouse.move(area.x + 40, area.y + 40)
  await page.keyboard.down('Shift')
  await page.mouse.down()
  await page.mouse.move(area.x + 200, area.y + 130, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
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

test('escena: desplazar la vista arrastrando el fondo (como en el lienzo), en Usar y en Editar', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Cilindros A\+ B\+/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  const scroller = view.locator('.paper').first()
  // Un punto del fondo (sin elemento debajo), cerca de la esquina inferior derecha de la vista.
  const backgroundSpot = async () => {
    const box = await scroller.boundingBox()
    return page.evaluate(({ x, y, w, h }) => {
      for (let dx = 40; dx < w; dx += 20)
        for (let dy = 40; dy < h; dy += 20) {
          const el = document.elementFromPoint(x + w - dx, y + h - dy)
          if (el?.closest('svg[aria-label="Escena"]') && !el.closest('[data-element]')) return { x: x + w - dx, y: y + h - dy }
        }
      return null
    }, { x: box.x, y: box.y, w: box.width, h: box.height })
  }
  for (const mode of ['Usar', 'Editar']) {
    await view.getByRole('radio', { name: new RegExp(mode) }).click()
    for (let i = 0; i < 6; i++) await view.getByTitle('Acercar').click() // más grande que la vista
    await scroller.evaluate((el) => el.scrollTo(200, 150))
    const spot = await backgroundSpot()
    expect(spot, mode).not.toBeNull()
    const before = await scroller.evaluate((el) => [el.scrollLeft, el.scrollTop])
    await page.mouse.move(spot.x, spot.y)
    await page.mouse.down()
    await page.mouse.move(spot.x - 60, spot.y - 40, { steps: 4 })
    await page.mouse.up()
    const after = await scroller.evaluate((el) => [el.scrollLeft, el.scrollTop])
    expect(after[0] - before[0], mode).toBeGreaterThan(50)
    expect(after[1] - before[1], mode).toBeGreaterThan(30)
  }
  await expect(view.locator('[data-selected]')).toHaveCount(0) // sin recuadro de selección
  expectNoErrors(errors)
})

test('escena: desplazar la vista arrastrando con la rueda pulsada', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Cilindros A\+ B\+/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  const scroller = view.locator('.paper').first()
  for (let i = 0; i < 6; i++) await view.getByTitle('Acercar').click() // más grande que la vista
  await scroller.evaluate((el) => el.scrollTo(200, 150))
  const before = await scroller.evaluate((el) => [el.scrollLeft, el.scrollTop])
  // Empezando encima de un cilindro: desplaza, no lo mueve ni lo acciona.
  const b = await view.locator('[data-element="cylinder"]').first().boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(b.x + b.width / 2 - 60, b.y + b.height / 2 - 40, { steps: 4 })
  await page.mouse.up({ button: 'middle' })
  const after = await scroller.evaluate((el) => [el.scrollLeft, el.scrollTop])
  expect(after[0] - before[0]).toBeGreaterThan(50)
  expect(after[1] - before[1]).toBeGreaterThan(30)
  expectNoErrors(errors)
})

test('escena: zoom con la rueda, centrado en el puntero', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Cilindros A\+ B\+/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  const zoomText = () => view.getByText(/^\d+ %$/).first().innerText()
  const cyl = view.locator('[data-element="cylinder"]').first()
  const b = await cyl.boundingBox()
  const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  const before = await zoomText()
  await page.mouse.move(at.x, at.y)
  await page.mouse.wheel(0, -300) // acercar
  await expect.poll(zoomText).not.toBe(before)
  expect(parseInt(await zoomText())).toBeGreaterThan(parseInt(before))
  // El cilindro sigue bajo el puntero.
  const a = await cyl.boundingBox()
  expect(Math.abs(a.x + a.width / 2 - at.x)).toBeLessThan(25)
  expect(Math.abs(a.y + a.height / 2 - at.y)).toBeLessThan(25)
  await page.mouse.wheel(0, 600) // alejar
  await expect.poll(async () => parseInt(await zoomText())).toBeLessThan(parseInt(before))
  expectNoErrors(errors)
})

test('escena: escribir una variable nueva en un elemento la añade a la tabla', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('button', { name: /Planta virtual/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const props = view.getByLabel('Propiedades del elemento')
  await view.getByRole('button', { name: '+ Pulsador' }).click()
  const field = props.getByRole('combobox', { name: 'Entrada' })

  // Nombre nuevo: aviso de que se creará y, al confirmar, entrada nueva en la tabla y en el panel.
  await field.fill('Rearme')
  await expect(props).toContainText('Nueva: se añadirá a la tabla como entrada.')
  await field.press('Enter')
  await expect(view.locator('[aria-label="Pulsador Rearme"]')).toHaveCount(1)
  await expect(page.getByText('Rearme', { exact: true }).first()).toBeVisible()

  // Errata: pregunta antes de crear.
  await view.getByRole('button', { name: '+ Pulsador' }).click()
  await field.fill('Marhca')
  await field.press('Enter')
  await expect(props.getByRole('status')).toContainText('¿Querías decir Marcha?')
  await props.getByRole('button', { name: 'Marcha', exact: true }).click()
  await expect(view.locator('[aria-label="Pulsador Marcha"]')).toHaveCount(1)

  // La variable nueva está en la tabla de variables (al terminar de simular).
  await page.getByRole('button', { name: /Detener/ }).click()
  const dialog = await openVariables(page)
  await dialog.getByRole('tab', { name: /Variables/ }).click()
  await expect(dialog.getByRole('row', { name: /^Rearme/ })).toBeVisible()
  expectNoErrors(errors)
})

test('escena: rótulos con E/S y panel de conexiones', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Cilindros A\+ B\+/)
  const table = await openVariables(page)
  await table.getByRole('button', { name: /Rellenar vacías/ }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })

  // Rótulos: cada variable con su dirección.
  await view.getByRole('button', { name: 'E/S' }).click()
  await expect(view.locator('svg[aria-label="Escena"]')).toContainText(/Marcha I\d+\.\d/)
  await expect(view.locator('svg[aria-label="Escena"]')).toContainText(/A\+ Q\d+\.\d/)

  // Conexiones: todo conectado; un piloto sin variable aparece como aviso.
  await view.getByRole('button', { name: /Conexiones/ }).click()
  const panel = view.getByLabel('Conexiones de la planta')
  await expect(panel.getByRole('list', { name: 'Conectadas' })).toContainText('Marcha')
  await expect(panel.getByLabel('Avisos de conexión')).toHaveCount(0)
  await view.getByRole('radio', { name: /Editar/ }).click()
  await view.getByRole('button', { name: '+ Piloto' }).click()
  await page.keyboard.press('Escape') // sin selección: vuelve el panel de conexiones
  await expect(view.getByRole('button', { name: /Conexiones/ })).toContainText('1')
  await panel.getByLabel('Avisos de conexión').getByRole('button', { name: /Piloto/ }).click()
  await expect(view.getByLabel('Propiedades del elemento')).toContainText('Piloto')
  expectNoErrors(errors)
})

test('escena: panel de control aparte de la máquina', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('button', { name: /Planta virtual/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const desk = view.getByRole('region', { name: 'Panel de control' })
  const props = view.getByLabel('Propiedades del elemento')
  const pick = async (name, value) => {
    await props.getByRole('combobox', { name }).fill(value)
    await props.getByRole('combobox', { name }).press('Enter')
  }
  // Con un clic, los mandos van al panel; arrastrado al panel, también.
  await view.getByRole('button', { name: '+ Pulsador' }).click()
  await pick('Entrada', 'Marcha')
  await view.getByRole('button', { name: '+ Piloto' }).dragTo(desk)
  await expect(desk.locator('[data-element]')).toHaveCount(2)
  await expect(view.locator('svg[aria-label="Escena"] [data-element]')).toHaveCount(0)
  // Orden en el panel: el piloto (seleccionado) a la izquierda.
  await props.getByTitle('Mover a la izquierda en el panel').click()
  await expect(desk.locator('[data-element]').first()).toHaveAttribute('data-element', 'lamp')

  // Funciona igual desde el panel.
  await view.getByRole('radio', { name: /Usar/ }).click()
  const marcha = desk.locator('[aria-label="Pulsador Marcha"]')
  const b = await marcha.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
  await page.mouse.down()
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await page.mouse.up()

  // A la máquina: pasa a la escena.
  await view.getByRole('radio', { name: /Editar/ }).click()
  await desk.locator('[aria-label="Pulsador Marcha"]').click()
  await props.getByRole('combobox', { name: 'Ubicación' }).selectOption('machine')
  await expect(view.locator('svg[aria-label="Escena"] [aria-label="Pulsador Marcha"]')).toHaveCount(1)
  await expect(desk.locator('[data-element]')).toHaveCount(1)
  expectNoErrors(errors)
})

test('escena: desviador y rampa en la paleta, con sus propiedades', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('button', { name: /Planta virtual/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const props = view.getByLabel('Propiedades del elemento')
  await view.getByRole('button', { name: '+ Desviador' }).click()
  await expect(props.getByRole('combobox', { name: 'Desviar (salida)' })).toBeVisible()
  await expect(props.getByRole('spinbutton', { name: 'Tiempo en recorrerla (s)' })).toHaveValue('0.5')
  await view.getByRole('button', { name: '+ Rampa' }).click()
  await expect(props).toContainText('Rampa')
  await expect(view.locator('svg[aria-label="Escena"] [data-element="diverter"]')).toHaveCount(1)
  await expect(view.locator('svg[aria-label="Escena"] [data-element="ramp"]')).toHaveCount(1)
  expectNoErrors(errors)
})

test('ejemplo pick & place: la ventosa lleva la pieza del almacén al destino', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Pick & place/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  const marcha = view.getByRole('region', { name: 'Panel de control' }).locator('[aria-label="Pulsador Marcha"]')
  const b = await marcha.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
  await page.mouse.down()
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await page.mouse.up()
  // Un ciclo completo: la pieza llega a la recogida (contador 1) y X vuelve a casa.
  await expect(view.locator('[aria-label="Recogida Destino"]')).toContainText('1', { timeout: 12000 })
  await expect.poll(() => activeSteps(page), { timeout: 5000 }).toBe('s0')

  // En modo Editar: «Pick & place» de la paleta crea X y Z ya montado en él.
  await view.getByRole('radio', { name: /Editar/ }).click()
  await view.getByRole('button', { name: '+ Pick & place (2 cilindros)' }).click()
  const props = view.getByLabel('Propiedades del elemento')
  await expect(props.getByRole('combobox', { name: 'Montado en el vástago de' })).toHaveValue(/.+/)
  await expect(props.getByRole('combobox', { name: 'Ventosa: vacío (opcional)' })).toBeVisible()
  expectNoErrors(errors)
})

test('estación «Clasificadora por material»: el metal y el plástico acaban en su recogida', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Clasificadora por material/)
  // La nota del ejemplo, con formato: título, listas y variables.
  const note = page.locator('.react-flow__node-note').first()
  await expect(note.locator('p.font-bold')).toHaveText('Clasificadora por material')
  await expect(note.locator('code').first()).toHaveText('Metal')
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByLabel('Velocidad').selectOption('5')
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('region', { name: 'Panel de control' }).locator('[aria-label="Interruptor Marcha"]').click()
  await expect(view.locator('[aria-label="Recogida Metal"]')).toContainText(/[1-9]/, { timeout: 15000 })
  await expect(view.locator('[aria-label="Recogida Plástico"]')).toContainText(/[1-9]/, { timeout: 15000 })
  expectNoErrors(errors)
})

test('escena: guardar una selección en «Mis grupos», colocarla, exportar e importar', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Pick & place/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const machine = view.locator('svg[aria-label="Escena"] [data-element]')
  await expect(machine).toHaveCount(4) // X, Z, almacén y destino (Marcha está en el panel)

  // Seleccionar los dos cilindros y guardarlos como grupo.
  await view.locator('[aria-label="Cilindro X"]').click()
  await view.locator('[aria-label="Cilindro Z"]').click({ modifiers: ['Control'] })
  await view.getByPlaceholder(/Nombre, p\. ej\./).fill('Brazo XZ')
  await view.getByRole('button', { name: 'Guardar como grupo' }).click()
  const groups = view.getByLabel('Mis grupos')
  await expect(groups.getByRole('button', { name: '+ Brazo XZ' })).toBeVisible()

  // Colocarlo: dos cilindros nuevos, el Z montado en el X nuevo.
  await groups.getByRole('button', { name: '+ Brazo XZ' }).click()
  await expect(machine).toHaveCount(6)
  await expect(view.getByLabel('Selección')).toContainText('2 elementos seleccionados')

  // Se recuerda en este navegador.
  await page.reload()
  // El autoguardado se escribe al recargar, aunque el último cambio sea de hace un instante.
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Pick & place')
  await page.getByRole('button', { name: /Simular/ }).click()
  await view.getByRole('radio', { name: /Editar/ }).click()
  await expect(groups.getByRole('button', { name: '+ Brazo XZ' })).toBeVisible()

  // Exportar, borrar e importar.
  const file = await download(page, () => groups.getByRole('button', { name: 'Exportar mis grupos' }).click())
  const path = await file.path()
  await groups.getByRole('button', { name: '+ Brazo XZ' }).hover()
  await groups.getByRole('button', { name: 'Borrar el grupo Brazo XZ' }).click()
  await expect(groups.getByRole('button', { name: '+ Brazo XZ' })).toHaveCount(0)
  await groups.getByLabel('Archivo de grupos').setInputFiles(path)
  await expect(groups.getByRole('button', { name: '+ Brazo XZ' })).toBeVisible()
  await expect(groups.getByRole('status')).toContainText('Importados 1 grupos')
  expectNoErrors(errors)
})

test('ejemplos de nivel 1 y 2: marcha/paro NC, contador y puerta de garaje', async ({ page }) => {
  const errors = await openEditor(page)
  const desk = () => page.getByRole('region', { name: 'Panel de control' })
  const press = async (label) => {
    const b = await desk().locator(`[aria-label="${label}"]`).boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
    await page.mouse.down()
    await page.waitForTimeout(120)
    await page.mouse.up()
    await page.waitForTimeout(120)
  }
  const noteFits = async () => page.locator('.react-flow__node-note [data-note-body]').first().evaluate((el) => el.scrollHeight <= el.clientHeight + 2)

  // Nivel 1: Paro es NC (sin pulsar da 1).
  await openExample(page, /Marcha y paro de un motor/)
  expect(await noteFits()).toBe(true)
  await page.getByRole('button', { name: /Simular/ }).click()
  await press('Pulsador Marcha')
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await press('Pulsador Paro')
  await expect.poll(() => activeSteps(page)).toBe('s0')
  await page.getByRole('button', { name: /Detener/ }).click()

  // Nivel 1: a la tercera pulsación, la luz.
  await openExample(page, /Contar pulsaciones/)
  expect(await noteFits()).toBe(true)
  await page.getByRole('button', { name: /Simular/ }).click()
  await press('Pulsador Marcha')
  for (let i = 0; i < 2; i++) await press('Pulsador P')
  await expect(desk().locator('[aria-label="Visualizador C"]')).toContainText('2')
  await press('Pulsador P')
  await expect.poll(() => activeSteps(page)).toBe('s3')
  await page.getByRole('button', { name: /Detener/ }).click()

  // Nivel 2: con un coche en la puerta mientras baja, vuelve a abrir.
  await openExample(page, /Puerta de garaje/)
  expect(await noteFits()).toBe(true)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByLabel('Velocidad').selectOption('2') // a ×2, bajar dura 1 s
  await press('Pulsador Abrir')
  await expect.poll(() => activeSteps(page), { timeout: 8000, intervals: [100] }).toBe('s3')
  await press('Pulsador Poner coche') // el pulsador del panel de control suelta el coche
  // Vuelve a abrir (etapa 1 -> 2) y, con el coche delante, se queda abierta.
  await expect.poll(() => activeSteps(page), { intervals: [100] }).toBe('s2')
  await page.waitForTimeout(3500)
  expect(await activeSteps(page)).toBe('s2')
  expectNoErrors(errors)
})

test('ejemplos de nivel 3: ascensor, doble puesto y clasificadora por tamaño', async ({ page }) => {
  const errors = await openEditor(page)
  const desk = () => page.getByRole('region', { name: 'Panel de control' })
  const press = async (label) => {
    const b = await desk().locator(`[aria-label="${label}"]`).boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
    await page.mouse.down()
    await page.waitForTimeout(150)
    await page.mouse.up()
  }
  const noteFits = async () => page.locator('.react-flow__node-note [data-note-body]').first().evaluate((el) => el.scrollHeight <= el.clientHeight + 2)
  const seen = async (step) => expect.poll(() => activeSteps(page), { timeout: 8000, intervals: [100] }).toContain(step)

  // Ascensor: a la planta 2, a la 1 (bajando) y a la 0; vuelve al reposo cada vez.
  await openExample(page, /Ascensor de 3 plantas/)
  expect(await noteFits()).toBe(true)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByLabel('Velocidad').selectOption('2')
  for (const [call, step] of [['Pulsador Llamar 2', 's3'], ['Pulsador Llamar 1', 's4'], ['Pulsador Llamar 0', 's1']]) {
    await press(call)
    await seen(step)
    await expect.poll(() => activeSteps(page), { timeout: 8000 }).toBe('s0')
  }
  await page.getByRole('button', { name: /Detener/ }).click()

  // Doble puesto: las dos ramas a la vez y vuelta al reposo cuando acaban las dos.
  await openExample(page, /Estación de doble puesto/)
  expect(await noteFits()).toBe(true)
  await page.getByRole('button', { name: /Simular/ }).click()
  await press('Pulsador Marcha')
  await seen('s1')
  expect(await activeSteps(page)).toContain('s4')
  await seen('s6') // el marcado acaba antes y espera
  await expect.poll(() => activeSteps(page), { timeout: 8000 }).toBe('s0')
  await page.getByRole('button', { name: /Detener/ }).click()

  // Clasificadora por tamaño: las tres recogidas reciben piezas.
  await openExample(page, /Clasificadora por tamaño/)
  expect(await noteFits()).toBe(true)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByLabel('Velocidad').selectOption('5')
  await desk().locator('[aria-label="Interruptor Marcha"]').click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  for (const name of ['Rechazo (metal)', 'Grandes', 'Pequeñas']) {
    await expect(view.locator(`[aria-label="Recogida ${name}"]`)).toContainText(/[1-9]/, { timeout: 20000 })
  }
  expectNoErrors(errors)
})

test('ejemplos de nivel 4: manual/automático y línea con GEMMA', async ({ page }) => {
  const errors = await openEditor(page)
  const desk = () => page.getByRole('region', { name: 'Panel de control' })
  const hold = async (label, ms = 150) => {
    const b = await desk().locator(`[aria-label="${label}"]`).boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
    await page.mouse.down()
    await page.waitForTimeout(ms)
    await page.mouse.up()
  }
  const steps = () => activeSteps(page)
  const noteFits = async () => page.locator('.react-flow__node-note [data-note-body]').first().evaluate((el) => el.scrollHeight <= el.clientHeight + 2)

  // Manual: el cilindro se mueve con los pulsadores; no se pasa a automático con él fuera.
  await openExample(page, /Manual \/ Automático/)
  expect(await noteFits()).toBe(true)
  await page.getByRole('button', { name: /Simular/ }).click()
  await expect.poll(steps).toBe('s0,s20')
  await hold('Pulsador Avanzar', 1800)
  await desk().locator('[aria-label="Interruptor Manual / Auto"]').click()
  await page.waitForTimeout(300)
  expect(await steps()).toBe('s0,s20') // a1: espera a que vuelva
  await hold('Pulsador Retroceder', 1800)
  await expect.poll(steps).toBe('s0,s21')
  // Automático: un ciclo con Ciclo; al quitar Auto vuelve a manual (en reposo).
  await hold('Pulsador Ciclo')
  await expect.poll(steps, { intervals: [100] }).toContain('s1')
  await expect.poll(steps, { timeout: 6000 }).toBe('s0,s21')
  await desk().locator('[aria-label="Interruptor Manual / Auto"]').click()
  await expect.poll(steps).toBe('s0,s20')
  await page.getByRole('button', { name: /Detener/ }).click()

  // GEMMA: marcha, emergencia (producción sin etapas) y rearme a la posición inicial.
  await openExample(page, /Línea con GEMMA/)
  expect(await noteFits()).toBe(true)
  await page.getByRole('button', { name: /Simular/ }).click()
  await expect.poll(steps).toBe('s0,s20')
  await hold('Pulsador Marcha')
  await expect.poll(steps, { intervals: [100] }).toContain('s1')
  const seta = desk().locator('[aria-label="Seta de emergencia Emergencia"]')
  await seta.click()
  await expect.poll(steps).toBe('s23')
  await seta.click() // desenclavar
  await hold('Pulsador Rearme')
  await expect.poll(steps, { timeout: 6000 }).toBe('s0,s20')
  expectNoErrors(errors)
})

test('generador de secuencias neumáticas: de «A+ B+ B− A−» a un grafcet que funciona con su planta', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByTitle('Abrir un proyecto, un ejemplo o un trabajo anterior').click()
  await page.getByRole('menuitem', { name: /Secuencia neumática/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Secuencia neumática' })
  const input = dialog.getByLabel('Secuencia')
  await input.fill('A+ A+ B-')
  await expect(dialog.getByRole('alert')).toContainText('A+ dos veces seguidas')
  await expect(dialog.getByRole('button', { name: 'Crear grafcet' })).toBeDisabled()
  await input.fill('A+ (B+ C+) B- (A- C-)')
  const preview = dialog.getByLabel('Vista previa')
  await expect(preview).toContainText('Etapa 2 [B+, C+]')
  await expect(preview).toContainText('«a0 · c0»')
  await dialog.getByRole('button', { name: 'Crear grafcet' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.react-flow__node-step')).toHaveCount(5)
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue(/Secuencia A\+ \(B\+ C\+\)/)

  // Con su planta: tres cilindros y Marcha; un ciclo completo.
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await expect(view.locator('[data-element="cylinder"]')).toHaveCount(3)
  const marcha = view.getByRole('region', { name: 'Panel de control' }).locator('[aria-label="Pulsador Marcha"]')
  const b = await marcha.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
  await page.mouse.down()
  await expect.poll(() => activeSteps(page)).toBe('s1')
  await page.mouse.up()
  await expect.poll(() => activeSteps(page), { timeout: 8000, intervals: [100] }).toBe('s3')
  await expect.poll(() => activeSteps(page), { timeout: 8000 }).toBe('s0')
  expectNoErrors(errors)
})

test('escena: sirena, semáforo, electroválvula, barrera, tubería, rótulo e imagen', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: /Simular/ }).click()
  await page.getByRole('button', { name: /Planta virtual/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const svg = view.locator('svg[aria-label="Escena"]')
  for (const [name, type] of [['Sirena', 'siren'], ['Semáforo', 'trafficlight'], ['Electroválvula', 'valve'], ['Barrera', 'barrier'], ['Tubería', 'pipe'], ['Rótulo', 'label'], ['Imagen', 'image']]) {
    await view.getByRole('button', { name: `+ ${name}`, exact: true }).click()
    await expect(svg.locator(`[data-element="${type}"]`)).toHaveCount(1)
  }
  const props = view.getByLabel('Propiedades del elemento')
  // Imagen: se elige un archivo y se dibuja.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDKgCZD8BAAs2gT9nN+hTQAAAABJRU5ErkJggg==', 'base64')
  await props.getByLabel('Elegir imagen').setInputFiles({ name: 'plano.png', mimeType: 'image/png', buffer: png })
  await expect(svg.locator('[data-element="image"] image')).toHaveAttribute('href', /^data:image\/png;base64,/)
  // Rótulo: su texto en la escena.
  await svg.locator('[data-element="label"]').click()
  await props.getByRole('textbox', { name: 'Rótulo' }).fill('Estación de prueba')
  await expect(svg.locator('[data-element="label"]')).toContainText('Estación de prueba')
  // Sirena: con la opción de sonido.
  await svg.locator('[data-element="siren"]').click()
  await expect(props.getByRole('checkbox', { name: /Con sonido/ })).not.toBeChecked()
  expectNoErrors(errors)
})

test('planta de frente: con «Gravedad» la pieza cae a la cinta y, al final de la cinta, a la recogida', async ({ page }) => {
  const errors = await openEditor(page, 'escena-gravedad.json')
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  // Una pieza en el alimentador (se suelta al pulsarlo en modo Usar).
  await view.locator('[aria-label^="Alimentador"]').click()
  const piece = view.locator('[data-piece] rect')
  await expect(piece).toHaveCount(1)
  const bottom = async () => Number(await piece.getAttribute('y')) + Number(await piece.getAttribute('height'))
  expect(await bottom()).toBe(114) // desde arriba no cae
  await view.getByRole('button', { name: 'Gravedad' }).click()
  await expect(view.getByRole('button', { name: 'Gravedad' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(bottom).toBe(285) // sobre la banda de la cinta (300 − 15)
  await page.getByRole('region', { name: 'Panel de control' }).locator('[aria-label="Interruptor Marcha"]').click()
  await expect(view.locator('[aria-label^="Recogida"]')).toContainText('1', { timeout: 8000 })
  await expect(piece).toHaveCount(0)
  expectNoErrors(errors)
})

test('planta: «Tope / pared» en la paleta, con su explicación', async ({ page }) => {
  const errors = await openEditor(page, 'escena-gravedad.json')
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('radio', { name: /Editar/ }).click()
  const palette = view.getByRole('navigation', { name: 'Elementos' })
  await palette.getByRole('button', { name: '+ Tope / pared' }).hover()
  await expect(page.getByRole('tooltip', { name: 'Vista previa: Tope / pared' })).toContainText('medio recorrido')
  await palette.getByRole('button', { name: '+ Tope / pared' }).click()
  await expect(view.locator('[aria-label="Plataforma Tope"]')).toHaveCount(1)
  expectNoErrors(errors)
})

test('esquema eléctrico: inversión de giro (plantilla), con su enclavamiento', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  await view.getByLabel('Insertar montaje').selectOption('inversion')
  await view.getByRole('button', { name: 'Pantalla completa' }).click()
  await page.getByRole('button', { name: /Simular/ }).click()
  const hold = async (tag) => {
    const b = await view.locator(`[data-elec="pushbutton"][data-tag="${tag}"]`).boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(250)
    await page.mouse.up()
  }
  const motor = view.locator('[data-elec="motor3"]')
  await expect(motor).toHaveAttribute('data-on', '0')
  await hold('S1')
  await expect(motor).toHaveAttribute('data-on', '1')
  await expect(motor).toContainText('↻')
  await hold('S2') // enclavado: no entra KM2 ni hay cortocircuito
  await expect(view.locator('[data-elec="coil"][data-tag="KM2"]')).toHaveAttribute('data-on', '0')
  await expect(view.getByText(/Cortocircuito/)).toHaveCount(0)
  await hold('S0')
  await hold('S2')
  await expect(motor).toContainText('↺')
  expectNoErrors(errors)
})

test('esquema eléctrico: cablear un piloto entre L y N, simular y deshacer', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  const paper = view.locator('.paper')
  const drop = (name, x, y) => view.getByRole('button', { name, exact: true }).dragTo(paper, { targetPosition: { x, y } })
  await drop('+ Embarrado L', 100, 80)
  await drop('+ Piloto', 160, 180)
  await drop('+ Embarrado N', 100, 380)
  const lamp = view.locator('[data-elec="lamp"]')
  await expect(lamp).toHaveCount(1)
  // Cables: arrastrar de borne a borne (de la toma del embarrado que queda encima del piloto).
  const center = async (loc) => {
    const b = await loc.boundingBox()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  const wire = async (from, to) => {
    const a = await center(from)
    const b = await center(to)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 8 })
    await page.mouse.up()
  }
  const x1 = lamp.locator('.react-flow__handle[data-handleid="X1"]')
  const x2 = lamp.locator('.react-flow__handle[data-handleid="X2"]')
  const nearest = async (rail, target) => {
    const t = await center(target)
    const handles = view.locator(`[data-elec="rail"]`).nth(rail).locator('.react-flow__handle')
    const n = await handles.count()
    let best = 0
    let dist = Infinity
    for (let i = 0; i < n; i++) {
      const c = await center(handles.nth(i))
      if (Math.abs(c.x - t.x) < dist) {
        dist = Math.abs(c.x - t.x)
        best = i
      }
    }
    return handles.nth(best)
  }
  await wire(await nearest(0, x1), x1)
  await wire(x2, await nearest(1, x2))
  await expect(view.locator('.react-flow__edge')).toHaveCount(2)
  await page.getByRole('button', { name: /Simular/ }).click()
  await expect(lamp).toHaveAttribute('data-on', '1')
  await page.getByRole('button', { name: /Detener/ }).click()
  // Deshacer (el de siempre, en la barra): quita el último cable; al simular, el piloto ya no luce.
  await view.getByText(/Arrastra de borne a borne/).click() // el esquema es el último panel tocado
  await page.getByTitle('Deshacer (Ctrl+Z)').click()
  await expect(view.locator('.react-flow__edge')).toHaveCount(1)
  await page.getByRole('button', { name: /Simular/ }).click()
  await expect(lamp).toHaveAttribute('data-on', '0')
  expectNoErrors(errors)
})

test('esquema eléctrico: conexiones del autómata desde la tabla, conectadas con la planta', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Marcha y paro/)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  // El ejemplo ya trae su esquema: no se duplica el autómata. Se borra y se vuelve a crear.
  await view.getByRole('button', { name: 'Conexiones del autómata' }).click()
  await expect(view.getByRole('status')).toContainText('ya tiene su autómata')
  await expect(view.locator('[data-elec="plc"]')).toHaveCount(1)
  await view.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  await expect(view.locator('.react-flow__node')).toHaveCount(0)
  await view.getByRole('button', { name: 'Conexiones del autómata' }).click()
  await expect(view.getByRole('status')).toContainText('conectadas con el autómata y la planta')
  await expect(view.getByLabel('Conectar con el autómata y la planta')).toBeChecked()
  await page.getByRole('button', { name: /Simular/ }).click()
  const desk = page.getByRole('region', { name: 'Panel de control' })
  const b = await desk.locator('[aria-label="Pulsador Marcha"]').boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
  await page.mouse.down()
  await page.waitForTimeout(300)
  await page.mouse.up()
  // Marcha llega por el cable a I0.0, el grafcet activa Motor (Q0.0) y su bobina se excita.
  await expect(view.locator('[data-elec="coil"]')).toHaveAttribute('data-on', '1')
  await expect.poll(() => activeSteps(page)).toBe('s1')
  // Sin conectar, la planta y el autómata ya no usan los cables (el grafcet sigue con la planta).
  await view.getByRole('radio', { name: /Editar/ }).click()
  await view.getByLabel('Conectar con el autómata y la planta').uncheck()
  await expect(view.getByText(/no usan estos cables/)).toBeVisible()
  expectNoErrors(errors)
})

test('esquema eléctrico: vista previa en la paleta, separador redimensionable y zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 850 })
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  // Vista previa: el símbolo, para qué sirve y su referencia.
  await view.getByRole('button', { name: '+ Contactor (bobina)' }).hover()
  const tip = page.getByRole('tooltip', { name: 'Vista previa: Contactor (bobina)' })
  await expect(tip).toContainText('A1-A2')
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/elec-preview.png` })
  await page.mouse.move(5, 5)
  await expect(tip).toHaveCount(0)
  // Separador: más ancho al arrastrarlo a la izquierda; se recuerda; doble clic, mitad y mitad.
  const width = async () => (await view.boundingBox()).width
  const before = await width()
  const sep = await view.getByRole('separator', { name: 'Ancho del esquema' }).boundingBox()
  await page.mouse.move(sep.x + sep.width / 2, sep.y + 200)
  await page.mouse.down()
  await page.mouse.move(sep.x - 200, sep.y + 200, { steps: 5 })
  await page.mouse.up()
  await expect.poll(width).toBeGreaterThan(before + 50) // con su límite: el grafcet conserva sitio
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click() // cerrar y abrir: mismo ancho
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  await expect.poll(width).toBeGreaterThan(before + 50) // con su límite: el grafcet conserva sitio
  await view.getByRole('separator', { name: 'Ancho del esquema' }).dblclick()
  await expect.poll(width).toBeLessThan(before + 20)
  // Zoom con sus botones y el porcentaje.
  await view.getByRole('button', { name: 'Acercar' }).click()
  await expect(view.getByText(/^\d+ %$/)).not.toHaveText('100 %')
  expectNoErrors(errors)
})

test('esquema eléctrico: vivienda (conmutada) y botón de prueba del diferencial', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  await view.getByLabel('Insertar montaje').selectOption('conmutada')
  await view.getByRole('button', { name: 'Pantalla completa' }).click()
  await page.getByRole('button', { name: /Simular/ }).click()
  const lamp = view.locator('[data-elec="lamp"][data-tag="E1"]')
  await expect(lamp).toHaveAttribute('data-on', /^[01]$/) // ya simulando
  const before = await lamp.getAttribute('data-on')
  await view.locator('[data-elec="changeover"][data-tag="S1"]').click()
  await expect(lamp).not.toHaveAttribute('data-on', before)
  await view.locator('[data-elec="changeover"][data-tag="S2"]').click()
  await expect(lamp).toHaveAttribute('data-on', before)
  if (before === '0') await view.locator('[data-elec="changeover"][data-tag="S1"]').click()
  await expect(lamp).toHaveAttribute('data-on', '1')
  // Botón T: salta el diferencial y la lámpara se apaga; un clic en él lo rearma.
  await view.getByRole('button', { name: 'Probar -Q1' }).click()
  await expect(lamp).toHaveAttribute('data-on', '0')
  await expect(view.locator('[data-elec="rcd"]')).toContainText('Disparado')
  await view.locator('[data-elec="rcd"]').click({ position: { x: 10, y: 10 } })
  await expect(lamp).toHaveAttribute('data-on', '1')
  expectNoErrors(errors)
})

test('esquema eléctrico: electroneumática (5/2 monoestable, cilindro, regulador y detector a1)', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  await view.getByLabel('Insertar montaje').selectOption('electroneumatica')
  await view.getByRole('button', { name: 'Pantalla completa' }).click()
  await expect(view.locator('[data-elec="pvalve"]')).toContainText('1V1')
  await page.getByRole('button', { name: /Simular/ }).click()
  const cylinder = view.locator('[data-elec="pcylinder"][data-tag="A"]')
  await expect(cylinder).toHaveAttribute('data-pos', '0')
  const s1 = await view.locator('[data-elec="pushbutton"][data-tag="S1"]').boundingBox()
  await page.mouse.move(s1.x + s1.width / 2, s1.y + s1.height / 2)
  await page.mouse.down()
  await expect(view.locator('[data-elec="pvalve"]')).toHaveAttribute('data-on', '1')
  await expect(cylinder).toHaveAttribute('data-pos', '100', { timeout: 8000 })
  await expect(view.locator('[data-elec="lamp"][data-tag="H1"]')).toHaveAttribute('data-on', '1')
  await page.mouse.up()
  await expect(cylinder).toHaveAttribute('data-pos', '0', { timeout: 8000 })
  await expect(view.locator('[data-elec="lamp"][data-tag="H1"]')).toHaveAttribute('data-on', '0')
  expectNoErrors(errors)
})

test('esquema eléctrico: parada de emergencia con relé de seguridad (rearme, seta y puerta)', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  await view.getByLabel('Insertar montaje').selectOption('seguridad')
  await view.getByRole('button', { name: 'Pantalla completa' }).click()
  await page.getByRole('button', { name: /Simular/ }).click()
  const km1 = view.locator('[data-elec="coil"][data-tag="KM1"]')
  const hold = async (tag) => {
    const b = await view.locator(`[data-elec="pushbutton"][data-tag="${tag}"]`).boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(200)
    await page.mouse.up()
  }
  await expect(km1).toHaveAttribute('data-on', '0')
  await hold('S2') // rearme
  await expect(km1).toHaveAttribute('data-on', '1')
  await view.locator('[data-elec="emergency"]').click() // seta
  await expect(km1).toHaveAttribute('data-on', '0')
  await view.locator('[data-elec="emergency"]').click() // se desenclava: no arranca solo
  await page.waitForTimeout(300)
  await expect(km1).toHaveAttribute('data-on', '0')
  await hold('S2')
  await expect(km1).toHaveAttribute('data-on', '1')
  await view.locator('[data-elec="doorswitch"]').click() // se abre la puerta
  await expect(km1).toHaveAttribute('data-on', '0')
  expectNoErrors(errors)
})

test('esquema eléctrico: marco, hojas y exportar la hoja (vista previa y SVG)', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  await view.getByLabel('Insertar montaje').selectOption('directo')
  await view.getByLabel('Marco').check()
  await expect(view.locator('.react-flow__node-elecframe')).toHaveCount(1)
  // Segunda hoja con otro montaje: sus identificadores no se repiten (KM2).
  await view.getByRole('button', { name: 'Añadir hoja' }).click()
  await view.getByLabel('Insertar montaje').selectOption('marcha-paro')
  await expect(view.locator('[data-elec="coil"]')).toHaveAttribute('data-tag', 'KM2')
  await view.getByRole('tab', { name: 'Hoja 1' }).click()
  await expect(view.locator('[data-elec="coil"]')).toHaveAttribute('data-tag', 'KM1')
  // Exportar: diálogo con vista previa; SVG con el nombre del proyecto y «esquema».
  await view.getByRole('button', { name: 'Exportar el esquema' }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar' })
  await expect(dialog).toBeVisible()
  const file = await saveFromDialog(page, 'svg')
  expect(file.suggestedFilename()).toMatch(/esquema\.svg$/)
  expectNoErrors(errors)
})

test('esquema eléctrico: polímetro y averías (contacto quemado; avería oculta)', async ({ page }) => {
  const errors = await openEditor(page)
  await page.getByRole('button', { name: 'Esquema eléctrico' }).click()
  const view = page.getByRole('region', { name: 'Esquema eléctrico' })
  await view.getByLabel('Insertar montaje').selectOption('marcha-paro')
  await view.getByRole('button', { name: 'Pantalla completa' }).click()
  await page.getByRole('button', { name: /Simular/ }).click()
  const km1 = view.locator('[data-elec="coil"][data-tag="KM1"]')
  const hold = async (tag) => {
    const b = await view.locator(`[data-elec="pushbutton"][data-tag="${tag}"]`).boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(200)
    await page.mouse.up()
  }
  // Polímetro en la bobina parada: 0 V; en marcha: 230 V~.
  await view.getByRole('button', { name: 'Polímetro' }).click()
  await km1.locator('.react-flow__handle[data-handleid="A1"]').click()
  await km1.locator('.react-flow__handle[data-handleid="A2"]').click()
  const reading = view.getByLabel('Lectura del polímetro')
  await expect(reading).toContainText('0 V')
  await view.getByRole('button', { name: 'Polímetro' }).click() // sin herramienta, para pulsar
  await hold('S1')
  await expect(km1).toHaveAttribute('data-on', '1')
  await view.getByRole('button', { name: 'Polímetro' }).click()
  await km1.locator('.react-flow__handle[data-handleid="A1"]').click()
  await km1.locator('.react-flow__handle[data-handleid="A2"]').click()
  await expect(reading).toContainText('230 V~')
  await view.getByRole('button', { name: 'Polímetro' }).click()
  await hold('S0')
  // Avería: el pulsador de marcha quemado; ya no arranca.
  await view.getByRole('button', { name: 'Averías' }).click()
  await view.locator('[data-elec="pushbutton"][data-tag="S1"]').click()
  await page.getByRole('menuitem', { name: 'Contacto quemado (no cierra)' }).click()
  await expect(view.locator('[data-elec="pushbutton"][data-tag="S1"]')).toContainText('Avería: quemado')
  await view.getByRole('button', { name: 'Averías' }).click()
  await hold('S1')
  await page.waitForTimeout(200)
  await expect(km1).toHaveAttribute('data-on', '0')
  // Avería al azar, oculta; se puede mostrar y reparar.
  await view.getByRole('button', { name: 'Averías' }).click()
  await view.getByRole('button', { name: 'Avería al azar (oculta)' }).click()
  await expect(view.getByText('Hay una avería oculta')).toBeVisible()
  await view.getByRole('button', { name: 'Mostrar la avería' }).click()
  await expect(view.getByText('Hay una avería oculta')).toHaveCount(0)
  await view.getByRole('button', { name: 'Reparar todo' }).click()
  await expect(view.getByText(/Avería: /)).toHaveCount(0)
  expectNoErrors(errors)
})

// Potenciómetro del panel de control: ajuste fino con la rueda (1 %, con Mayús 0,1 %) y con las
// flechas del teclado; la rueda sobre él no hace zoom en la planta.
test('potenciómetro: ajuste fino con la rueda y el teclado', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Horno con consigna/)
  await page.getByRole('button', { name: /Simular/ }).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  const knob = view.getByRole('region', { name: 'Panel de control' }).getByRole('slider', { name: /Consigna/ })
  await expect(knob).toHaveAttribute('aria-valuenow', '50')
  await knob.hover()
  await page.waitForTimeout(300) // la planta se ajusta sola al abrirse
  const zoom = await view.getByText(/^\d+ %$/).first().textContent()
  await page.mouse.wheel(0, -100) // hacia arriba: +1 %
  await page.mouse.wheel(0, -100)
  await expect(knob).toHaveAttribute('aria-valuenow', '52')
  await page.keyboard.down('Shift')
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 100) // −0,1 % cada una
  await page.keyboard.up('Shift')
  await expect(knob).toHaveAttribute('aria-valuenow', '51')
  await expect(view.getByText(/^\d+ %$/).first()).toHaveText(zoom) // sin zoom
  await knob.focus()
  await page.keyboard.press('ArrowDown')
  await expect(knob).toHaveAttribute('aria-valuenow', '50')
  await page.keyboard.press('End')
  await expect(knob).toHaveAttribute('aria-valuenow', '100')
  expectNoErrors(errors)
})
