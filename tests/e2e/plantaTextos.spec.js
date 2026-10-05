import { expect, test } from '@playwright/test'
import { openEditor, openExample } from './helpers'
import { EXAMPLES } from '../../src/lib/examples'

// Nada se pisa en la planta: ningún rótulo sobre el dibujo de otro elemento ni sobre otro rótulo,
// en la planta de cada ejemplo (medido en el navegador). Los rótulos se colocan solos donde hay
// sitio (SceneView.jsx, layoutLabels); esta prueba lo vigila.
test('planta: ningún ejemplo tiene rótulos que se pisen', async ({ page }) => {
  test.setTimeout(240000)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openEditor(page)
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`)
  for (const ex of EXAMPLES) {
    if (!ex.build().plc?.scene?.elements?.length) continue
    await openExample(page, new RegExp(`^${esc(ex.title)}\\s*${esc(ex.description.slice(0, 15))}`))
    await page.getByTitle(/^Simular el grafcet/).click()
    await expect(page.locator('svg[aria-label="Escena"]')).toBeVisible()
    await page.waitForTimeout(300)
    // Con y sin relieve: las caras del volumen cuentan como parte de su elemento.
    for (const relief of [false, true]) {
      if (relief) await page.getByRole('button', { name: 'Relieve' }).click()
    const found = await page.evaluate(() => {
      const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
      const labels = [...document.querySelectorAll('[data-label-of]')]
        .filter((l) => l.textContent.trim())
        .map((l) => ({ id: l.dataset.labelOf, text: l.textContent, r: l.getBoundingClientRect() }))
      const shapes = [...document.querySelectorAll('g[data-element][data-id]')].map((g) => ({
        id: g.dataset.id,
        type: g.dataset.element,
        r: g.querySelector('[data-shape]').getBoundingClientRect(),
      }))
      for (const f of document.querySelectorAll('[data-relief-of]')) shapes.push({ id: f.dataset.reliefOf, type: 'relieve de', r: f.getBoundingClientRect() })
      const issues = []
      for (const l of labels) {
        for (const s of shapes) if (s.id !== l.id && hit(l.r, s.r)) issues.push(`«${l.text}» pisa ${s.type} ${s.id}`)
        for (const o of labels) if (o.id < l.id && hit(l.r, o.r)) issues.push(`«${l.text}» pisa «${o.text}»`)
      }
      return issues
    })
      expect.soft(found, `${ex.id}${relief ? ' (relieve)' : ''}`).toEqual([])
    }
    await page.getByRole('button', { name: 'Relieve' }).click() // se guarda en el proyecto: se deja como estaba
    // Isométrica (solo desde arriba): ningún rótulo sobre otro ni sobre el volumen de otro elemento
    // (salvo los alargados: cintas, mesas, rampas, que tienen el rótulo en el suelo delante).
    if (!ex.build().plc.scene.gravity) {
      await page.getByRole('button', { name: 'Isométrica' }).click()
      const found = await page.evaluate(() => {
        const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
        const long = ['conveyor', 'platform', 'ramp', 'pipe', 'image']
        // Contorno real en la pantalla (getBoundingClientRect de algo girado da el de su caja girada,
        // mucho mayor): los vértices de sus caras, con su matriz.
        const screenBox = (g) => {
          const pts = [...g.querySelectorAll('polygon')].flatMap((poly) => {
            const m = poly.getScreenCTM()
            return [...poly.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(m))
          })
          const xs = pts.map((p) => p.x)
          const ys = pts.map((p) => p.y)
          return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
        }
        const labels = [...document.querySelectorAll('[data-label-of]')]
          .filter((l) => l.textContent.trim())
          .map((l) => ({ id: l.dataset.labelOf, text: l.textContent, r: l.getBoundingClientRect() }))
        const boxes = [...document.querySelectorAll('g[data-element][data-id]')]
          .filter((g) => !long.includes(g.dataset.element))
          .flatMap((g) => [...g.querySelectorAll(':scope > [data-iso-box]')].map((b) => ({ id: g.dataset.id, type: g.dataset.element, r: screenBox(b) })))
        const issues = []
        for (const l of labels) {
          for (const s of boxes) if (s.id !== l.id && hit(l.r, s.r)) issues.push(`«${l.text}» pisa ${s.type} ${s.id}`)
          for (const o of labels) if (o.id < l.id && hit(l.r, o.r)) issues.push(`«${l.text}» pisa «${o.text}»`)
        }
        return issues
      })
      expect.soft(found, `${ex.id} (isométrica)`).toEqual([])
      await page.getByRole('button', { name: 'Isométrica' }).click()
    }
    await page.getByTitle(/^Detener la simulación/).first().click()
  }
})

// «Pantalla completa» ocupa todo el sitio menos el panel de simulación (antes se quedaba en 1 px:
// las clases relative y absolute a la vez).
test('planta: pantalla completa ocupa el ancho', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 })
  await openEditor(page)
  await openExample(page, /^Cargador por gravedad/)
  await page.getByTitle(/^Simular el grafcet/).click()
  await page.getByTitle('Pantalla completa').first().click()
  const width = await page.locator('section[aria-label="Escena de la planta"]').evaluate((el) => el.getBoundingClientRect().width)
  expect(width).toBeGreaterThan(1000)
})

// La isométrica solo cambia el dibujo: en Editar, un elemento se arrastra y sigue al ratón (la
// escena deshace la matriz al convertir el ratón).
test('planta isométrica: con volumen y se edita igual (arrastrar sigue al ratón)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 })
  await openEditor(page)
  await openExample(page, /^Clasificadora por material/)
  await page.getByTitle(/^Simular el grafcet/).click()
  const view = page.getByRole('region', { name: 'Escena de la planta' })
  await view.getByRole('button', { name: 'Isométrica' }).click()
  await expect(view.getByRole('button', { name: 'Isométrica' })).toHaveAttribute('aria-pressed', 'true')
  await expect(view.locator('[data-iso-floor]')).toHaveCount(1)
  await expect(view.locator('g[data-element="conveyor"] [data-iso-box]').first()).toBeVisible()
  await view.getByRole('radio', { name: /Editar/ }).click()
  const sink = view.locator('g[data-element="sink"]').first()
  const shape = sink.locator('[data-shape]')
  const before = await shape.boundingBox()
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 90, before.y + before.height / 2 + 30, { steps: 6 })
  await page.mouse.up()
  const after = await shape.boundingBox()
  // Se ajusta a la cuadrícula de la escena: unos píxeles de margen.
  expect(Math.abs(after.x - before.x - 90)).toBeLessThan(14)
  expect(Math.abs(after.y - before.y - 30)).toBeLessThan(14)
  // Se deja como estaba (se guarda en el proyecto).
  await page.keyboard.press('Control+z')
  await view.getByRole('button', { name: 'Isométrica' }).click()
  await expect(view.locator('[data-iso-floor]')).toHaveCount(0)
})
