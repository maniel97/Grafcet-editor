// Ayuda para pasar un componente a los textos traducibles (lib/i18n.js): en los atributos JSX con
// texto (title, label, aria-label, placeholder, alt, hint…) cambia "Texto" por {t('Texto')}, y
// también los textos entre etiquetas; añade el import.
// Uso: node scripts/i18n-wrap.mjs src/components/Archivo.jsx […]. Revisa el diff después.
import { readFileSync, writeFileSync } from 'node:fs'

const ATTRS = ['title', 'label', 'aria-label', 'placeholder', 'alt', 'hint', 'menuLabel', 'description']
const ATTR = new RegExp(`(\\s(?:${ATTRS.join('|')})=)"([^"{}]*\\p{L}[^"{}]*)"`, 'gu')

export function wrap(source, importPath) {
  let usedT = false
  const quote = (text) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  // (También en los componentes propios: si el componente vuelve a traducirlo, el texto ya traducido
  // no es una clave y queda igual.)
  const attrs = source.replace(ATTR, (all, attr, text) => {
    usedT = true
    return `${attr}{t(${quote(text)})}`
  })
  // Textos entre etiquetas sin {…}: «>Texto<» -> «>{t('Texto')}<». Como JSX, se juntan las líneas
  // y se conservan los espacios del principio o del final si están en la misma línea (junto a otra
  // etiqueta: «<b>x</b> texto»). Solo tras el cierre de una etiqueta («…">», «<b>», «</b>», «}>»),
  // no tras «a >»; tampoco «=>» ni comparaciones (el texto no puede llevar = ;).
  // (También el «>» que cierra en su propia línea una etiqueta de varias líneas.)
  const out = attrs.replace(/(?:(?<=[\w"'}/])|(?<=\n[ \t]*))>([^<>{}=;]*\p{L}[^<>{}=;]*)<(?=\/|[A-Za-z])/gu, (all, text) => {
    if (/&&|\|\||\(\)|\breturn\b|\bconst\b|\.map\b/.test(text)) return all
    // Código entre dos etiquetas (p. ej. un ternario: «</code> ) : x ? ( <strong»).
    if (/^\s*[)\]]|\?\s*\(|\s:\s*\(/.test(text)) return all
    // Elementos JSX como valores de un objeto o una lista: «/>,\n  clave: <…».
    if (/^\s*,/.test(text) || /[\w'"]:\s*$/.test(text)) return all
    const collapsed = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
    if (!/\p{L}{2,}/u.test(collapsed)) return all
    const lead = /^[ \t]+\S/.test(text) && !text.startsWith('\n') ? "{' '}" : ''
    const trail = /\S[ \t]+$/.test(text) && !text.endsWith('\n') ? "{' '}" : ''
    usedT = true
    const keepIndent = (s) => (s.match(/^\s*\n[ \t]*/)?.[0] ?? '')
    const lastIndent = text.match(/\n[ \t]*$/)?.[0] ?? ''
    return `>${keepIndent(text)}${lead}{t(${quote(collapsed)})}${trail}${lastIndent}<`
  })
  const needed = usedT ? ['t'] : []
  if (!needed.length) return out
  const imp = /import \{([^}]*)\} from '([^']*i18n)'/
  const m = out.match(imp)
  if (m) {
    const have = m[1].split(',').map((s) => s.trim()).filter(Boolean)
    const all = [...new Set([...have, ...needed])]
    return out.replace(imp, `import { ${all.join(', ')} } from '${m[2]}'`)
  }
  const lastImport = [...out.matchAll(/^import .*$/gm)].pop()
  const at = lastImport ? lastImport.index + lastImport[0].length : 0
  return `${out.slice(0, at)}\nimport { ${needed.join(', ')} } from '${importPath}'${out.slice(at)}`
}

if (process.argv[1]?.endsWith('i18n-wrap.mjs')) {
  for (const file of process.argv.slice(2)) {
    const depth = file.replace(/\\/g, '/').split('/src/')[1]?.split('/').length ?? 2
    const importPath = `${'../'.repeat(depth - 1) || './'}lib/i18n`
    const before = readFileSync(file, 'utf8')
    const after = wrap(before, importPath)
    if (after !== before) writeFileSync(file, after)
    console.log(file, after === before ? 'sin cambios' : 'actualizado')
  }
}
