// Órdenes de forzado de grafcets parciales (IEC 60848), escritas como acción de una etapa:
//   F/G2{3}      fuerza G2 a la situación con solo la etapa 3 activa (o {3,5}: varias)
//   F/G2{}       situación vacía: ninguna etapa de G2 activa
//   F/G2{*}      congela G2 en su situación actual
//   F/G2{INIT}   G2 en su situación inicial
// Mientras la etapa está activa, el forzado tiene prioridad sobre las reglas de evolución: el
// grafcet forzado no evoluciona por sí mismo.

const FORCING = /^F\s*\/\s*([\p{L}_][\p{L}\p{N}_]*)\s*:?\s*\{\s*([^}]*?)\s*\}$/u

// Devuelve { grafcet, mode: 'steps' | 'empty' | 'freeze' | 'init', steps: [etiquetas] } o null.
export function parseForcing(text) {
  const m = FORCING.exec(String(text ?? '').trim())
  if (!m) return null
  const grafcet = m[1].toUpperCase()
  const body = m[2].trim()
  if (!body) return { grafcet, mode: 'empty', steps: [] }
  if (body === '*') return { grafcet, mode: 'freeze', steps: [] }
  if (/^init$/i.test(body)) return { grafcet, mode: 'init', steps: [] }
  // Las etapas pueden escribirse 3 o X3.
  const steps = body
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((s) => s.replace(/^X(?=\w)/i, ''))
  return { grafcet, mode: 'steps', steps }
}

export const isForcing = (text) => parseForcing(text) !== null

export function describeForcing(f) {
  if (f.mode === 'empty') return `F/${f.grafcet}{}`
  if (f.mode === 'freeze') return `F/${f.grafcet}{*}`
  if (f.mode === 'init') return `F/${f.grafcet}{INIT}`
  return `F/${f.grafcet}{${f.steps.join(',')}}`
}
