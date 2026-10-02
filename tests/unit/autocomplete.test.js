import { describe, expect, it } from 'vitest'
import { closest, currentWord, replaceWord, suggest, typos } from '../../src/lib/autocomplete'

const vocab = [
  { name: 'Marcha', type: 'input' },
  { name: 'Motor_broca', type: 'output' },
  { name: 'Paro', type: 'input' },
  { name: 'Emergencia', type: 'input' },
  { name: 'X2', type: 'step' },
]

describe('autocompletado', () => {
  it('palabra en el cursor (no la unidad de 5s)', () => {
    expect(currentWord('a · Mar', 7)).toEqual({ start: 4, end: 7, word: 'Mar' })
    expect(currentWord('Mar · b', 2)).toEqual({ start: 0, end: 3, word: 'Ma' })
    expect(currentWord('5s', 2)).toBeNull()
    expect(currentWord('a · ', 4)).toBeNull()
  })
  it('sugerencias: primero las que empiezan igual, sin acentos ni mayúsculas', () => {
    expect(suggest(vocab, 'm').map((v) => v.name)).toEqual(['Marcha', 'Motor_broca', 'Emergencia'])
    expect(suggest(vocab, 'x').map((v) => v.name)).toEqual(['X2'])
    expect(suggest(vocab, 'Marcha')).toEqual([]) // ya está escrita
  })
  it('sustituye la palabra completa y deja el cursor detrás', () => {
    expect(replaceWord('Paro · Ma + b', { start: 7, end: 9 }, 'Marcha')).toEqual({ text: 'Paro · Marcha + b', caret: 13 })
  })
  it('erratas', () => {
    expect(closest('Marha', ['Marcha', 'Paro'])).toBe('Marcha')
    expect(closest('Emergenica', ['Emergencia'])).toBe('Emergencia')
    expect(closest('ab', ['a'])).toBeNull() // demasiado corta
    expect(closest('Sensor', ['Marcha'])).toBeNull()
    expect(typos('Marha · !Paro + Nuevo', ['Marcha', 'Paro'])).toEqual([{ word: 'Marha', suggestion: 'Marcha' }])
  })
})
