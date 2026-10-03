import { useEffect, useRef } from 'react'
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

function save({ nodes, edges, plc, name }) {
  try {
    const strip = (items) => items.map(({ selected: _selected, dragging: _dragging, ...rest }) => rest)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, nodes: strip(nodes), edges: strip(edges), plc }))
  } catch {
    // Sin almacenamiento disponible (modo privado, cuota...): se sigue trabajando sin autoguardado.
  }
}

export function useAutosave(nodes, edges, plc, name) {
  // Lo pendiente de guardar (null si ya está guardado).
  const pending = useRef(null)
  useEffect(() => {
    pending.current = { nodes, edges, plc, name }
    const timer = setTimeout(() => {
      save(pending.current)
      pending.current = null
    }, DELAY_MS)
    return () => clearTimeout(timer)
  }, [nodes, edges, plc, name])
  // Al cerrar o recargar la página, lo pendiente se guarda al momento (si no, un cambio hecho
  // justo antes se perdería).
  useEffect(() => {
    const flush = () => {
      if (pending.current) save(pending.current)
      pending.current = null
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])
}
