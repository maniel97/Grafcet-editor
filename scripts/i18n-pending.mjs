// Textos en español que aún no pasan por t() / N_() (para ir pasando la interfaz a lib/i18n.js).
// Uso: node scripts/i18n-pending.mjs src/components/Archivo.jsx […]  -> archivo:línea  texto
// Es una ayuda aproximada: cadenas con palabras en español fuera de t(), y textos JSX junto a {…}.
import { readFileSync } from 'node:fs'

const SPANISH = /[áéíóúñ¿¡]|\b(?:el|la|los|las|de|del|un|una|para|con|sin|que|en|se|no|al|por|y)\s+\p{L}/iu
const STRING = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g
// Nombres propios y textos que no se traducen.
const KEEP = /^(Grafcet|STEP|Micro\/WIN|TIA|Brave|Chrome|Edge|Siemens|Arial|Helvetica|Courier|Times|Escape|Enter|Delete|Backspace|Tab|Shift|Control|Meta|Arrow|Home|End|Page|Mozilla|Windows|Linux|Infinity|NaN|GEMMA)/
const SKIP_LINE = /^\s*(\/\/|\*|import\s)|console\.|data-testid/
// Las clases (className="…" o {`…`}) no son texto: se quitan antes de buscar en la línea.
const CLASSES = /className=("[^"]*"|\{`[^`]*`\}|\{'[^']*'\})/g

// Lo que queda de una plantilla `…${x}…` sin sus ${…} (con llaves anidadas).
function literalPart(text) {
  let out = ''
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (!depth && text[i] === '$' && text[i + 1] === '{') {
      depth = 1
      i++
    } else if (depth) depth += text[i] === '{' ? 1 : text[i] === '}' ? -1 : 0
    else out += text[i]
  }
  return out
}

export function pending(file) {
  const out = []
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i, all) => {
      // «// sin traducir»: texto fijo a propósito. Y la línea que sigue a un «t(» abierto.
      if (SKIP_LINE.test(line) || line.includes('// sin traducir') || /\b(?:t|tr|N_)\(\s*$/.test(all[i - 1] ?? '')) return
      const code = line.replace(/\/\/.*$/, '').replace(CLASSES, '')
      for (const m of code.matchAll(STRING)) {
        const text = m[3] !== undefined ? literalPart(m[3]) : (m[1] ?? m[2])
        const before = code.slice(0, m.index)
        // También una palabra suelta con mayúscula como resultado de un ternario o de un valor por
        // defecto («cond ? 'Pausa' : 'Marcha'», «x || 'Sin título'»).
        // Y una frase con mayúscula pasada como argumento, en una lista de opciones o entre llaves en
        // JSX («select('kind', 'Tipo', [['a', 'Abierta']])», «{`Rampa ${s} s`}»).
        const shown =
          (/(?:\?|:|\|\||\?\?)\s*$/.test(before) && /^\p{Lu}\p{Ll}{2,}/u.test(text ?? '') && !KEEP.test(text ?? '')) ||
          (/(?:,|\[|\(|\{)\s*$/.test(before) && /^\p{Lu}\p{Ll}{3,}/u.test(text ?? '') && !KEEP.test(text ?? ''))
        if (!text || (!SPANISH.test(text) && !shown) || !/\p{L}{3,}/u.test(text)) continue
        if (/(?:\bt|\btr|\bN_)\(\s*$/.test(before)) continue
        out.push(`${file}:${i + 1}  ${text.slice(0, 90)}`)
      }
      // Texto JSX suelto junto a una expresión: «>{n} elementos<» o «>Hola {x}<».
      // Solo cuenta el texto fuera de las llaves (lo de dentro ya pasa por t() o es código).
      const jsx = code.match(/(?<!=)>([^<>]*\{[^<>]*\}[^<>]*)</)
      let depth = 0
      const outside = [...(jsx?.[1] ?? '')].map((ch) => (ch === '{' ? (depth++, ' ') : ch === '}' ? (depth--, ' ') : depth ? ' ' : ch)).join('')
      if (/\p{L}{3,}/u.test(outside) && !/[(),;]/.test(outside)) out.push(`${file}:${i + 1}  JSX: ${jsx[1].trim().slice(0, 90)}`)
    })
  return out
}

if (process.argv[1]?.endsWith('i18n-pending.mjs')) {
  const all = process.argv.slice(2).flatMap(pending)
  for (const line of all) console.log(line)
  console.log(`${all.length} pendientes`)
}
