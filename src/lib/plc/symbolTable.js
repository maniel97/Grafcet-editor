// Tabla de símbolos pegada desde STEP 7-Micro/WIN (copiar las filas de la tabla): cada fila con el
// nombre, la dirección y, opcionalmente, el comentario, separados por tabuladores (las columnas
// vacías o de estado, como la primera de Micro/WIN, se ignoran).

const ADDRESS = /^(I|Q|M|V|SM)\d+\.[0-7]$|^(AIW|AQW|VW|MW|VB|MB)\d+$|^[TC]\d+$/i

// Tipo de variable del editor según la zona de memoria.
export function typeForAddress(address) {
  const a = address.toUpperCase()
  if (a.startsWith('AIW')) return 'analogIn'
  if (a.startsWith('AQW')) return 'analogOut'
  if (a.startsWith('I')) return 'input'
  if (a.startsWith('Q')) return 'output'
  if (a.startsWith('T')) return 'timer'
  if (a.startsWith('C')) return 'counter'
  return 'memory'
}

// Texto pegado -> [{ name, address, comment }] (y las líneas que no se entienden).
export function parseSymbolTable(text) {
  const symbols = []
  const skipped = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const cells = raw.split(/\t|;|\s{2,}/).map((c) => c.trim())
    const at = cells.findIndex((c) => ADDRESS.test(c))
    const name = cells.slice(0, Math.max(0, at)).filter(Boolean).pop()
    if (at < 0 || !name || /^(s[ií]mbolo|symbol|nombre)$/i.test(name)) {
      if (!/^(s[ií]mbolo|symbol)/i.test(raw.trim()) && !/s[ií]mbolo\s+direcci/i.test(raw)) skipped.push(raw.trim())
      continue
    }
    symbols.push({ name, address: cells[at].toUpperCase(), comment: cells.slice(at + 1).filter(Boolean).join(' ') })
  }
  return { symbols, skipped }
}

// Aplica los símbolos a la tabla de variables del proyecto (plc.variables): dirección y comentario;
// las variables nuevas, con el tipo de su zona de memoria.
export function applySymbols(variables = {}, symbols) {
  const next = { ...variables }
  for (const { name, address, comment } of symbols) {
    const entry = next[name] ?? { type: typeForAddress(address) }
    next[name] = { ...entry, address, ...(comment && !entry.comment ? { comment } : {}) }
  }
  return next
}
