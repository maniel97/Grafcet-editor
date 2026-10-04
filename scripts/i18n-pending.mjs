// Textos en español que aún no pasan por t() / N_() (para ir pasando la interfaz a lib/i18n.js).
// Uso: node scripts/i18n-pending.mjs src/components/Archivo.jsx […]  -> archivo:línea  texto
// Es una ayuda aproximada: cadenas con palabras en español fuera de t(), y textos JSX junto a {…}.
import { readFileSync } from 'node:fs'

const SPANISH = /[áéíóúñ¿¡]|\b(?:el|la|los|las|de|del|un|una|para|con|sin|que|en|se|no|al|por|y)\s+\p{L}/iu
const STRING = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g
const SKIP_LINE = /^\s*(\/\/|\*|import\s)|console\.|data-testid/
// Las clases (className="…" o {`…`}) no son texto: se quitan antes de buscar en la línea.
const CLASSES = /className=("[^"]*"|\{`[^`]*`\}|\{'[^']*'\})/g

export function pending(file) {
  const out = []
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (SKIP_LINE.test(line)) return
      const code = line.replace(/\/\/.*$/, '').replace(CLASSES, '')
      for (const m of code.matchAll(STRING)) {
        const text = m[1] ?? m[2] ?? m[3]
        const before = code.slice(0, m.index)
        // También una palabra suelta con mayúscula como resultado de un ternario o de un valor por
        // defecto («cond ? 'Pausa' : 'Marcha'», «x || 'Sin título'»).
        const shown = /(?:\?|:|\|\||\?\?)\s*$/.test(before) && /^\p{Lu}\p{Ll}{2,}/u.test(text ?? '')
        if (!text || (!SPANISH.test(text) && !shown) || !/\p{L}{3,}/u.test(text)) continue
        if (/(?:\bt|\btr|\bN_)\(\s*$/.test(before)) continue
        out.push(`${file}:${i + 1}  ${text.slice(0, 90)}`)
      }
      // Texto JSX suelto junto a una expresión: «>{n} elementos<» o «>Hola {x}<».
      const jsx = code.match(/>([^<>]*\{[^<>]*\}[^<>]*)</)
      if (jsx && /(?:^|\})\s*\p{L}{3,}/u.test(jsx[1].replace(/\{[^}]*\}/g, '}')) && !/\{t\(|\{tr\(/.test(jsx[1])) out.push(`${file}:${i + 1}  JSX: ${jsx[1].trim().slice(0, 90)}`)
    })
  return out
}

if (process.argv[1]?.endsWith('i18n-pending.mjs')) {
  const all = process.argv.slice(2).flatMap(pending)
  for (const line of all) console.log(line)
  console.log(`${all.length} pendientes`)
}
