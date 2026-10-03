// Textos que se pisan en el plano exportado (SVG de lib ElecStatic): se abre el SVG en una página
// aparte y se mide como en el editor (overlaps.js). Cada aparato es un <g transform>; sus textos
// directos son sus rótulos y números de borne; lo demás, su símbolo. Los cables, <path> sueltos.
export async function staticOverlaps(browser, svgText) {
  const page = await browser.newPage()
  await page.setContent(`<!doctype html><html><body style="margin:0">${svgText}</body></html>`)
  const out = await page.evaluate(() => {
    const svg = document.querySelector('svg')
    const box = (r, d = 0.5) => ({ l: r.left + d, t: r.top + d, r: r.right - d, b: r.bottom - d })
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
    const groups = [...svg.querySelectorAll(':scope > g[transform]')]
    const items = groups.map((g, i) => {
      const labels = [...g.querySelectorAll(':scope > text')].map((t) => ({ ...box(t.getBoundingClientRect()), what: `«${t.textContent}»` }))
      const symbol = [...g.querySelectorAll(':scope > g line, :scope > g path, :scope > g rect, :scope > g circle, :scope > g polyline, :scope > line, :scope > rect, :scope > circle')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width || r.height)
        .map((r) => ({ ...box(r), what: 'símbolo' }))
      const inner = [...g.querySelectorAll(':scope > g text')].map((t) => ({ ...box(t.getBoundingClientRect()), what: `«${t.textContent}»` }))
      const name = labels[0]?.what ?? inner[0]?.what ?? `aparato ${i}`
      return { name, labels, symbol, inner }
    })
    const points = []
    for (const p of svg.querySelectorAll(':scope > g:not([transform]) > path')) {
      const len = p.getTotalLength()
      const m = p.getScreenCTM()
      for (let s = 0; s <= len; s += 3) {
        const pt = p.getPointAtLength(s)
        points.push({ x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f })
      }
    }
    const found = []
    items.forEach((a, i) => {
      for (const t of a.labels) {
        items.forEach((b, j) => {
          if (i === j) return
          if ([...b.symbol, ...b.inner].some((x) => hit(t, x))) found.push(`${a.name}: ${t.what} pisa el símbolo de ${b.name}`)
          const u = b.labels.find((x) => hit(t, x))
          if (u && i < j) found.push(`${a.name}: ${t.what} pisa ${u.what} de ${b.name}`)
        })
        if (a.inner.some((x) => hit(t, x))) found.push(`${a.name}: ${t.what} pisa un texto de su símbolo`)
        if (points.some((p) => p.x > t.l && p.x < t.r && p.y > t.t && p.y < t.b)) found.push(`${a.name}: ${t.what} lo cruza un cable`)
      }
    })
    return [...new Set(found)]
  })
  await page.close()
  return out
}
