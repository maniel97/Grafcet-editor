import { describe, expect, it } from 'vitest'
import { thirdPartyLicenses } from '../../scripts/thirdPartyLicenses.mjs'

// Las licencias MIT, ISC, BSD, OFL… piden incluir su aviso de copyright con la aplicación.
describe('licencias de terceros (THIRD-PARTY-LICENSES.txt)', () => {
  const text = thirdPartyLicenses()
  it('incluye cada librería de producción con su licencia', () => {
    for (const name of ['react@', 'react-dom@', '@xyflow/react@', 'jspdf@', 'lucide-react@', 'qrcode-generator@', '@fontsource/inter@']) expect(text).toContain(`\n${name}`)
    expect(text).toMatch(/Copyright/)
  })
  it('ninguna se queda sin el texto de su licencia', () => {
    expect(text).not.toContain('Sin archivo de licencia')
  })
})
