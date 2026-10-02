import { test } from '@playwright/test'

// Medición de rendimiento al arrastrar en un diagrama grande (npm run test:perf).
// No es una prueba de aprobado/suspenso: informa de los tiempos para comparar antes y después
// de un cambio. Peor caso: tabla de variables en el lienzo y panel Verificar abierto.

const STEPS = Number(process.env.PERF_STEPS ?? 120)

function bigProject() {
  const nodes = []
  const edges = []
  const link = (source, target) => edges.push({ id: `${source}-${target}`, source, target })
  for (let i = 0; i < STEPS; i++) {
    const y = i * 170
    nodes.push({
      id: `s${i}`,
      type: 'step',
      position: { x: 200, y },
      data: { label: String(i), initial: i === 0, actions: i % 2 ? [`Salida${i % 10}`, { text: `C${i % 5}:=C${i % 5}+1`, kind: 'stored-on' }] : [] },
    })
    nodes.push({ id: `t${i}`, type: 'transition', position: { x: 200, y: y + 100 }, data: { condition: i % 3 ? `Entrada${i % 12} · !Paro` : `2s/X${i}` } })
    link(`s${i}`, `t${i}`)
    if (i + 1 < STEPS) link(`t${i}`, `s${i + 1}`)
  }
  link(`t${STEPS - 1}`, 's0') // bucle grande
  nodes.push({ id: 'variables-table', type: 'variables', position: { x: 900, y: 0 }, data: { showComments: true }, deletable: false })
  // Vista guardada en el proyecto: etapa 4 (x 200, y 680) centrada a zoom 2.
  const viewport = { x: 600 - 228 * 2, y: 450 - 708 * 2, zoom: 2 }
  return { format: 'grafcet-editor', version: 1, nodes, edges, viewport }
}

test(`arrastrar una etapa en un grafcet de ${STEPS} etapas`, async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.waitForSelector('.react-flow__node')
  await page.locator('input[type=file]').setInputFiles({
    name: 'grande.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bigProject())),
  })
  await page.waitForSelector('.react-flow__node[data-id="s59"]', { state: 'attached' })
  await page.getByTitle('Verificar conformidad con IEC 60848').click()
  await page.waitForTimeout(600)

  await page.evaluate(() => {
    window.__long = []
    new PerformanceObserver((list) => window.__long.push(...list.getEntries().map((e) => e.duration))).observe({ type: 'longtask', buffered: false })
  })

  // Tiempo de CPU del navegador (JavaScript, estilos, maquetación) desde las métricas de Chromium.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const cpu = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics')
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]))
    return { script: m.ScriptDuration, task: m.TaskDuration, layout: m.LayoutDuration, style: m.RecalcStyleDuration }
  }

  const runs = []
  for (let run = 0; run < 3; run++) {
    const box = await page.locator('.react-flow__node[data-id="s4"]').boundingBox()
    const dir = run % 2 ? -1 : 1 // ida y vuelta
    const before = await page.locator('.react-flow__node[data-id="s4"]').evaluate((el) => el.style.transform)
    await page.evaluate(() => (window.__long = []))
    const c0 = await cpu()
    const t0 = Date.now()
    await page.mouse.move(box.x + 28, box.y + 28)
    await page.mouse.down()
    await page.mouse.move(box.x + 28 + 120 * dir, box.y + 28 + 40 * dir, { steps: 60 })
    await page.mouse.up()
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const ms = Date.now() - t0
    const after = await page.locator('.react-flow__node[data-id="s4"]').evaluate((el) => el.style.transform)
    if (before === after) throw new Error(`La etapa no se ha movido (${before}): el arrastre no se ha producido`)
    const c1 = await cpu()
    const long = await page.evaluate(() => window.__long)
    const d = (k) => Math.round((c1[k] - c0[k]) * 1000)
    runs.push({ ms, task: d('task'), script: d('script'), layout: d('layout') + d('style'), longTotal: Math.round(long.reduce((a, b) => a + b, 0)), longCount: long.length })
    await page.waitForTimeout(300)
  }
  const zoom = await page.evaluate(() => document.querySelector('.react-flow__viewport').style.transform)
  console.log(`  (vista: ${zoom})`)
  runs.sort((a, b) => a.task - b.task)
  const median = runs[1]
  console.log(
    `\nRENDIMIENTO arrastre (60 movimientos, ${STEPS} etapas): CPU ${median.task} ms (${(median.task / 60).toFixed(1)} ms/movimiento: ` +
      `JS ${median.script} ms, estilos+maquetación ${median.layout} ms); total ${median.ms} ms; tareas largas ${median.longCount} (${median.longTotal} ms)`,
  )
  console.log(`  ejecuciones (CPU): ${runs.map((r) => `${r.task} ms`).join(' · ')}`)
})
