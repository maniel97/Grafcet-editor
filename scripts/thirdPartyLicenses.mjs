// Licencias de terceros: las librerías que van dentro de la aplicación (dependencias de producción,
// según package-lock.json) con su licencia y su aviso de copyright, como piden MIT, ISC, BSD, OFL,
// Apache… Plugin de Vite: en cada compilación deja THIRD-PARTY-LICENSES.txt junto a index.html
// («Acerca de» lo enlaza). Sin dependencias: lee node_modules directamente.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const LICENSES_FILE = 'THIRD-PARTY-LICENSES.txt'

// Paquetes MIT que no traen su archivo de licencia: el texto estándar con el autor que declaran.
const mitText = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`

export function thirdPartyLicenses(root = process.cwd()) {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  const own = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const entries = Object.entries(lock.packages ?? {})
    .filter(([path, p]) => path.startsWith('node_modules/') && !p.dev)
    .map(([path]) => path)
    .filter((path) => existsSync(join(root, path, 'package.json')))
    .sort((a, b) => a.localeCompare(b))
  const parts = entries.map((path) => {
    const dir = join(root, path)
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? (pkg.licenses ?? []).map((l) => l.type).join(' OR ')) || 'desconocida'
    const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying|ofl)(\.|$)/i.test(f))
    const author = typeof pkg.author === 'string' ? pkg.author : (pkg.author?.name ?? '')
    const text = file ? readFileSync(join(dir, file), 'utf8').trim() : license === 'MIT' ? mitText(author || pkg.name) : `(Sin archivo de licencia en el paquete; licencia declarada: ${license}.)`
    const repo = typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? '')
    return [`${pkg.name}@${pkg.version} — ${license}`, repo, '', text].filter((l, i) => i !== 1 || l).join('\n')
  })
  const header = `${own.name} ${own.version} incluye las siguientes librerías de terceros, cada una con su licencia y su aviso de copyright.\n${own.name} ${own.version} includes the following third-party libraries, each under its own licence and copyright notice.`
  return [header, ...parts].join(`\n\n${'='.repeat(78)}\n\n`) + '\n'
}

export const thirdPartyLicensesPlugin = () => ({
  name: 'third-party-licenses',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: LICENSES_FILE, source: thirdPartyLicenses() })
  },
})
