// Comprobación de textos que se pisan en el esquema eléctrico, medida en el navegador: cada línea
// de cada rótulo (y los números de borne) contra los trazos de los demás aparatos, sus rótulos y
// los cables. Devuelve una lista de descripciones (vacía si no se pisa nada).
export async function schematicOverlaps(page, { where = false, label = 'Esquema eléctrico' } = {}) {
  const found = await page.evaluate((label) => {
    const section = document.querySelector(`section[aria-label="${label}"]`)
    const box = (r, d = 0.5) => ({ l: r.left + d, t: r.top + d, r: r.right - d, b: r.bottom - d })
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
    const nodes = [...section.querySelectorAll('.react-flow__node')].filter((n) => !n.classList.contains('react-flow__node-elecframe'))
    const items = nodes.map((n) => {
      const root = n.querySelector('[data-elec]')
      const name = root?.getAttribute('aria-label') ?? n.dataset.id
      const svg = root?.querySelector(':scope > svg')
      const shapes = []
      const texts = []
      if (svg) {
        const els = [...svg.querySelectorAll('line, path, rect, circle, polyline, text')]
        els.forEach((el, i) => {
          if (i === 0 && el.tagName === 'rect') return // zona de clic
          const r = el.getBoundingClientRect()
          if (!r.width && !r.height) return
          ;(el.tagName === 'text' ? texts : shapes).push({ ...box(r), what: el.tagName === 'text' ? `«${el.textContent}»` : 'símbolo', own: false })
        })
      }
      const label = root?.querySelector(':scope > div.pointer-events-none.absolute')
      if (label) {
        for (const d of label.querySelectorAll(':scope > div')) {
          const range = document.createRange()
          range.selectNodeContents(d)
          for (const r of range.getClientRects()) if (r.width > 0) texts.push({ ...box(r), what: `«${d.textContent}»`, label: true })
        }
      }
      return { name, shapes, texts }
    })
    // Puntos de los cables, cada 3 px (en pantalla).
    const wires = [...section.querySelectorAll('.react-flow__edge-path')].map((p) => {
      const len = p.getTotalLength()
      const m = p.getScreenCTM()
      const pts = []
      for (let s = 0; s <= len; s += 3) {
        const pt = p.getPointAtLength(s)
        pts.push({ x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f })
      }
      const end = p.getPointAtLength(len)
      pts.push({ x: m.a * end.x + m.c * end.y + m.e, y: m.b * end.x + m.d * end.y + m.f })
      return { id: p.closest('.react-flow__edge')?.dataset.id ?? '', pts, scale: Math.hypot(m.a, m.b) }
    })
    const wirePoints = wires.flatMap((w) => w.pts)
    const out = []
    // Dos cables montados uno encima de otro más de 12 px (salvo si salen del mismo borne: misma red).
    const near = (a, b) => Math.abs(a.x - b.x) < 1.2 && Math.abs(a.y - b.y) < 1.2
    for (let i = 0; i < wires.length; i++) {
      for (let j = i + 1; j < wires.length; j++) {
        const A = wires[i]
        const B = wires[j]
        const ends = (w) => [w.pts[0], w.pts[w.pts.length - 1]]
        if (ends(A).some((e) => ends(B).some((f) => near(e, f)))) continue
        let run = 0
        let best = 0
        for (const p of A.pts) {
          run = B.pts.some((q) => near(p, q)) ? run + 1 : 0
          best = Math.max(best, run)
        }
        if (best * 3 > 12 * A.scale) out.push({ msg: `dos cables se montan: ${A.id} y ${B.id}`, at: { l: A.pts[0].x, t: A.pts[0].y } })
      }
    }
    items.forEach((a, i) => {
      for (const t of a.texts) {
        items.forEach((b, j) => {
          if (i === j) {
            // Dentro de un símbolo, sus textos no se pisan entre sí ni se salen de su caja.
            if (!t.label) {
              const k = b.texts.findIndex((x) => !x.label && x !== t && hit(t, x))
              if (k > b.texts.indexOf(t)) out.push({ msg: `${a.name}: ${t.what} pisa su propio ${b.texts[k].what}`, at: t })
              return
            }
            // El rótulo de un aparato tampoco puede pisar su propio símbolo ni sus números de borne.
            const own = [...b.shapes, ...b.texts.filter((x) => !x.label)].find((x) => hit(t, x))
            if (own) out.push({ msg: `${a.name}: ${t.what} pisa su propio ${own.what}`, at: t })
            return
          }
          const s = b.shapes.find((x) => hit(t, x))
          if (s) out.push({ msg: `${a.name}: ${t.what} pisa el símbolo de ${b.name}`, at: t })
          const u = b.texts.find((x) => hit(t, x))
          if (u && i < j) out.push({ msg: `${a.name}: ${t.what} pisa ${u.what} de ${b.name}`, at: t })
        })
        if (wirePoints.some((p) => p.x > t.l && p.x < t.r && p.y > t.t && p.y < t.b)) out.push({ msg: `${a.name}: ${t.what} lo cruza un cable`, at: t })
      }
    })
    return out
  }, label)
  const seen = new Set()
  const unique = found.filter((f) => !seen.has(f.msg) && seen.add(f.msg))
  return where ? unique : unique.map((f) => f.msg)
}
