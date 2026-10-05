// Textos de la interfaz para traducir (lib/i18n.js).
//
//   npm run i18n           -> extrae los textos del código y pone al día los catálogos:
//                             src/locales/es.json (el origen) y, en cada idioma, añade lo que falta
//                             (vacío: sin traducir) y quita lo que ya no se usa.
//   npm run i18n -- --check -> solo comprueba (sale con error si algo no está al día).
//
// Se extrae el primer argumento literal de t('…'), tr('…') (t con otro nombre, donde «t» ya es una
// variable local) y N_('…') (N_ marca un texto que se
// traduce más tarde, p. ej. las etiquetas de un menú). Las partes variables van con nombre:
// t('Mover a {hoja}', { hoja }). Guía para traducir: src/locales/LEEME.md.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
export const LOCALES = join(SRC, 'locales')
export const SOURCE = 'es'

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'locales' ? [] : files(path)
    return /\.(jsx?|mjs)$/.test(name) ? [path] : []
  })
}

// Literal de cadena JS (comillas simples, dobles o acento grave sin ${}) -> su texto.
const LITERAL = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\`(?:[^\`\\$]|\\.|\$(?!\{))*\``
// (tr: el nombre de t donde «t» ya es una variable local, p. ej. una transición.)
const CALL = new RegExp(String.raw`(?<![\w.$])(?:t|tr|N_)\(\s*(${LITERAL})`, 'g')
const DYNAMIC = /(?<![\w.$])(?:t|tr|N_)\(\s*`[^`]*\$\{/g

const unquote = (lit) => {
  const body = lit.slice(1, -1)
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)/g, (_, e) =>
    e[0] === 'u' ? String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16)) : ({ n: '\n', t: '\t' })[e] ?? e,
  )
}

// Variable local llamada «t» en un archivo que importa t (taparía la función: t('…') fallaría al
// ejecutarse aunque compile). Parámetros (t) / (t, …), const / let t y for (const t of …).
const IMPORTS_T = /import \{[^}]*\bt\b(?!\s+as\b)[^}]*\} from '[^']*i18n'/
const LOCAL_T = /\(\s*t\s*[,)]|\b(?:const|let|var)\s+t\s*=|for\s*\(\s*(?:const|let)\s+t\s+of\b/g

// { keys: Set, dynamic: ['archivo:línea'], shadowed: ['archivo:línea'] }
export function extract() {
  const keys = new Set()
  const dynamic = []
  const shadowed = []
  for (const file of files(SRC)) {
    const text = readFileSync(file, 'utf8')
    const where = (index) => `${relative(ROOT, file)}:${text.slice(0, index).split('\n').length}`
    for (const m of text.matchAll(CALL)) keys.add(unquote(m[1]))
    for (const m of text.matchAll(DYNAMIC)) dynamic.push(where(m.index))
    if (IMPORTS_T.test(text)) for (const m of text.matchAll(LOCAL_T)) shadowed.push(where(m.index))
  }
  return { keys, dynamic, shadowed }
}

export const placeholders = (text) => [...String(text).matchAll(/\{([\p{L}\p{N}_]+)\}/gu)].map((m) => m[1]).sort()
export const sorted = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b, 'es')))
const read = (file) => JSON.parse(readFileSync(join(LOCALES, file), 'utf8'))
const write = (file, obj) => writeFileSync(join(LOCALES, file), `${JSON.stringify(sorted(obj), null, 2)}\n`)
export const languages = () => readdirSync(LOCALES).filter((f) => /^[a-z]{2}(-[A-Z]{2})?\.json$/.test(f) && f !== `${SOURCE}.json`)

// Problemas de los catálogos: { stale, missing: { lang: [...] }, extra, badPlaceholders, dynamic, shadowed }.
export function audit() {
  const { keys, dynamic, shadowed } = extract()
  const source = read(`${SOURCE}.json`)
  const stale = [...keys].filter((k) => !(k in source)).concat(Object.keys(source).filter((k) => !keys.has(k)))
  const missing = {}
  const extra = {}
  const badPlaceholders = []
  for (const file of languages()) {
    const dict = read(file)
    missing[file] = [...keys].filter((k) => !(k in dict))
    extra[file] = Object.keys(dict).filter((k) => !keys.has(k))
    for (const [k, v] of Object.entries(dict)) if (v && placeholders(k).join() !== placeholders(v).join()) badPlaceholders.push(`${file}: «${k}» -> «${v}»`)
  }
  return { keys, stale, missing, extra, badPlaceholders, dynamic, shadowed }
}

// Pone al día los catálogos.
export function update() {
  const { keys } = extract()
  write(`${SOURCE}.json`, Object.fromEntries([...keys].map((k) => [k, k])))
  for (const file of languages()) {
    const dict = read(file)
    write(file, Object.fromEntries([...keys].map((k) => [k, dict[k] ?? ''])))
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!process.argv.includes('--check')) update()
  const a = audit()
  const untranslated = Object.fromEntries(languages().map((f) => [f, Object.entries(read(f)).filter(([, v]) => !v).length]))
  console.log(`Textos: ${a.keys.size}. Sin traducir: ${Object.entries(untranslated).map(([f, n]) => `${f} ${n}`).join(', ')}`)
  const problems = [
    ...a.stale.map((k) => `Catálogo de origen sin actualizar: «${k}»`),
    ...a.badPlaceholders.map((p) => `Marcadores distintos: ${p}`),
    ...a.dynamic.map((d) => `t() con texto variable (usa marcadores {nombre}): ${d}`),
    ...a.shadowed.map((d) => `Variable local «t» que tapa a t() (renómbrala): ${d}`),
  ]
  for (const p of problems) console.log(p)
  if (process.argv.includes('--check') && problems.length) process.exit(1)
}
