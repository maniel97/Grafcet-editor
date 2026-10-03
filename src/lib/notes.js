// Notas de texto del lienzo (nodes/NoteNode.jsx).

// Colores de las notas (fondo y borde), elegibles desde el menú contextual.
export const NOTE_COLORS = {
  yellow: { label: 'Amarillo', bg: '#fef9c3', border: '#eab308' },
  blue: { label: 'Azul', bg: '#dbeafe', border: '#3b82f6' },
  green: { label: 'Verde', bg: '#dcfce7', border: '#22c55e' },
  gray: { label: 'Gris', bg: '#f1f5f9', border: '#94a3b8' },
}
export const NOTE_SIZE = { width: 220, height: 110 }

// Formato ligero de las notas (se escribe como texto y se ve formateado):
//   «# Título»   encabezado            «- elemento» o «• elemento»   lista con viñetas
//   «**negrita**»                       «`Marcha`»   nombre de variable (letra de código)
// Devuelve bloques [{ kind: 'title' | 'item' | 'line' | 'blank', spans: [{ text, bold, code }] }].
export function parseNote(text = '') {
  return text.split('\n').map((raw) => {
    if (!raw.trim()) return { kind: 'blank', spans: [] }
    const title = /^#\s+(.*)$/.exec(raw)
    const item = /^\s*[-•]\s+(.*)$/.exec(raw)
    const body = title ? title[1] : item ? item[1] : raw
    return { kind: title ? 'title' : item ? 'item' : 'line', spans: parseSpans(body) }
  })
}

function parseSpans(text) {
  const spans = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) })
    spans.push(m[1] !== undefined ? { text: m[1], bold: true } : { text: m[2], code: true })
    last = re.lastIndex
  }
  if (last < text.length) spans.push({ text: text.slice(last) })
  return spans
}
