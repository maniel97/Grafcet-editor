import { describe, expect, test } from 'vitest'
import { parseBlocks } from '../../src/help/Markdown'
import { ARTICLES, SECTIONS, articleSource, articleTitle } from '../../src/help'
import { EXAMPLES } from '../../src/lib/examples'
import { TUTORIALS, tutorialById } from '../../src/lib/tutorials'
import { evaluate, parseCondition } from '../../src/lib/sim/expression'

describe('visor de la wiki', () => {
  test('bloques', () => {
    const blocks = parseBlocks(
      ['# Título', '', 'Un párrafo', 'en dos líneas.', '- uno', '- dos', '1. a', '2. b', '> **Ojo:** nota', '| A | B |', '|---|---|', '| `x` | y |', '```ejemplo taladradora', 'Texto', '```'].join('\n'),
    )
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'olist', 'note', 'table', 'fence'])
    expect(blocks[1].text).toBe('Un párrafo en dos líneas.')
    expect(blocks[2].items).toEqual(['uno', 'dos'])
    expect(blocks[5]).toMatchObject({ head: ['A', 'B'], rows: [['`x`', 'y']] })
    expect(blocks[6]).toMatchObject({ lang: 'ejemplo', arg: 'taladradora', text: 'Texto' })
  })
})

describe('artículos', () => {
  test('todos los del índice existen en español y tienen título', () => {
    const listed = SECTIONS.flatMap((s) => s.articles)
    expect(ARTICLES).toEqual(listed)
    for (const id of ARTICLES) expect(articleTitle(id, 'es')).not.toBe(id)
  })

  test('enlaces, ejemplos y tutoriales apuntan a algo que existe', () => {
    for (const id of ARTICLES) {
      const source = articleSource(id, 'es')
      for (const [, target] of source.matchAll(/\]\(([^)]+)\)/g)) {
        if (!/^https?:/.test(target)) expect(ARTICLES, `${id} → ${target}`).toContain(target)
      }
      for (const block of parseBlocks(source).filter((b) => b.type === 'fence')) {
        if (block.lang === 'ejemplo') expect(EXAMPLES.some((ex) => ex.id === block.arg), `${id} → ejemplo ${block.arg}`).toBe(true)
        if (block.lang === 'tutorial') expect(tutorialById(block.arg), `${id} → tutorial ${block.arg}`).not.toBeNull()
      }
    }
  })

  test('las receptividades de ejemplo de los artículos se interpretan', () => {
    for (const text of ['a · b', 'a*b', 'a + b', '!a', '↑a', '↓a', 'X2', '5s/X2', '[C >= 3]', '1', '3s/a', '3s/a/2s', '0s/a/2s', '!5s/X4', 'X2 · b']) {
      expect(() => parseCondition(text), text).not.toThrow()
    }
    // «!5s/X4»: los 5 primeros segundos de la etapa 4.
    const at = (seconds) => evaluate(parseCondition('!5s/X4'), { value: () => 0, step: (n) => String(n) === '4', elapsed: () => seconds })
    expect([at(1), at(4.9), at(5), at(8)]).toEqual([1, 1, 0, 0])
  })
})

describe('tutoriales', () => {
  test('pasos completos y sin ids repetidos', () => {
    expect(new Set(TUTORIALS.map((tut) => tut.id)).size).toBe(TUTORIALS.length)
    for (const tut of TUTORIALS) {
      expect(tut.title && tut.description && tut.steps.length).toBeTruthy()
      for (const step of tut.steps) expect(step.title && step.text, `${tut.id}: ${step.title}`).toBeTruthy()
    }
  })
})

describe('ayuda contextual', () => {
  test('cada tema de Verificar (validation.js, tips.js) es un artículo de la wiki', async () => {
    const { readFileSync } = await import('fs')
    const topics = new Set()
    for (const file of ['src/lib/validation.js', 'src/lib/tips.js']) {
      const source = readFileSync(file, 'utf-8')
      for (const [, id] of source.matchAll(/topic = '([\w-]+)'/g)) topics.add(id)
      for (const [, id] of source.matchAll(/^\s+'([\w-]+)',\n\s+\)/gm)) topics.add(id)
    }
    expect(topics.size).toBeGreaterThan(8)
    for (const id of topics) expect(ARTICLES, id).toContain(id)
  })
})
