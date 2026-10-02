// Negación en receptividades: "!x" se representa como x con una raya encima (notación IEC 60848).
// - "!a"        -> a negada
// - "a AND !b"  -> solo b negada
// - "!(a OR b)" -> raya sobre todo el grupo; los paréntesis sobran porque la raya ya agrupa

// "%" admite direcciones IEC (!%IX0.0) cuando se muestran las direcciones en el diagrama.
const NEGATION = /!\s*(\(([^()]*)\)|[\p{L}\p{N}_.%]+)/gu

// Divide la condición en tramos de texto, marcando los negados.
export function parseCondition(text) {
  const segments = []
  let last = 0
  for (const m of String(text ?? '').matchAll(NEGATION)) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), negated: false })
    segments.push({ text: m[2] !== undefined ? m[2].trim() : m[1], negated: true })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), negated: false })
  return segments
}
