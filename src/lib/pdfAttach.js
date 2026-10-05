// Archivos adjuntos en un PDF (los «adjuntos» que muestra cualquier visor: Acrobat, Firefox…):
// la hoja del ejercicio lleva dentro el archivo del ejercicio, y el editor lo lee al abrir el PDF.
//
// Se añade con una actualización incremental (ISO 32000-1, 7.5.6): al final del PDF de jsPDF van
// el archivo (/EmbeddedFile), su ficha (/Filespec), el catálogo con /Names /EmbeddedFiles y una
// tabla xref nueva que apunta a la anterior. El PDF original no se toca. Puro: se prueba sin
// navegador.

const latin1 = (bytes) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return s
}
const ascii = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff)
// Cadena literal de PDF (solo ASCII imprimible; lo demás se cambia por «_»).
const pdfString = (s) => `(${String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/[\\()]/g, '\\$&')})`

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

// Último trailer del PDF: { root, info, size, prev }.
function lastTrailer(text) {
  const at = text.lastIndexOf('trailer')
  const startxref = text.lastIndexOf('startxref')
  if (at < 0 || startxref < 0) return null
  const dict = text.slice(at, startxref)
  const root = dict.match(/\/Root\s+(\d+)\s+0\s+R/)?.[1]
  const size = dict.match(/\/Size\s+(\d+)/)?.[1]
  const prev = text.slice(startxref + 9).match(/\d+/)?.[0]
  if (!root || !size || !prev) return null
  return { root: Number(root), size: Number(size), prev: Number(prev), info: dict.match(/\/Info\s+\d+\s+0\s+R/)?.[0] ?? '' }
}

// Diccionario de un objeto (su última definición): el texto entre «<<» y su «>>».
function objectDict(text, id) {
  const re = new RegExp(`(?:^|[\\r\\n])${id}\\s+0\\s+obj\\s*<<`, 'g')
  let match
  let last = null
  while ((match = re.exec(text))) last = match
  if (!last) return null
  let depth = 0
  for (let i = last.index + last[0].length - 2; i < text.length - 1; i++) {
    if (text[i] === '<' && text[i + 1] === '<') {
      depth++
      i++
    } else if (text[i] === '>' && text[i + 1] === '>') {
      depth--
      i++
      if (depth === 0) return text.slice(last.index + last[0].length, i - 1)
    }
  }
  return null
}

// PDF (bytes) + archivo -> PDF con el archivo adjunto. name: nombre del adjunto (ASCII).
export function attachFile(pdf, { name, data, mime = 'application/octet-stream', description = '' }) {
  const text = latin1(pdf)
  const trailer = lastTrailer(text)
  const catalog = trailer && objectDict(text, trailer.root)
  if (!catalog || /\/Names\b/.test(catalog)) throw new Error('PDF sin catálogo reconocible')
  const file = trailer.size
  const spec = file + 1
  const eol = pdf[pdf.length - 1] === 0x0a ? '' : '\n'
  const offsets = {}
  const parts = [pdf, ascii(eol)]
  let at = pdf.length + eol.length
  const add = (id, chunks) => {
    offsets[id] = at
    for (const c of chunks) {
      parts.push(c)
      at += c.length
    }
  }
  const subtype = `/${mime.replace(/[^A-Za-z0-9.+-]/g, (c) => `#${c.charCodeAt(0).toString(16).padStart(2, '0')}`)}`
  add(file, [ascii(`${file} 0 obj\n<< /Type /EmbeddedFile /Subtype ${subtype} /Length ${data.length} /Params << /Size ${data.length} >> >>\nstream\n`), data, ascii('\nendstream\nendobj\n')])
  add(spec, [ascii(`${spec} 0 obj\n<< /Type /Filespec /F ${pdfString(name)} /UF ${pdfString(name)} /Desc ${pdfString(description)} /AFRelationship /Source /EF << /F ${file} 0 R /UF ${file} 0 R >> >>\nendobj\n`)])
  add(trailer.root, [ascii(`${trailer.root} 0 obj\n<<${catalog} /Names << /EmbeddedFiles << /Names [${pdfString(name)} ${spec} 0 R] >> >> /AF [${spec} 0 R] >>\nendobj\n`)])
  // Tabla xref de la actualización: una subsección por cada grupo de números seguidos.
  const ids = Object.keys(offsets).map(Number).sort((a, b) => a - b)
  // Con la entrada 0 (libre), como en una tabla completa: algunos lectores la esperan.
  let xref = 'xref\n0 1\n0000000000 65535 f\r\n'
  for (let i = 0; i < ids.length; ) {
    let j = i
    while (j + 1 < ids.length && ids[j + 1] === ids[j] + 1) j++
    xref += `${ids[i]} ${j - i + 1}\n`
    for (let k = i; k <= j; k++) xref += `${String(offsets[ids[k]]).padStart(10, '0')} 00000 n\r\n`
    i = j + 1
  }
  xref += `trailer\n<< /Size ${spec + 1} /Root ${trailer.root} 0 R ${trailer.info} /Prev ${trailer.prev} >>\nstartxref\n${at}\n%%EOF\n`
  parts.push(ascii(xref))
  return concat(parts)
}

// Adjuntos de un PDF -> [{ name, data }] (vacío si no tiene o no se entienden).
export function attachmentsOf(pdf) {
  const text = latin1(pdf)
  const found = []
  const seen = new Set()
  // Fichas de archivo: /Type /Filespec ... /F (nombre) ... /EF << /F n 0 R
  const specs = text.matchAll(/\/Type\s*\/Filespec([\s\S]*?)endobj/g)
  for (const [, body] of specs) {
    const name = body.match(/\/UF\s*\(((?:\\.|[^\\)])*)\)/)?.[1] ?? body.match(/\/F\s*\(((?:\\.|[^\\)])*)\)/)?.[1]
    const ref = body.match(/\/EF\s*<<[^>]*?\/F\s+(\d+)\s+0\s+R/)?.[1]
    if (!name || !ref || seen.has(name)) continue
    const data = streamOf(pdf, text, Number(ref))
    if (!data) continue
    seen.add(name)
    found.push({ name: name.replace(/\\(.)/g, '$1'), data })
  }
  return found
}

// Contenido (sin filtros) del flujo del objeto `id` (su última definición).
function streamOf(pdf, text, id) {
  const re = new RegExp(`(?:^|[\\r\\n])${id}\\s+0\\s+obj\\b`, 'g')
  let match
  let last = null
  while ((match = re.exec(text))) last = match
  if (!last) return null
  const head = text.slice(last.index, text.indexOf('stream', last.index))
  if (/\/Filter/.test(head)) return null // comprimido por otro programa: no lo leemos
  const length = Number(head.match(/\/Length\s+(\d+)(?!\s+0\s+R)/)?.[1])
  if (!Number.isFinite(length)) return null
  let start = text.indexOf('stream', last.index) + 6
  if (text[start] === '\r') start++
  if (text[start] === '\n') start++
  return pdf.slice(start, start + length)
}

export const isPdf = (bytes) => bytes.length > 4 && latin1(bytes.subarray(0, 5)) === '%PDF-'
