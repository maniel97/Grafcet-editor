// Versión portable: todo el editor en un solo archivo HTML (dist-portable/grafcet-editor.html)
// que se abre con doble clic desde cualquier carpeta o USB, sin servidor ni conexión.
// 1. Compila sin dividir el código (las partes bajo demanda van dentro) y con las fuentes e
//    imágenes como datos (vite.config.js, PORTABLE=1).
// 2. Incrusta el JavaScript y el CSS en el HTML.
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = 'dist-portable'
execSync('node node_modules/vite/bin/vite.js build', { stdio: 'inherit', env: { ...process.env, PORTABLE: '1' } })

let html = readFileSync(join(out, 'index.html'), 'utf8')
const read = (href) => readFileSync(join(out, href.replace(/^\.\//, '')), 'utf8')
// Scripts de módulo: dentro del HTML. «</script» dentro del código cerraría la etiqueta antes de
// tiempo: se escribe «<\/script» (en JavaScript significa lo mismo).
const SCRIPT_END = '</' + 'script'
const ESCAPED_END = '<' + String.fromCharCode(92) + '/script'
html = html.replace(
  /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
  (_, src) => `<script type="module">${read(src).replaceAll(SCRIPT_END, ESCAPED_END)}</script>`,
)
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => `<style>${read(href)}</style>`)
// Sin manifiesto ni precarga de módulos (no hay servidor); el icono, como dato.
html = html.replace(/<link rel="manifest"[^>]*>\s*/g, '').replace(/<link rel="modulepreload"[^>]*>\s*/g, '').replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, '')
const icon = readFileSync('public/icon.svg', 'utf8')
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(icon)}">`)
if (/src="\.\/assets\/|href="\.\/assets\//.test(html)) throw new Error('Quedan referencias a archivos externos en el HTML portable.')

writeFileSync(join(out, 'grafcet-editor.html'), html)
// Solo queda el archivo único.
for (const entry of readdirSync(out)) if (entry !== 'grafcet-editor.html') rmSync(join(out, entry), { recursive: true, force: true })
console.log(`Portable: ${out}/grafcet-editor.html (${Math.round(html.length / 1024)} kB)`)
