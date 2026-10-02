// Trabajos anteriores: antes de reemplazar el diagrama (abrir un archivo o un ejemplo, recuperar
// otro trabajo, limpiar el lienzo), el actual se guarda aquí, en este navegador, para poder
// recuperarlo aunque no se hubiera guardado como archivo. Se conservan los últimos MAX_RECENT.

const STORAGE_KEY = 'grafcet-editor:recent'
export const MAX_RECENT = 8

const strip = (items) => items.map(({ selected: _s, dragging: _d, ...rest }) => rest)

export function listRecent(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage.getItem(STORAGE_KEY))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(list, storage) {
  // Si no cabe (cuota del navegador), se descartan los más antiguos hasta que quepa.
  for (let items = list; items.length; items = items.slice(0, -1)) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(items))
      return items
    } catch {
      // seguir probando con menos
    }
  }
  return []
}

export function summarize(nodes) {
  const steps = nodes.filter((n) => n.type === 'step').length
  const transitions = nodes.filter((n) => n.type === 'transition').length
  return `${steps} ${steps === 1 ? 'etapa' : 'etapas'} · ${transitions} ${transitions === 1 ? 'transición' : 'transiciones'}`
}

// Guarda un trabajo. No guarda diagramas vacíos ni repite el último si es idéntico.
export function pushRecent({ nodes, edges, plc, name }, reason, storage = globalThis.localStorage) {
  if (!nodes.some((n) => n.type === 'step' || n.type === 'transition')) return listRecent(storage)
  const project = { name, nodes: strip(nodes), edges: strip(edges), plc }
  const list = listRecent(storage)
  if (list[0] && JSON.stringify(list[0].project) === JSON.stringify(project)) return list
  const entry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), reason, summary: summarize(nodes), project }
  return write([entry, ...list].slice(0, MAX_RECENT), storage)
}

export function removeRecent(id, storage = globalThis.localStorage) {
  return write(
    listRecent(storage).filter((e) => e.id !== id),
    storage,
  )
}
