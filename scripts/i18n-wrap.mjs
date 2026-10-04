// Ayuda para pasar un componente a los textos traducibles (lib/i18n.js): en los atributos JSX con
// texto (title, label, aria-label, placeholder, alt, hint…) cambia "Texto" por {t('Texto')} en los
// elementos HTML y por {N_('Texto')} en los componentes (que lo traducen por dentro), y añade el
// import. Uso: node scripts/i18n-wrap.mjs src/components/Archivo.jsx […]. Revisa el diff después.
import { readFileSync, writeFileSync } from 'node:fs'

const ATTRS = ['title', 'label', 'aria-label', 'placeholder', 'alt', 'hint', 'menuLabel', 'description']
const ATTR = new RegExp(`(\\s(?:${ATTRS.join('|')})=)"([^"{}]*\\p{L}[^"{}]*)"`, 'gu')

export function wrap(source, importPath) {
  let usedT = false
  let usedN = false
  const out = source.replace(ATTR, (all, attr, text, offset) => {
    // Etiqueta a la que pertenece el atributo: la última «<Nombre» antes de él.
    const tag = [...source.slice(0, offset).matchAll(/<([A-Za-z][\w.]*)/g)].pop()?.[1] ?? 'div'
    const literal = `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    if (/^[A-Z]/.test(tag)) {
      usedN = true
      return `${attr}{N_(${literal})}`
    }
    usedT = true
    return `${attr}{t(${literal})}`
  })
  const needed = [usedT && 't', usedN && 'N_'].filter(Boolean)
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
