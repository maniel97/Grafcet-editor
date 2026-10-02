import { useEffect } from 'react'
import { normalizeProject } from './projectFile'

// Autoguardado en este navegador: el trabajo sobrevive a recargas y cierres accidentales.
// Es una red de seguridad local; para compartir o archivar se usa Guardar (.json).

const STORAGE_KEY = 'grafcet-editor:autosave'
const DELAY_MS = 600

export function loadAutosave() {
  try {
    return normalizeProject(JSON.parse(localStorage.getItem(STORAGE_KEY)))
  } catch {
    return null
  }
}

export function useAutosave(nodes, edges, plc) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const strip = (items) => items.map(({ selected: _selected, dragging: _dragging, ...rest }) => rest)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: strip(nodes), edges: strip(edges), plc }))
      } catch {
        // Sin almacenamiento disponible (modo privado, cuota...): se sigue trabajando sin autoguardado.
      }
    }, DELAY_MS)
    return () => clearTimeout(timer)
  }, [nodes, edges, plc])
}
