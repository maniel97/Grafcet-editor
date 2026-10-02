import { useEditor } from '../lib/editorContext'

// Contorno ámbar mientras el ratón está sobre una fila de la tabla de variables del lienzo
// que usa este nodo. Solo dura lo que el ratón está encima de la tabla, así que no llega
// a las exportaciones.
export function useHighlightClass(nodeId) {
  const { highlightIds } = useEditor()
  return highlightIds?.has(nodeId) ? 'outline-2 outline-offset-4 outline-amber-400 rounded-sm' : ''
}
