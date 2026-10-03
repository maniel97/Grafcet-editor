import { describe, expect, it } from 'vitest'
import { parseNote } from '../../src/lib/notes'

describe('formato ligero de las notas', () => {
  it('títulos, listas, negrita, variables y líneas en blanco', () => {
    const blocks = parseNote('# Clasificadora\n\n- Pulsa **Marcha** (`Marcha`)\n• Otra\nTexto normal')
    expect(blocks.map((b) => b.kind)).toEqual(['title', 'blank', 'item', 'item', 'line'])
    expect(blocks[0].spans).toEqual([{ text: 'Clasificadora' }])
    expect(blocks[2].spans).toEqual([{ text: 'Pulsa ' }, { text: 'Marcha', bold: true }, { text: ' (' }, { text: 'Marcha', code: true }, { text: ')' }])
  })

  it('el texto de siempre se ve igual (sin marcas, una línea por párrafo)', () => {
    expect(parseNote('Hola\nmundo').map((b) => [b.kind, b.spans[0].text])).toEqual([
      ['line', 'Hola'],
      ['line', 'mundo'],
    ])
    expect(parseNote('A+ B+ A- B-')[0].kind).toBe('line') // un «-» suelto no es una lista
    expect(parseNote('5 * 3 ** 2')[0].spans).toEqual([{ text: '5 * 3 ** 2' }])
  })
})
