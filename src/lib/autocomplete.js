// Autocompletado de receptividades y acciones (components/AutocompleteInput.jsx).
// Todo puro: qué palabra se está escribiendo, qué sugerir y qué nombre nuevo se parece a uno
// existente («Marha» -> «Marcha»).

import { parseExpression } from './symbols'

// Identificador que termina en el cursor (no pegado a una cifra: en «5s» la «s» es la unidad).
const TAIL = /(?<![\p{L}\p{N}_.])[\p{L}_][\p{L}\p{N}_.]*$/u

export function currentWord(text, caret = text.length) {
  const before = text.slice(0, caret)
  const m = TAIL.exec(before)
  if (!m) return null
  const after = /^[\p{L}\p{N}_.]*/u.exec(text.slice(caret))[0]
  return { start: m.index, end: caret + after.length, word: m[0] }
}

const fold = (t) =>
  String(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Sugerencias para `word`: primero las que empiezan igual, luego las que lo contienen.
// vocabulary: [{ name, type }]. No se sugiere la palabra tal cual ya escrita.
export function suggest(vocabulary, word, max = 8) {
  const w = fold(word)
  if (!w) return []
  const starts = []
  const contains = []
  for (const v of vocabulary) {
    const n = fold(v.name)
    if (n === w && v.name === word) continue
    if (n.startsWith(w)) starts.push(v)
    else if (n.includes(w)) contains.push(v)
  }
  const byName = (a, b) => a.name.localeCompare(b.name, 'es')
  return [...starts.sort(byName), ...contains.sort(byName)].slice(0, max)
}

export function replaceWord(text, at, name) {
  return { text: text.slice(0, at.start) + name + text.slice(at.end), caret: at.start + name.length }
}

// Distancia de edición (Levenshtein), sin distinguir mayúsculas.
export function distance(a, b) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

// Nombre existente muy parecido (erratas): 1 cambio en nombres cortos, 2 en los largos.
export function closest(word, names) {
  if (word.length < 3) return null
  const limit = word.length >= 6 ? 2 : 1
  let best = null
  for (const n of names) {
    if (n === word) return null
    const d = distance(word, n)
    if (d <= limit && (!best || d < best.d)) best = { name: n, d }
  }
  return best?.name ?? null
}

// Nombres de una expresión que no existen en el vocabulario y se parecen a uno que sí:
// [{ word, suggestion }].
export function typos(expression, names) {
  const known = new Set(names)
  return parseExpression(expression)
    .inputs.filter((w) => !known.has(w))
    .map((word) => ({ word, suggestion: closest(word, names) }))
    .filter((t) => t.suggestion)
}
