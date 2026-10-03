// Compartir por enlace: el proyecto, comprimido (deflate) y en base64url, va dentro del propio
// enlace, detrás de «#p=». No hay servidor: la parte tras «#» ni siquiera se envía a la web que
// aloja la aplicación. Quien abre el enlace recibe el proyecto completo (grafcet, tabla, planta,
// escenarios y notas).

const PREFIX = '#p='
// Más largo que esto, algunas aplicaciones de mensajería recortan el enlace.
export const LONG_LINK = 4000
// Lo que cabe en un código QR (versión 40 con corrección L ≈ 2900 caracteres); más largo no se lee.
export const QR_LIMIT = 2900

const toBase64Url = (bytes) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromBase64Url = (text) => {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function transform(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

// Proyecto -> texto para el enlace.
export async function encodeProject(project) {
  const json = JSON.stringify({ format: 'grafcet-editor', version: 1, ...project })
  const packed = await transform(new TextEncoder().encode(json), new CompressionStream('deflate-raw'))
  return toBase64Url(packed)
}

// Texto del enlace -> proyecto (o un Error con un mensaje claro).
export async function decodeProject(data) {
  try {
    const bytes = await transform(fromBase64Url(data), new DecompressionStream('deflate-raw'))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('El enlace está incompleto o dañado: puede que se haya recortado al enviarlo.')
  }
}

// Enlace completo para la página actual.
export async function shareLink(project, location = window.location) {
  return `${location.origin}${location.pathname}${PREFIX}${await encodeProject(project)}`
}

// Lo compartido en el enlace con el que se ha abierto la página (o null).
export const sharedData = (hash = window.location.hash) => (hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null)

// Quita el proyecto compartido de la barra de direcciones (sin recargar).
export function clearSharedHash() {
  if (window.location.hash.startsWith(PREFIX)) history.replaceState(null, '', window.location.pathname + window.location.search)
}

// ¿La aplicación se está usando solo en este equipo? (servidor local o archivo): entonces el
// enlace no se puede abrir desde otro dispositivo.
export const isLocalOnly = (location = window.location) =>
  location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || /^192\.168\.|^10\./.test(location.hostname)
