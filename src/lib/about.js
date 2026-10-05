// Datos del proyecto para «Acerca de» (centro de ayuda) y el README. REPO_URL: el repositorio
// público (si está vacío, el enlace no se muestra). La versión sale de package.json (SemVer:
// 0.x = en desarrollo; -alpha.n / -beta.n = versiones de prueba).
import { version } from '../../package.json'

export const VERSION = version
// Versión de prueba (alfa o beta): «Acerca de» lo avisa.
export const PRERELEASE = /-(alpha|beta)/.test(version) ? version.match(/-(alpha|beta)/)[1] : null
export const SITE_URL = 'https://grafcet-editor.com'
export const REPO_URL = 'https://github.com/maniel97/Grafcet-editor'
export const ISSUES_URL = `${REPO_URL}/issues`
export const AUTHOR = 'Maniel Montes'
export const LICENSE_NAME = 'GPL-3.0'
export const LICENSE_URL = 'https://www.gnu.org/licenses/gpl-3.0.html'
export const YEAR = 2026
