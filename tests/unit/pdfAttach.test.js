import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { attachFile, attachmentsOf, isPdf } from '../../src/lib/pdfAttach'

const pdfBytes = () => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.text('Hoja de prácticas', 20, 20)
  return new Uint8Array(pdf.output('arraybuffer'))
}

describe('adjuntos en un PDF', () => {
  it('adjuntar y volver a leer (con acentos y paréntesis en el contenido)', () => {
    const json = JSON.stringify({ name: 'Ejercicio (1) — señal', nodes: [] })
    const data = new TextEncoder().encode(json)
    const out = attachFile(pdfBytes(), { name: 'ejercicio.json', data, mime: 'application/json', description: 'Ejercicio' })
    expect(isPdf(out)).toBe(true)
    const found = attachmentsOf(out)
    expect(found.map((f) => f.name)).toEqual(['ejercicio.json'])
    expect(new TextDecoder().decode(found[0].data)).toBe(json)
  })

  it('el PDF sigue siendo válido: xref nuevo que apunta al anterior y catálogo con los adjuntos', () => {
    const original = pdfBytes()
    const out = attachFile(original, { name: 'a.json', data: new Uint8Array([1, 2, 3]) })
    const text = new TextDecoder('latin1').decode(out)
    // Lo original queda intacto al principio.
    expect(out.subarray(0, original.length)).toEqual(original)
    const prev = Number(text.slice(0, original.length).match(/startxref\s+(\d+)/g).at(-1).match(/\d+/)[0])
    expect(text).toMatch(new RegExp(`/Prev ${prev} >>`))
    // Cada entrada de la xref nueva apunta exactamente al principio de su objeto.
    const lines = text.slice(text.lastIndexOf('\nxref\n') + 1).split('\n')
    let checked = 0
    lines.forEach((line, at) => {
      const [, first, count] = line.match(/^(\d+) (\d+)$/) ?? []
      if (!first) return
      for (let k = 0; k < Number(count); k++) {
        const entry = lines[at + 1 + k]
        if (entry.includes(' f')) continue // entrada libre (la 0)
        expect(text.slice(Number(entry.slice(0, 10))).startsWith(`${Number(first) + k} 0 obj`)).toBe(true)
        checked++
      }
    })
    expect(checked).toBe(3) // archivo, ficha y catálogo
    expect(text.slice(Number(text.match(/startxref\n(\d+)\n%%EOF\n$/)[1])).startsWith('xref')).toBe(true)
    expect(text).toMatch(/\/Names << \/EmbeddedFiles << \/Names \[\(a\.json\)/)
  })

  it('un PDF sin adjuntos no tiene ninguno', () => {
    expect(attachmentsOf(pdfBytes())).toEqual([])
    expect(isPdf(new TextEncoder().encode('{"nodes":[]}'))).toBe(false)
  })
})

describe('varios adjuntos', () => {
  it('se leen todos, con su contenido, y el árbol de nombres va en orden', async () => {
    const { attachFiles } = await import('../../src/lib/pdfAttach')
    const enc = (s) => new TextEncoder().encode(s)
    const out = attachFiles(pdfBytes(), [
      { name: '2-b.json', data: enc('{"b":2}') },
      { name: '1-a.json', data: enc('{"a":1}') },
    ])
    const found = attachmentsOf(out)
    expect(found.map((f) => [f.name, new TextDecoder().decode(f.data)]).sort()).toEqual([
      ['1-a.json', '{"a":1}'],
      ['2-b.json', '{"b":2}'],
    ])
    expect(new TextDecoder('latin1').decode(out)).toMatch(/\/Names \[\(1-a\.json\) \d+ 0 R \(2-b\.json\) \d+ 0 R\]/)
  })
})
